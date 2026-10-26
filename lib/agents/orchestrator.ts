import {
  SafetyResult,
  RelevanceResult,
  QualityResult,
  OrchestratorVerdict,
  StoryStatus,
} from "@/types";

export function runOrchestrator(
  safety: SafetyResult,
  relevance: RelevanceResult,
  quality: QualityResult
): OrchestratorVerdict {
  let status: StoryStatus;
  let reason: string;

  const hasAgentError =
    safety.flags.includes("agent_error") ||
    relevance.reason === "agent_error" ||
    quality.reason === "agent_error";

  if (hasAgentError) {
    // If any agent errored, send to human review rather than auto-rejecting
    // (checked first because a failed safety agent reports safe: false)
    status = "human_review";
    reason = "Automated moderation could not complete — needs human review";
  } else if (!safety.safe) {
    // Hard rejection — safety violations always reject immediately
    status = "rejected";
    reason = `Content policy violation: ${safety.flags.join(", ")}`;
  } else if (quality.obvious_junk) {
    // Only clear-cut spam/test/gibberish is auto-rejected on quality grounds
    status = "rejected";
    reason = `Not a genuine story submission: ${quality.reason}`;
  } else if (!relevance.relevant && relevance.theme_confidence < 0.3) {
    status = "rejected";
    reason = `Story does not appear to be about kindness, gratitude, love, or respect: ${relevance.reason}`;
  } else if (!quality.quality_pass || !relevance.relevant) {
    // Judgement calls go to a person rather than being rejected by the AI
    status = "human_review";
    const concerns: string[] = [];
    if (!quality.quality_pass) concerns.push(`Quality uncertain: ${quality.reason}`);
    if (!relevance.relevant) {
      concerns.push(
        `Theme relevance uncertain (confidence: ${relevance.theme_confidence.toFixed(2)}): ${relevance.reason}`
      );
    }
    reason = concerns.join(" · ");
  } else {
    status = "approved";
    reason = "All moderation checks passed";
  }

  return { status, reason, safety, relevance, quality };
}
