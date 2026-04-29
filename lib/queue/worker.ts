// Load .env.local before anything else
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Worker } from "bullmq";
import IORedis from "ioredis";
import mongoose from "mongoose";
import type { ModerationJobData } from "./queue";
import { runSafetyAgent } from "@/lib/agents/safetyAgent";
import { runRelevanceAgent } from "@/lib/agents/relevanceAgent";
import { runQualityAgent } from "@/lib/agents/qualityAgent";
import { runOrchestrator } from "@/lib/agents/orchestrator";
import { Story } from "@/models/Story";
import { ModerationLog } from "@/models/ModerationLog";
import { sendApprovalEmail, sendRejectionEmail } from "@/lib/email";
import { ThemeTag } from "@/types";

async function ensureDBConnected() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
}

function createRedisConnection() {
  const url = process.env.REDIS_URL!;
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    tls: url.startsWith("rediss://") ? {} : undefined,
  });
}

const worker = new Worker<ModerationJobData>(
  "moderation",
  async (job) => {
    const { storyId, storyTitle, storyBody, storyThemes, userEmail } = job.data;
    const start = Date.now();

    await ensureDBConnected();
    console.log(`[Worker] Processing story ${storyId}: "${storyTitle}"`);

    // Run agents sequentially so prompt cache warms up per-agent across requests
    const safety = await runSafetyAgent(storyBody);
    const relevance = await runRelevanceAgent(
      storyBody,
      storyTitle,
      storyThemes as ThemeTag[]
    );
    const quality = await runQualityAgent(storyBody);

    const verdict = runOrchestrator(safety, relevance, quality);
    const processingMs = Date.now() - start;

    console.log(
      `[Worker] Story ${storyId} → ${verdict.status} in ${processingMs}ms`
    );

    const publishedAt = verdict.status === "approved" ? new Date() : null;
    await Story.findByIdAndUpdate(storyId, {
      status: verdict.status,
      published_at: publishedAt,
    });

    await ModerationLog.findOneAndUpdate(
      { story_id: storyId },
      {
        story_id: storyId,
        safety_result: safety,
        relevance_result: relevance,
        quality_result: quality,
        final_verdict: verdict.status,
        processing_time_ms: processingMs,
        reviewed_at: new Date(),
      },
      { upsert: true }
    );

    if (userEmail) {
      if (verdict.status === "approved") {
        await sendApprovalEmail(userEmail, storyTitle, storyId);
      } else if (verdict.status === "rejected") {
        await sendRejectionEmail(userEmail, storyTitle, verdict.reason);
      }
      // No email for human_review — admin handles it
    }

    return verdict;
  },
  { connection: createRedisConnection(), concurrency: 3 }
);

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[Worker] Worker error:", err);
});

console.log("[Worker] Poppylat moderation worker started");
