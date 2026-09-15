export const CANONICAL_MONITOR_URL = 'https://elpro-saas.vercel.app/login';
export const EXPECTED_STATUS = 200;
export const CHECK_INTERVAL_MS = 5 * 60 * 1000;
export const HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type ProbeStatus = 'ok' | 'failed';

export interface MonitorState {
  lastScheduledAt: number | null;
  consecutiveFailures: number;
  activeOutageId: number | null;
}

export interface ScheduleDecision {
  kind: 'accepted' | 'duplicate' | 'stale';
  gapSlots: number;
}

export interface Transition {
  next: MonitorState;
  openedOutageId: number | null;
}

export interface PendingAlert {
  outageId: number;
  openedAt: number;
  deliveredAt: number | null;
  retryAt: number;
}

export const EMPTY_MONITOR_STATE: MonitorState = {
  lastScheduledAt: null,
  consecutiveFailures: 0,
  activeOutageId: null,
};

export function validateMonitorUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('MONITOR_URL must be the canonical HTTPS login URL.');
  }
  if (url.href !== CANONICAL_MONITOR_URL || url.username || url.password || url.search || url.hash) {
    throw new Error('MONITOR_URL must be the canonical HTTPS login URL.');
  }
  return url;
}

export function validateAlertSender(value: string): string {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('MONITOR_SENDER must be one email address.');
  return value;
}

export function validateAlertDestination(value: string): string {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('MONITOR_DESTINATION must be one email address.');
  return value;
}

export function decideSchedule(lastScheduledAt: number | null, scheduledAt: number): ScheduleDecision {
  if (!Number.isSafeInteger(scheduledAt) || scheduledAt <= 0) throw new Error('Scheduled time is invalid.');
  if (lastScheduledAt === null) return { kind: 'accepted', gapSlots: 0 };
  if (scheduledAt === lastScheduledAt) return { kind: 'duplicate', gapSlots: 0 };
  if (scheduledAt < lastScheduledAt) return { kind: 'stale', gapSlots: 0 };
  const elapsed = scheduledAt - lastScheduledAt;
  return { kind: 'accepted', gapSlots: Math.max(0, Math.floor(elapsed / CHECK_INTERVAL_MS) - 1) };
}

export function transitionAfterProbe({ prior, scheduledAt, status, gapSlots }: {
  prior: MonitorState;
  scheduledAt: number;
  status: ProbeStatus;
  gapSlots: number;
}): Transition {
  if (status === 'ok') {
    return {
      openedOutageId: null,
      next: { ...EMPTY_MONITOR_STATE, lastScheduledAt: scheduledAt },
    };
  }

  // A gap means the preceding failure sequence is not consecutive. Delivery is
  // deliberately not part of this state: a separately retained pending alert
  // may still be delivered later with its original incident timestamp.
  const failureBase = gapSlots > 0 ? EMPTY_MONITOR_STATE : prior;
  const consecutiveFailures = failureBase.consecutiveFailures + 1;
  const opensOutage = consecutiveFailures >= 3 && failureBase.activeOutageId === null;
  const outageId = opensOutage ? scheduledAt : failureBase.activeOutageId;

  return {
    openedOutageId: opensOutage ? outageId : null,
    next: {
      lastScheduledAt: scheduledAt,
      consecutiveFailures,
      activeOutageId: outageId,
    },
  };
}

export function retentionCutoff(checkedAt: number): number {
  return checkedAt - HISTORY_RETENTION_MS;
}

export function selectPendingDelivery(alerts: PendingAlert[], scheduledAt: number): PendingAlert | null {
  return alerts
    .filter((alert) => alert.deliveredAt === null && alert.retryAt <= scheduledAt)
    .sort((left, right) => left.openedAt - right.openedAt)[0] ?? null;
}

export function availabilityForWindow(samples: Array<{ status: ProbeStatus; gapSlots: number }>): number | null {
  if (samples.length === 0 || samples.some((sample) => sample.gapSlots > 0)) return null;
  return (samples.filter((sample) => sample.status === 'ok').length / samples.length) * 100;
}
