import test from "node:test";
import assert from "node:assert/strict";
import { workerPollingOptions } from "../lib/queue/polling";

test("idle workers poll Redis far less often than BullMQ's defaults", () => {
  const options = workerPollingOptions({});
  assert.equal(options.drainDelay, 120); // BullMQ default is 5 seconds
  assert.equal(options.stalledInterval, 300_000); // BullMQ default is 30 seconds
});

test("polling can be tuned per deployment", () => {
  const options = workerPollingOptions({ WORKER_IDLE_WAIT_SECONDS: "60", WORKER_STALLED_CHECK_SECONDS: "600" });
  assert.equal(options.drainDelay, 60);
  assert.equal(options.stalledInterval, 600_000);
});

test("out-of-range or malformed polling settings stop the worker from starting", () => {
  for (const value of ["0", "4", "601", "abc"]) {
    assert.throws(() => workerPollingOptions({ WORKER_IDLE_WAIT_SECONDS: value }), /WORKER_IDLE_WAIT_SECONDS/);
  }
  for (const value of ["10", "3601", "soon"]) {
    assert.throws(() => workerPollingOptions({ WORKER_STALLED_CHECK_SECONDS: value }), /WORKER_STALLED_CHECK_SECONDS/);
  }
});
