// Load .env.local before anything else
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Worker, UnrecoverableError } from "bullmq";
import IORedis from "ioredis";
import mongoose from "mongoose";
import type { ModerationJobData, IllustrationJobData } from "./queue";
import { enqueueIllustration, closeQueues } from "./queue";
import { describeScene, renderImage } from "@/lib/ai/illustrate";
import { uploadStoryImage, ensureConfigured as ensureCloudinaryConfigured } from "@/lib/cloudinary";
import { runSafetyAgent } from "@/lib/agents/safetyAgent";
import { runRelevanceAgent } from "@/lib/agents/relevanceAgent";
import { runQualityAgent } from "@/lib/agents/qualityAgent";
import { runOrchestrator } from "@/lib/agents/orchestrator";
import { Story } from "@/models/Story";
import { ModerationLog } from "@/models/ModerationLog";
import { sendApprovalEmail, sendRejectionEmail } from "@/lib/email";
import { ThemeTag } from "@/types";

const workerConnections: IORedis[] = [];

function concurrency(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error(`${name} must be an integer from 1 to 20`);
  return value;
}

async function ensureDBConnected() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
}

function createRedisConnection() {
  const url = process.env.REDIS_URL!;
  const connection = new IORedis(url, {
    maxRetriesPerRequest: null,
    tls: url.startsWith("rediss://") ? {} : undefined,
  });
  connection.on("error", () => console.error("[Worker] Redis connection unavailable"));
  workerConnections.push(connection);
  return connection;
}

const worker = new Worker<ModerationJobData>(
  "moderation",
  async (job) => {
    const { storyId, storyTitle, storyBody, storyThemes, userEmail, submittedAt } = job.data;
    const start = Date.now();

    await ensureDBConnected();
    const current = await Story.findOne({ _id: storyId, status: "pending" });
    if (!current || (submittedAt && current.submitted_at.toISOString() !== submittedAt) || current.body !== storyBody || current.title !== storyTitle || JSON.stringify(current.theme) !== JSON.stringify(storyThemes)) {
      return { skipped: true };
    }
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
    const update = await Story.updateOne({ _id: storyId, status: "pending", body: storyBody, title: storyTitle, theme: storyThemes, ...(submittedAt ? { submitted_at: new Date(submittedAt) } : {}) }, {
      status: verdict.status,
      published_at: publishedAt,
    });
    // An administrator may have reviewed the story while AI checks were running.
    if (!update.modifiedCount) return { skipped: true };

    if (verdict.status === "approved") {
      try {
        await Story.findByIdAndUpdate(storyId, { image_status: "pending" });
        await enqueueIllustration(storyId);
      } catch (err) {
        // Never let an illustration problem affect moderation
        console.error(`[Worker] Failed to queue illustration for ${storyId}:`, err);
      }
    }

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
  { connection: createRedisConnection(), concurrency: concurrency("MODERATION_CONCURRENCY", 3) }
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

const illustrationWorker = new Worker<IllustrationJobData>(
  "illustration",
  async (job) => {
    const { storyId } = job.data;
    await ensureDBConnected();

    const story = await Story.findById(storyId);
    if (!story || story.status !== "approved") {
      console.log(`[Illustrator] Skipping ${storyId} — not an approved story`);
      return;
    }

    // Don't spend on image generation if there's nowhere to store the result;
    // a config problem won't fix itself on retry.
    try {
      ensureCloudinaryConfigured();
    } catch (err) {
      await Story.findByIdAndUpdate(storyId, { image_status: "failed" });
      throw new UnrecoverableError((err as Error).message);
    }

    const start = Date.now();
    console.log(`[Illustrator] Illustrating "${story.title}"`);
    try {
      const scene = await describeScene(story.title, story.body);
      console.log(`[Illustrator] Scene: ${scene}`);
      const image = await renderImage(scene);
      const url = await uploadStoryImage(image, storyId);
      await Story.findByIdAndUpdate(storyId, {
        image_url: url,
        image_status: "ready",
      });
      console.log(`[Illustrator] ${storyId} → ready in ${Date.now() - start}ms`);
    } catch (err) {
      // Only mark failed after the last retry; keep any previous image
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await Story.findByIdAndUpdate(storyId, { image_status: "failed" });
      }
      throw err;
    }
  },
  { connection: createRedisConnection(), concurrency: concurrency("ILLUSTRATION_CONCURRENCY", 2) }
);

illustrationWorker.on("failed", (job, err) => {
  console.error(`[Illustrator] Job ${job?.id} failed:`, err.message);
});

illustrationWorker.on("error", (err) => {
  console.error("[Illustrator] Worker error:", err);
});

console.log("[Worker] Heart Witness moderation worker started");

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Worker] ${signal}: finishing active jobs before shutdown`);
  // A host may eventually force-kill a job; BullMQ will recover stalled jobs.
  try {
    await Promise.all([worker.close(), illustrationWorker.close()]);
    await closeQueues();
    for (const connection of workerConnections) connection.disconnect();
    await mongoose.disconnect();
    process.exit(0);
  } catch {
    console.error("[Worker] Graceful shutdown failed");
    process.exit(1);
  }
}
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("SIGINT", () => { void shutdown("SIGINT"); });
