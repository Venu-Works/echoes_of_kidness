import test from "node:test";
import assert from "node:assert/strict";
import { validateEnvironment } from "../scripts/environment.mjs";
import { moderationJobId } from "../lib/queue/jobId";

const web = {
  MONGODB_URI: "mongodb://localhost:27017/test",
  REDIS_URL: "redis://localhost:6379",
  SITE_URL: "https://stories.example.com",
  NEXTAUTH_URL: "https://stories.example.com",
  NEXTAUTH_SECRET: "a-generated-secret-with-more-than-32-characters",
  ADMIN_EMAILS: "admin@example.com",
};
const worker = {
  ...web, AI_PROVIDER: "claude", ANTHROPIC_API_KEY: "test-key",
  GEMINI_API_KEY: "test-key", CLOUDINARY_CLOUD_NAME: "test",
  CLOUDINARY_API_KEY: "test", CLOUDINARY_API_SECRET: "test",
  RESEND_API_KEY: "test", EMAIL_FROM: "Heart Witness <noreply@example.com>",
};

test("production web configuration accepts matching public origins", () => {
  assert.deepEqual(validateEnvironment(web, "web", true), []);
});
test("production rejects localhost and mismatched auth/share domains", () => {
  const errors = validateEnvironment({ ...web, SITE_URL: "http://localhost:3000" }, "web", true);
  assert.ok(errors.some((error) => error.includes("public HTTPS")));
  assert.ok(errors.some((error) => error.includes("same origin")));
});
test("invalid configuration messages never include credential values", () => {
  const secret = "sensitive-invalid-uri";
  const errors = validateEnvironment({ ...web, MONGODB_URI: secret }, "web", true);
  assert.ok(errors.some((error) => error.includes("MONGODB_URI")));
  assert.ok(errors.every((error) => !error.includes(secret)));
});

test("MongoDB replica-set and SRV connection strings pass syntax validation without connecting", () => {
  for (const uri of [
    "mongodb://user:password@db1.example.com:27017,db2.example.com:27017/stories?replicaSet=rs0&authSource=admin",
    "mongodb+srv://user:password@cluster.example.com/stories?retryWrites=true&w=majority",
  ]) assert.deepEqual(validateEnvironment({ ...web, MONGODB_URI: uri }, "web", true), []);
});

test("masked or malformed service connection values fail validation", () => {
  const errors = validateEnvironment({ ...web, MONGODB_URI: "[SENSITIVE]", REDIS_URL: "[SENSITIVE]", NEXTAUTH_SECRET: "[SENSITIVE]" }, "web", true);
  for (const key of ["MONGODB_URI", "REDIS_URL", "NEXTAUTH_SECRET"]) assert.ok(errors.some((error) => error.includes(key)));
});
test("production rejects a missing or short auth secret", () => {
  for (const secret of ["", "short", "replace-this-with-a-longer-example-secret"]) {
    assert.ok(validateEnvironment({ ...web, NEXTAUTH_SECRET: secret }, "web", true).some((error) => error.includes("NEXTAUTH_SECRET")));
  }
});
test("origins cannot contain credentials or unexpected paths", () => {
  for (const origin of ["https://user:pass@example.com", "https://example.com/stories", "https://example.com?key=secret"]) {
    assert.ok(validateEnvironment({ ...web, SITE_URL: origin }, "web", true).some((error) => error.includes("SITE_URL must")));
  }
});
test("worker validates provider-specific credentials and illustration credentials", () => {
  assert.deepEqual(validateEnvironment(worker, "worker", true), []);
  assert.ok(validateEnvironment({ ...worker, GEMINI_API_KEY: "" }, "worker", true).some((error) => error.includes("GEMINI_API_KEY")));
  assert.deepEqual(validateEnvironment({ ...worker, AI_PROVIDER: "gemini", ANTHROPIC_API_KEY: "" }, "worker", true), []);
});
test("worker rejects unsupported providers and unsafe concurrency", () => {
  assert.ok(validateEnvironment({ ...worker, AI_PROVIDER: "typo" }, "worker", true).some((error) => error.includes("AI_PROVIDER")));
  for (const value of ["0", "-1", "1.5", "21", "many"]) {
    assert.ok(validateEnvironment({ ...worker, MODERATION_CONCURRENCY: value }, "worker", true).some((error) => error.includes("MODERATION_CONCURRENCY")));
  }
});
test("the Mongo queue backend needs no Redis, while the default still requires it", () => {
  const { REDIS_URL: _unused, ...withoutRedis } = worker;
  void _unused;
  assert.ok(validateEnvironment(withoutRedis, "worker", true).some((error) => error.includes("REDIS_URL is required")));
  assert.deepEqual(validateEnvironment({ ...withoutRedis, QUEUE_BACKEND: "mongo" }, "worker", true), []);
  const { REDIS_URL: _unusedWeb, ...webWithoutRedis } = web;
  void _unusedWeb;
  assert.deepEqual(validateEnvironment({ ...webWithoutRedis, QUEUE_BACKEND: "mongo" }, "web", true), []);
});
test("unknown queue backends and unsafe Mongo poll intervals are rejected", () => {
  assert.ok(validateEnvironment({ ...worker, QUEUE_BACKEND: "mongodb" }, "worker", true).some((error) => error.includes("QUEUE_BACKEND")));
  for (const value of ["0", "61", "soon"]) {
    assert.ok(validateEnvironment({ ...worker, QUEUE_BACKEND: "mongo", MONGO_QUEUE_POLL_SECONDS: value }, "worker", true).some((error) => error.includes("MONGO_QUEUE_POLL_SECONDS")));
  }
});
test("worker rejects polling settings outside the supported range", () => {
  assert.deepEqual(validateEnvironment({ ...worker, WORKER_IDLE_WAIT_SECONDS: "120", WORKER_STALLED_CHECK_SECONDS: "300" }, "worker", true), []);
  for (const value of ["4", "601", "abc"]) {
    assert.ok(validateEnvironment({ ...worker, WORKER_IDLE_WAIT_SECONDS: value }, "worker", true).some((error) => error.includes("WORKER_IDLE_WAIT_SECONDS")));
  }
  for (const value of ["10", "3601"]) {
    assert.ok(validateEnvironment({ ...worker, WORKER_STALLED_CHECK_SECONDS: value }, "worker", true).some((error) => error.includes("WORKER_STALLED_CHECK_SECONDS")));
  }
});

test("worker can start with email explicitly disabled and no Resend configuration", () => {
  assert.deepEqual(validateEnvironment({ ...worker, EMAIL_ENABLED: "false", RESEND_API_KEY: "", EMAIL_FROM: "" }, "worker", true), []);
});
test("email credentials remain required by default or when enabled", () => {
  for (const enabled of [undefined, "true"]) {
    const errors = validateEnvironment({ ...worker, EMAIL_ENABLED: enabled, RESEND_API_KEY: "", EMAIL_FROM: "" }, "worker", true);
    assert.ok(errors.some((error) => error.includes("RESEND_API_KEY")));
    assert.ok(errors.some((error) => error.includes("EMAIL_FROM")));
  }
});
test("typos in the email switch cannot silently disable notifications", () => {
  assert.ok(validateEnvironment({ ...worker, EMAIL_ENABLED: "flase" }, "worker", true).some((error) => error.includes("EMAIL_ENABLED")));
});
test("recovering the same submission uses the same queue ID", () => {
  assert.equal(moderationJobId("story-1", "body", "title", ["love"]), moderationJobId("story-1", "body", "title", ["love"]));
});
test("edits and different stories receive distinct queue IDs", () => {
  const original = moderationJobId("story-1", "body", "title", ["love"]);
  for (const next of [
    moderationJobId("story-2", "body", "title", ["love"]),
    moderationJobId("story-1", "edited", "title", ["love"]),
    moderationJobId("story-1", "body", "edited", ["love"]),
    moderationJobId("story-1", "body", "title", ["respect"]),
  ]) assert.notEqual(next, original);
  assert.ok(!original.includes(":"));
});

test("an unchanged resubmission gets a fresh job while recovery deduplicates its revision", () => {
  const first = moderationJobId("story-1", "body", "title", ["love"], "2026-10-24T01:00:00.000Z");
  const retry = moderationJobId("story-1", "body", "title", ["love"], "2026-10-24T02:00:00.000Z");
  assert.notEqual(first, retry);
  assert.equal(retry, moderationJobId("story-1", "body", "title", ["love"], "2026-10-24T02:00:00.000Z"));
});
