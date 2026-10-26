import test from "node:test";
import assert from "node:assert/strict";
import { runOrchestrator } from "../lib/agents/orchestrator";
import type { QualityResult, RelevanceResult, SafetyResult } from "../types";

const safe: SafetyResult = { safe: true, flags: [], confidence: 1 };
const onTheme: RelevanceResult = { relevant: true, theme_confidence: 0.95, detected_themes: ["gratitude"], reason: "Clear gratitude" };
const good: QualityResult = { quality_pass: true, obvious_junk: false, coherent: true, reason: "Clear personal moment" };

test("all checks passing approves the story", () => {
  assert.equal(runOrchestrator(safe, onTheme, good).status, "approved");
});

test("a safety violation rejects even when everything else passes", () => {
  const verdict = runOrchestrator({ safe: false, flags: ["hate_speech"], confidence: 0.9 }, onTheme, good);
  assert.equal(verdict.status, "rejected");
  assert.match(verdict.reason, /hate_speech/);
});

test("obvious junk is rejected automatically", () => {
  const junk: QualityResult = { quality_pass: false, obvious_junk: true, coherent: false, reason: "Test submission" };
  const verdict = runOrchestrator(safe, onTheme, junk);
  assert.equal(verdict.status, "rejected");
  assert.match(verdict.reason, /Not a genuine story/);
});

test("a quality doubt goes to human review instead of being rejected", () => {
  const unsure: QualityResult = { quality_pass: false, obvious_junk: false, coherent: false, reason: "Two unrelated messages" };
  const verdict = runOrchestrator(safe, onTheme, unsure);
  assert.equal(verdict.status, "human_review");
  assert.match(verdict.reason, /Quality uncertain: Two unrelated messages/);
});

test("clearly off-theme stories are still rejected", () => {
  const offTheme: RelevanceResult = { relevant: false, theme_confidence: 0.1, detected_themes: [], reason: "Product review" };
  assert.equal(runOrchestrator(safe, offTheme, good).status, "rejected");
});

test("borderline theme and quality doubts are combined into one review reason", () => {
  const borderline: RelevanceResult = { relevant: false, theme_confidence: 0.55, detected_themes: [], reason: "Mostly travel" };
  const unsure: QualityResult = { quality_pass: false, obvious_junk: false, coherent: true, reason: "Rambling" };
  const verdict = runOrchestrator(safe, borderline, unsure);
  assert.equal(verdict.status, "human_review");
  assert.match(verdict.reason, /Quality uncertain: Rambling · Theme relevance uncertain \(confidence: 0\.55\)/);
});

test("an agent error goes to human review even though safety reports unsafe", () => {
  const errored: SafetyResult = { safe: false, flags: ["agent_error"], confidence: 0 };
  assert.equal(runOrchestrator(errored, onTheme, good).status, "human_review");
});
