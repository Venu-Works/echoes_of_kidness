import { connectDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import { Story } from "@/models/Story";
import { User } from "@/models/User";
import {
  closeQueues, enqueueModeration, moderationJobState,
  moderationStoryIdsInFlight, retryFailedModerationJob,
} from "@/lib/queue/queue";
import { moderationJobId } from "@/lib/queue/jobId";

// Dry run by default. --apply queues missing jobs; --retry-failed also retries failures.
async function main() {
  const apply = process.argv.includes("--apply");
  const retryFailed = process.argv.includes("--retry-failed");
  await connectDB();
  const inFlight = await moderationStoryIdsInFlight();
  const stories = Story.find({ status: "pending", submitted_at: { $lt: new Date(Date.now() - 120_000) } }).cursor();
  let candidates = 0;
  for await (const story of stories) {
    const storyId = String(story._id);
    if (inFlight.has(storyId)) continue;
    const submittedAt = story.submitted_at.toISOString();
    const jobId = moderationJobId(storyId, story.body, story.title, story.theme, submittedAt);
    const state = await moderationJobState(jobId);
    if (state && !(retryFailed && state === "failed")) {
      console.log(`Skipped ${storyId}: existing job is ${state}; inspect manually`);
      continue;
    }
    candidates++;
    console.log(`${apply ? "Recovering" : "Would recover"} ${storyId}${state ? " (failed job)" : " (missing job)"}`);
    if (!apply) continue;
    if (state) {
      await retryFailedModerationJob(jobId);
    } else {
      const user = story.user_id ? await User.findById(story.user_id).select("email") : null;
      await enqueueModeration({
        storyId, storyTitle: story.title, storyBody: story.body,
        storyThemes: story.theme, userEmail: user?.email, submittedAt,
      }, jobId);
    }
  }
  console.log(`${candidates} recovery candidates. ${apply ? "Recovery applied." : "Dry run only. Use --apply to enqueue."}`);
}

main().catch(() => {
  console.error("Recovery failed. Check database/queue connectivity and worker logs.");
  process.exitCode = 1;
}).finally(async () => {
  await closeQueues();
  await mongoose.disconnect();
});
