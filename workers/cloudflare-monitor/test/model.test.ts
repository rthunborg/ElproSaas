import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANONICAL_MONITOR_URL,
  CHECK_INTERVAL_MS,
  EMPTY_MONITOR_STATE,
  HISTORY_RETENTION_MS,
  availabilityForWindow,
  decideSchedule,
  retentionCutoff,
  transitionAfterProbe,
  selectPendingDelivery,
  validateAlertDestination,
  validateAlertSender,
  validateMonitorUrl,
} from '../src/model.ts';

test('only accepts the exact canonical HTTPS login target', () => {
  assert.equal(validateMonitorUrl(CANONICAL_MONITOR_URL).href, CANONICAL_MONITOR_URL);
  for (const candidate of [
    'http://elpro-saas.vercel.app/login',
    'https://elpro-saas.vercel.app/login?debug=1',
    'https://elpro-saas.vercel.app/login/',
    'https://example.test/login',
  ]) {
    assert.throws(() => validateMonitorUrl(candidate), /canonical HTTPS login URL/);
  }
});

test('requires one explicit sender address instead of a committed default', () => {
  assert.equal(validateAlertSender('monitor@example.test'), 'monitor@example.test');
  assert.throws(() => validateAlertSender('not an address'), /MONITOR_SENDER/);
  assert.equal(validateAlertDestination('alert@example.test'), 'alert@example.test');
  assert.throws(() => validateAlertDestination('not an address'), /MONITOR_DESTINATION/);
});

test('classifies duplicates, stale invocations, and missing five-minute slots', () => {
  const first = 1_000_000_000;
  assert.deepEqual(decideSchedule(null, first), { kind: 'accepted', gapSlots: 0 });
  assert.deepEqual(decideSchedule(first, first), { kind: 'duplicate', gapSlots: 0 });
  assert.deepEqual(decideSchedule(first, first - CHECK_INTERVAL_MS), { kind: 'stale', gapSlots: 0 });
  assert.deepEqual(decideSchedule(first, first + (3 * CHECK_INTERVAL_MS)), { kind: 'accepted', gapSlots: 2 });
});

test('opens only one outage at the third consecutive ungapped failure', () => {
  const first = 1_000_000_000;
  const one = transitionAfterProbe({ prior: EMPTY_MONITOR_STATE, scheduledAt: first, status: 'failed', gapSlots: 0 });
  const two = transitionAfterProbe({ prior: one.next, scheduledAt: first + CHECK_INTERVAL_MS, status: 'failed', gapSlots: 0 });
  const three = transitionAfterProbe({ prior: two.next, scheduledAt: first + (2 * CHECK_INTERVAL_MS), status: 'failed', gapSlots: 0 });
  assert.equal(one.openedOutageId, null);
  assert.equal(two.openedOutageId, null);
  assert.equal(three.openedOutageId, first + (2 * CHECK_INTERVAL_MS));
  assert.equal(three.next.activeOutageId, first + (2 * CHECK_INTERVAL_MS));
});

test('a gap resets the active incident without canceling a pending delivery', () => {
  const first = 1_000_000_000;
  const prior = {
    ...EMPTY_MONITOR_STATE,
    lastScheduledAt: first,
    consecutiveFailures: 3,
    activeOutageId: first - CHECK_INTERVAL_MS,
  };
  const afterGap = transitionAfterProbe({ prior, scheduledAt: first + (3 * CHECK_INTERVAL_MS), status: 'failed', gapSlots: 2 });
  assert.equal(afterGap.next.consecutiveFailures, 1);
  assert.equal(afterGap.openedOutageId, null);
  assert.equal(afterGap.next.activeOutageId, null);

  const postGapSecond = transitionAfterProbe({ prior: afterGap.next, scheduledAt: first + (4 * CHECK_INTERVAL_MS), status: 'failed', gapSlots: 0 });
  const postGapThird = transitionAfterProbe({ prior: postGapSecond.next, scheduledAt: first + (5 * CHECK_INTERVAL_MS), status: 'failed', gapSlots: 0 });
  assert.equal(postGapThird.openedOutageId, first + (5 * CHECK_INTERVAL_MS));
});

test('a delivered prior incident cannot block a new post-gap outage', () => {
  const first = 1_000_000_000;
  const prior = {
    ...EMPTY_MONITOR_STATE,
    lastScheduledAt: first,
    consecutiveFailures: 7,
    activeOutageId: first - CHECK_INTERVAL_MS,
  };
  const afterGap = transitionAfterProbe({ prior, scheduledAt: first + (3 * CHECK_INTERVAL_MS), status: 'failed', gapSlots: 2 });
  assert.deepEqual(afterGap.next, {
    lastScheduledAt: first + (3 * CHECK_INTERVAL_MS),
    consecutiveFailures: 1,
    activeOutageId: null,
  });

  const postGapSecond = transitionAfterProbe({ prior: afterGap.next, scheduledAt: first + (4 * CHECK_INTERVAL_MS), status: 'failed', gapSlots: 0 });
  const postGapThird = transitionAfterProbe({ prior: postGapSecond.next, scheduledAt: first + (5 * CHECK_INTERVAL_MS), status: 'failed', gapSlots: 0 });
  assert.equal(postGapThird.openedOutageId, first + (5 * CHECK_INTERVAL_MS));
});

test('a failed alert delivery remains eligible after recovery or a scheduler gap', () => {
  const first = 1_000_000_000;
  const pending = { outageId: first, openedAt: first, deliveredAt: null, retryAt: first + CHECK_INTERVAL_MS };
  const recovered = transitionAfterProbe({
    prior: { ...EMPTY_MONITOR_STATE, lastScheduledAt: first, consecutiveFailures: 3, activeOutageId: first },
    scheduledAt: first + CHECK_INTERVAL_MS,
    status: 'ok',
    gapSlots: 0,
  });
  assert.equal(recovered.next.activeOutageId, null);
  assert.equal(selectPendingDelivery([pending], first + CHECK_INTERVAL_MS)?.outageId, first);
  assert.equal(selectPendingDelivery([pending], first + (3 * CHECK_INTERVAL_MS))?.outageId, first);
  assert.equal(selectPendingDelivery([{ ...pending, deliveredAt: first + CHECK_INTERVAL_MS }], first + (3 * CHECK_INTERVAL_MS)), null);
});

test('a gap makes availability unknown instead of healthy', () => {
  assert.equal(availabilityForWindow([{ status: 'ok', gapSlots: 0 }, { status: 'ok', gapSlots: 2 }]), null);
  assert.equal(availabilityForWindow([{ status: 'ok', gapSlots: 0 }, { status: 'failed', gapSlots: 0 }]), 50);
});

test('retention removes samples older than exactly thirty days', () => {
  const checkedAt = 2_000_000_000;
  assert.equal(retentionCutoff(checkedAt), checkedAt - HISTORY_RETENTION_MS);
});
