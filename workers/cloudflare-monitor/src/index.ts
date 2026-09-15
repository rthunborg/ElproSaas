import { EmailMessage } from 'cloudflare:email';

import {
  EMPTY_MONITOR_STATE,
  EXPECTED_STATUS,
  ProbeStatus,
  MonitorState,
  decideSchedule,
  retentionCutoff,
  transitionAfterProbe,
  validateAlertDestination,
  validateAlertSender,
  validateMonitorUrl,
} from './model';

const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = 'elpro-pilot-availability-monitor/2.0';
const MONITOR_OBJECT_NAME = 'production';

interface Env {
  MONITOR: DurableObjectNamespace;
  ALERT_EMAIL: SendEmail;
  MONITOR_URL: string;
  MONITOR_SENDER: string;
  MONITOR_DESTINATION: string;
  MONITOR_TEST_OUTCOME?: string;
}

interface ProbeSample {
  checkedAt: number;
  durationMs: number;
  observedStatus: number | null;
  status: ProbeStatus;
  errorClass: string | null;
}

interface StateRow extends Record<string, SqlStorageValue> {
  last_scheduled_at: number;
  consecutive_failures: number;
  active_outage_id: number | null;
}

interface PendingAlertRow extends Record<string, SqlStorageValue> {
  outage_id: number;
  opened_at: number;
  delivery_attempts: number;
  retry_at: number;
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const id = env.MONITOR.idFromName(MONITOR_OBJECT_NAME);
    ctx.waitUntil(env.MONITOR.get(id).fetch(`https://monitor.internal/run?scheduledAt=${controller.scheduledTime}`));
  },
} satisfies ExportedHandler<Env>;

export class AvailabilityMonitor implements DurableObject {
  constructor(private readonly state: DurableObjectState, private readonly env: Env) {
    this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS monitor_state (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        last_scheduled_at INTEGER NOT NULL,
        consecutive_failures INTEGER NOT NULL,
        active_outage_id INTEGER
      );
      CREATE TABLE IF NOT EXISTS monitor_samples (
        scheduled_at INTEGER PRIMARY KEY,
        checked_at INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        observed_status INTEGER,
        status TEXT NOT NULL CHECK (status IN ('ok', 'failed')),
        error_class TEXT,
        gap_slots INTEGER NOT NULL CHECK (gap_slots >= 0)
      );
      CREATE INDEX IF NOT EXISTS monitor_samples_checked_at ON monitor_samples (checked_at);
      CREATE TABLE IF NOT EXISTS monitor_alerts (
        outage_id INTEGER PRIMARY KEY,
        opened_at INTEGER NOT NULL,
        delivered_at INTEGER,
        delivery_attempts INTEGER NOT NULL,
        retry_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS monitor_alerts_pending_retry ON monitor_alerts (delivered_at, retry_at, opened_at);
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname !== 'monitor.internal' || url.pathname !== '/run' || request.method !== 'GET') {
      return new Response('Not found', { status: 404 });
    }
    const scheduledAt = Number(url.searchParams.get('scheduledAt'));
    if (!Number.isSafeInteger(scheduledAt)) return new Response('Bad scheduled time', { status: 400 });

    await this.state.blockConcurrencyWhile(() => this.recordScheduledProbe(scheduledAt));
    return new Response(null, { status: 204 });
  }

  private async recordScheduledProbe(scheduledAt: number): Promise<void> {
    const prior = this.readState();
    const schedule = decideSchedule(prior.lastScheduledAt, scheduledAt);
    if (schedule.kind !== 'accepted') {
      console.log(JSON.stringify({ event: 'ignored_scheduled_event', kind: schedule.kind, scheduledAt }));
      return;
    }

    const sample = await this.probe();
    const transition = transitionAfterProbe({ prior, scheduledAt, status: sample.status, gapSlots: schedule.gapSlots });
    const expiredAlerts = this.state.storage.transactionSync(() => {
      this.writeSample(scheduledAt, sample, schedule.gapSlots);
      this.writeState(transition.next);
      if (transition.openedOutageId !== null) {
        this.state.storage.sql.exec(
          'INSERT INTO monitor_alerts (outage_id, opened_at, delivered_at, delivery_attempts, retry_at) VALUES (?, ?, NULL, 0, ?)',
          transition.openedOutageId,
          transition.openedOutageId,
          scheduledAt,
        );
      }
      return this.expireHistory(retentionCutoff(sample.checkedAt));
    });
    for (const alert of expiredAlerts) {
      console.log(JSON.stringify({ event: 'monitor_alert_delivery_expired', outageId: alert.outage_id, deliveryAttempts: alert.delivery_attempts }));
    }
    console.log(JSON.stringify({
      event: 'monitor_sample_recorded',
      scheduledAt,
      status: sample.status,
      gapSlots: schedule.gapSlots,
      openedOutageId: transition.openedOutageId,
    }));
    await this.deliverOldestPendingAlert(scheduledAt, sample.status === 'ok' ? 'recovered' : schedule.gapSlots > 0 ? 'unknown after a scheduler gap' : 'still failing');
  }

  private async probe(): Promise<ProbeSample> {
    const checkedAt = Date.now();
    const started = performance.now();
    if (this.env.MONITOR_TEST_OUTCOME === 'failed') {
      return { checkedAt, durationMs: 0, observedStatus: null, status: 'failed', errorClass: 'TestFailure' };
    }

    try {
      const target = validateMonitorUrl(this.env.MONITOR_URL);
      const response = await fetch(target, {
        headers: { 'user-agent': USER_AGENT },
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return {
        checkedAt,
        durationMs: Math.round(performance.now() - started),
        observedStatus: response.status,
        status: response.status === EXPECTED_STATUS ? 'ok' : 'failed',
        errorClass: null,
      };
    } catch (error) {
      return {
        checkedAt,
        durationMs: Math.round(performance.now() - started),
        observedStatus: null,
        status: 'failed',
        errorClass: error instanceof Error ? error.name : 'UnknownError',
      };
    }
  }

  private readState(): MonitorState {
    // SqlStorageCursor.one() throws when this new object has zero rows. The
    // monitor needs that empty state on its first scheduled invocation.
    const row = this.state.storage.sql.exec<StateRow>('SELECT * FROM monitor_state WHERE singleton = 1').toArray()[0];
    if (!row) return EMPTY_MONITOR_STATE;
    return {
      lastScheduledAt: row.last_scheduled_at,
      consecutiveFailures: row.consecutive_failures,
      activeOutageId: row.active_outage_id,
    };
  }

  private writeState(value: MonitorState): void {
    if (value.lastScheduledAt === null) throw new Error('Persisted monitor state requires a scheduled timestamp.');
    this.state.storage.sql.exec(
      `INSERT INTO monitor_state (singleton, last_scheduled_at, consecutive_failures, active_outage_id)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(singleton) DO UPDATE SET
         last_scheduled_at = excluded.last_scheduled_at,
         consecutive_failures = excluded.consecutive_failures,
         active_outage_id = excluded.active_outage_id`,
      value.lastScheduledAt,
      value.consecutiveFailures,
      value.activeOutageId,
    );
  }

  private writeSample(scheduledAt: number, sample: ProbeSample, gapSlots: number): void {
    this.state.storage.sql.exec(
      `INSERT INTO monitor_samples (scheduled_at, checked_at, duration_ms, observed_status, status, error_class, gap_slots)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      scheduledAt,
      sample.checkedAt,
      sample.durationMs,
      sample.observedStatus,
      sample.status,
      sample.errorClass,
      gapSlots,
    );
  }

  private expireHistory(cutoff: number): PendingAlertRow[] {
    const expired = this.state.storage.sql.exec<PendingAlertRow>(
      'SELECT outage_id, opened_at, delivery_attempts, retry_at FROM monitor_alerts WHERE delivered_at IS NULL AND opened_at < ?',
      cutoff,
    ).toArray();
    this.state.storage.sql.exec('DELETE FROM monitor_samples WHERE checked_at < ?', cutoff);
    this.state.storage.sql.exec('DELETE FROM monitor_alerts WHERE opened_at < ?', cutoff);
    return expired;
  }

  private async deliverOldestPendingAlert(scheduledAt: number, currentState: 'recovered' | 'unknown after a scheduler gap' | 'still failing'): Promise<void> {
    const pending = this.state.storage.sql.exec<PendingAlertRow>(
      'SELECT outage_id, opened_at, delivery_attempts, retry_at FROM monitor_alerts WHERE delivered_at IS NULL AND retry_at <= ? ORDER BY opened_at ASC LIMIT 1',
      scheduledAt,
    ).toArray()[0];
    if (!pending) return;
    try {
      await this.env.ALERT_EMAIL.send(this.outageMessage(pending, currentState));
      this.state.storage.sql.exec('UPDATE monitor_alerts SET delivered_at = ?, retry_at = ? WHERE outage_id = ?', scheduledAt, scheduledAt, pending.outage_id);
    } catch {
      this.state.storage.sql.exec('UPDATE monitor_alerts SET delivery_attempts = delivery_attempts + 1, retry_at = ? WHERE outage_id = ?', scheduledAt + 5 * 60 * 1000, pending.outage_id);
      console.log(JSON.stringify({ event: 'monitor_alert_delivery_failed', outageId: pending.outage_id }));
    }
  }

  private outageMessage(alert: PendingAlertRow, currentState: 'recovered' | 'unknown after a scheduler gap' | 'still failing'): EmailMessage {
    const sender = validateAlertSender(this.env.MONITOR_SENDER);
    const destination = validateAlertDestination(this.env.MONITOR_DESTINATION);
    const subject = 'Elpro pilot monitor: three failed probes';
    const body = [
      'The synthetic availability monitor recorded three consecutive failed probes.',
      `Incident observed at: ${new Date(alert.opened_at).toISOString()}.`,
      `Current monitor state: ${currentState}.`,
      `Expected HTTP ${EXPECTED_STATUS} from the configured canonical login route.`,
      'This notification contains no customer data or request payloads.',
    ].join('\r\n');
    return new EmailMessage(sender, destination, `From: ${sender}\r\nTo: ${destination}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`);
  }
}
