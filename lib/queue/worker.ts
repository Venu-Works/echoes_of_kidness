// Load .env.local before anything else
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import mongoose from "mongoose";
import type { ModerationJobData, IllustrationJobData } from "./queue";
import { enqueueIllustration, closeQueues } from "./queue";
import { PermanentJobError } from "./job";
import { describeQueueBackend, startWorker } from "./runner";
import { connectDB } from "@/lib/mongodb";
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

function concurrency(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error(`${name} must be an integer from 1 to 20`);
  return value;
}

async function ensureDBConnected() {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
}

console.log(`[Worker] ${describeQueueBackend()}`);

const worker = startWorker<ModerationJobData>(
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
        // Never let an illustration problem affect moderation. The story stays
        // "pending", so sweepOwedIllustrations() will queue it later.
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
        verdict_reason: verdict.reason,
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
  { concurrency: concurrency("MODERATION_CONCURRENCY", 3), label: "Worker" }
);

const illustrationWorker = startWorker<IllustrationJobData>(
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
      throw new PermanentJobError((err as Error).message);
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
      if (job.isLastAttempt) {
        await Story.findByIdAndUpdate(storyId, { image_status: "failed" });
      }
      throw err;
    }
  },
  { concurrency: concurrency("ILLUSTRATION_CONCURRENCY", 2), label: "Illustrator" }
);

console.log("[Worker] Heart Witness moderation worker started");

// Approved stories whose image job couldn't be queued (e.g. Redis was down
// when they were approved) stay image_status "pending". Queue them on start-up
// and periodically. This is a MongoDB query, so it costs no Redis commands
// unless something is owed, and the illustration jobId stops duplicates.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
async function sweepOwedIllustrations() {
  try {
    await ensureDBConnected();
    const owed = await Story.find({ status: "approved", image_status: "pending" })
      .select("_id")
      .limit(100)
      .lean();
    for (const story of owed) await enqueueIllustration(String(story._id));
    if (owed.length) console.log(`[Illustrator] Queued ${owed.length} owed illustration(s)`);
  } catch (err) {
    console.error("[Illustrator] Sweep for owed illustrations failed:", (err as Error).message);
  }
}
void sweepOwedIllustrations();
const sweepTimer = setInterval(() => void sweepOwedIllustrations(), SWEEP_INTERVAL_MS);

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(sweepTimer);
  console.log(`[Worker] ${signal}: finishing active jobs before shutdown`);
  // A host may eventually force-kill a job; both queue backends recover
  // abandoned jobs.
  try {
    await Promise.all([worker.close(), illustrationWorker.close()]);
    await closeQueues();
    await mongoose.disconnect();
    process.exit(0);
  } catch {
    console.error("[Worker] Graceful shutdown failed");
    process.exit(1);
  }
}
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("SIGINT", () => { void shutdown("SIGINT"); });
