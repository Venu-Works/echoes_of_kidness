import test from "node:test";
import assert from "node:assert/strict";
import { mongoPollSeconds, QUEUE_SETTINGS, queueBackend } from "../lib/queue/config";
import { afterFailure, retryDelayMs } from "../lib/queue/job";

test("Redis stays the default queue backend", () => {
  assert.equal(queueBackend({}), "redis");
  assert.equal(queueBackend({ QUEUE_BACKEND: "" }), "redis");
  assert.equal(queueBackend({ QUEUE_BACKEND: "redis" }), "redis");
});

test("QUEUE_BACKEND=mongo switches to MongoDB, ignoring case and spaces", () => {
  assert.equal(queueBackend({ QUEUE_BACKEND: "mongo" }), "mongo");
  assert.equal(queueBackend({ QUEUE_BACKEND: " Mongo " }), "mongo");
});

test("a mistyped backend fails loudly instead of silently using Redis", () => {
  for (const value of ["mongodb", "rabbit", "true"]) {
    assert.throws(() => queueBackend({ QUEUE_BACKEND: value }), /QUEUE_BACKEND/);
  }
});

test("Mongo poll interval defaults to 5s and rejects unsafe values", () => {
  assert.equal(mongoPollSeconds({}), 5);
  assert.equal(mongoPollSeconds({ MONGO_QUEUE_POLL_SECONDS: "10" }), 10);
  for (const value of ["0", "61", "soon"]) {
    assert.throws(() => mongoPollSeconds({ MONGO_QUEUE_POLL_SECONDS: value }), /MONGO_QUEUE_POLL_SECONDS/);
  }
});

test("retries back off exponentially like BullMQ", () => {
  const base = QUEUE_SETTINGS.moderation.backoffMs;
  assert.equal(retryDelayMs(base, 1), base);
  assert.equal(retryDelayMs(base, 2), base * 2);
  assert.equal(retryDelayMs(base, 3), base * 4);
});

test("jobs retry until their attempts run out, and permanent errors never retry", () => {
  const { attempts } = QUEUE_SETTINGS.moderation;
  assert.equal(afterFailure(1, attempts, false), "retry");
  assert.equal(afterFailure(attempts, attempts, false), "fail");
  assert.equal(afterFailure(1, attempts, true), "fail");
});

test("illustration jobs are removed when finished so Regenerate can queue them again", () => {
  assert.equal(QUEUE_SETTINGS.illustration.keepCompleted, false);
  assert.equal(QUEUE_SETTINGS.illustration.keepFailed, false);
  assert.equal(QUEUE_SETTINGS.moderation.keepCompleted, true);
});
