import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { deployWorker } from "../scripts/deploy-render.mjs";

const require = createRequire(`${process.cwd()}/package.json`);
const yaml = require("js-yaml");
const commitId = "a".repeat(40);
const base = { apiKey: "test-secret", serviceId: "srv-test123", commitId, pause: async () => {}, attempts: 2 };

function responses(values: object[], calls: { url: string; body?: string }[]): typeof fetch {
  return async (url, options) => {
    calls.push({ url: String(url), body: options?.body as string | undefined });
    return new Response(JSON.stringify(values.shift()), { status: 200 });
  };
}

test("production workflow only starts on release tag pushes", () => {
  const workflow = yaml.load(readFileSync(".github/workflows/release.yml", "utf8"));
  assert.deepEqual(workflow.on, { push: { tags: ["v*"] } });
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  assert.equal(workflow.jobs.release.environment, "production");
  const steps = workflow.jobs.release.steps;
  assert.ok(steps.find((step: { run?: string }) => step.run?.includes("merge-base --is-ancestor")));
  const build = steps.findIndex((step: { id?: string }) => step.id === "stage");
  const worker = steps.findIndex((step: { name?: string }) => step.name === "Deploy tagged worker and wait until live");
  const promote = steps.findIndex((step: { name?: string }) => step.name === "Promote tagged web application");
  assert.ok(build >= 0 && build < worker && worker < promote);
  assert.ok(steps[build].run.includes("--prod --skip-domain"));
  assert.ok(steps[promote].run.includes('vercel promote "$DEPLOYMENT_URL"'));
  assert.ok(!steps.some((step: { run?: string }) => /^\s*vercel (pull|build)/m.test(step.run ?? "")));
});
test("host configs disable direct push deployments", () => {
  assert.equal(JSON.parse(readFileSync("vercel.json", "utf8")).git.deploymentEnabled, false);
  assert.equal(yaml.load(readFileSync("render.yaml", "utf8")).services[0].autoDeployTrigger, "off");
});
test("worker release deploys and confirms the exact tagged commit", async () => {
  const calls: { url: string; body?: string }[] = [];
  await deployWorker({ ...base, request: responses([
    { id: "dep-test123" }, { status: "build_in_progress" }, { status: "live", commit: { id: commitId } },
  ], calls) });
  assert.deepEqual(JSON.parse(calls[0].body!), { commitId });
  assert.equal(calls.length, 3);
});
test("wrong commit and failed worker deployments block release", async () => {
  for (const result of [{ status: "live", commit: { id: "b".repeat(40) } }, { status: "build_failed" }]) {
    await assert.rejects(deployWorker({ ...base, request: responses([{ id: "dep-test123" }, result], []) }));
  }
});
test("worker release times out instead of reporting a queued deployment as live", async () => {
  await assert.rejects(deployWorker({ ...base, attempts: 1, request: responses([{ id: "dep-test123" }, { status: "queued" }], []) }), /Timed out/);
});
test("invalid IDs cannot redirect deployment credentials to another URL", async () => {
  let requested = false;
  await assert.rejects(deployWorker({ ...base, serviceId: "../another-service", request: async () => { requested = true; return new Response(); } }));
  assert.equal(requested, false);
});
