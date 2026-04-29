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

  if (!safety.safe) {
    // Hard rejection — safety violations always reject immediately
    status = "rejected";
    reason = `Content policy violation: ${safety.flags.join(", ")}`;
  } else if (hasAgentError) {
    // If any agent errored, send to human review rather than auto-rejecting
    status = "human_review";
    reason = "Automated moderation could not complete — needs human review";
  } else if (!quality.quality_pass) {
    status = "rejected";
    reason = `Quality check failed: ${quality.reason}`;
  } else if (!relevance.relevant) {
    // Low confidence → hard reject; borderline → human review
    if (relevance.theme_confidence < 0.3) {
      status = "rejected";
      reason = `Story does not appear to be about love, respect, or gratitude: ${relevance.reason}`;
    } else {
      status = "human_review";
      reason = `Theme relevance uncertain (confidence: ${relevance.theme_confidence.toFixed(2)}): ${relevance.reason}`;
    }
  } else {
    status = "approved";
    reason = "All moderation checks passed";
  }

  return { status, reason, safety, relevance, quality };
}
