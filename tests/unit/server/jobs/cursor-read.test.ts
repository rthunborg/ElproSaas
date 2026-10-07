import { test } from "node:test";
import assert from "node:assert/strict";
import { readCursor, CURSOR_READ_MAX_ATTEMPTS, type CursorReadOptions } from "@/server/jobs/cursor-read";

function fixture(budget = 1_000) {
  let elapsed = 0;
  const controller = new AbortController();
  const waits: number[] = [];
  const options: CursorReadOptions = {
    scope: "producer", deadline: new Date(budget), signal: controller.signal,
    now: () => new Date(elapsed),
    wait: async (ms) => { waits.push(ms); elapsed += ms; },
  };
  return { options, waits, controller, advance: (ms: number) => { elapsed += ms; } };
}

test("cursor reads recover from recognized HTTP failures with fixed fake-time waits", async () => {
  for (const status of [408, 429, 500, 502, 503, 504]) {
    const f = fixture();
    let attempts = 0;
    const data = await readCursor(async (signal) => {
      assert.equal(signal.aborted, false);
      attempts += 1;
      return attempts < 3 ? { data: null, error: { message: "private-data", code: String(status) }, status } : { data: "checkpoint", error: null, status: 200 };
    }, f.options);
    assert.equal(data, "checkpoint");
    assert.equal(attempts, 3);
    assert.deepEqual(f.waits, [100, 200]);
  }
});

test("permanent SQL/auth/validation and unknown failures never retry or leak upstream content", async () => {
  for (const [status, code] of [[401, undefined], [403, undefined], [400, "22023"], [503, "42501"], [503, "22P02"], [503, "PGRST999"], [503, "private-code"], [0, undefined], [599, undefined]] as const) {
    const f = fixture(); let attempts = 0;
    await assert.rejects(readCursor(async () => { attempts += 1; return { data: null, error: { message: "secret tenant-id customer cursor", code }, status }; }, f.options), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /^Cursor read failed \(producer; (non_transient|unknown)(; HTTP (400|401|403|503))?\)$/);
      return true;
    });
    assert.equal(attempts, 1); assert.deepEqual(f.waits, []);
  }
  const f = fixture();
  await assert.rejects(readCursor(async () => { throw new Error("Bearer private-token"); }, f.options), /^CursorReadError: Cursor read failed \(producer; unknown\)$/);
});

test("transient exhaustion reports only allow-listed status at the fixed attempt bound", async () => {
  const f = fixture(); let attempts = 0;
  await assert.rejects(readCursor(async () => { attempts += 1; return { data: null, error: { message: "secret" }, status: 504 }; }, f.options), /producer; transient_exhausted; HTTP 504/);
  assert.equal(attempts, CURSOR_READ_MAX_ATTEMPTS);
  assert.deepEqual(f.waits, [100, 200]);
});

test("deadline expiry before reads, during backoff, and during successful reads prevents further dispatch", async () => {
  for (const phase of ["before", "insufficient", "wait", "read"] as const) {
    const f = fixture(phase === "insufficient" ? 100 : 1_000); let attempts = 0;
    if (phase === "before") f.advance(1_000);
    await assert.rejects(readCursor(async () => {
      attempts += 1;
      if (phase === "read") { f.advance(1_000); return { data: "must-not-use", error: null }; }
      return { data: null, error: {}, status: 504 };
    }, { ...f.options, wait: async () => { f.advance(1_000); } }), /producer; deadline/);
    assert.equal(attempts, phase === "before" ? 0 : 1);
  }
});

test("cancellation before reads, during fake backoff, and during successful reads prevents retries", async () => {
  for (const phase of ["before", "wait", "read"] as const) {
    const f = fixture(); let attempts = 0;
    if (phase === "before") f.controller.abort();
    await assert.rejects(readCursor(async () => {
      attempts += 1;
      if (phase === "read") { f.controller.abort(); return { data: "must-not-use", error: null }; }
      return { data: null, error: {}, status: 504 };
    }, { ...f.options, wait: async () => { f.controller.abort(); } }), /producer; cancelled/);
    assert.equal(attempts, phase === "before" ? 0 : 1);
  }
});

test("real retry timer and unresolved transport stop promptly on cancellation", async () => {
  for (const phase of ["wait", "read"] as const) {
    const f = fixture(); let attempts = 0; let transportSignal: AbortSignal | undefined;
    const promise = readCursor((signal) => {
      attempts += 1; transportSignal = signal;
      if (phase === "read") return new Promise(() => undefined);
      setTimeout(() => f.controller.abort(), 5);
      return Promise.resolve({ data: null, error: {}, status: 504 });
    }, { ...f.options, wait: undefined });
    if (phase === "read") f.controller.abort();
    await assert.rejects(promise, /producer; cancelled/);
    assert.equal(attempts, 1); assert.equal(transportSignal?.aborted, true);
  }
});

test("an unresolved transport is bounded even if it ignores its deadline signal", async () => {
  const f = fixture(5);
  let signal: AbortSignal | undefined;
  await assert.rejects(readCursor((readSignal) => { signal = readSignal; return new Promise(() => undefined); }, f.options), /producer; deadline/);
  assert.equal(signal?.aborted, true);
});

test("successful empty cursor SELECT is the only normal empty state", async () => {
  const f = fixture();
  assert.deepEqual(await readCursor(async () => ({ data: [], error: null, status: 200 }), f.options), []);
});
