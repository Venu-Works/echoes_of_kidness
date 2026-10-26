// Queues illustrations for approved stories that don't have an image yet.
// Usage: npm run backfill-images            (the worker must be running)
//        npm run backfill-images -- --retry-failed   (also retry failed ones)
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import mongoose from "mongoose";
import { Story } from "@/models/Story";
import { enqueueIllustration, closeQueues } from "@/lib/queue/queue";

async function main() {
  const retryFailed = process.argv.includes("--retry-failed");
  await mongoose.connect(process.env.MONGODB_URI!);

  const statuses = retryFailed ? ["none", "failed"] : ["none"];
  const stories = await Story.find({
    status: "approved",
    $or: [
      { image_status: { $in: statuses } },
      { image_status: { $exists: false } },
    ],
  }).select("_id title");

  console.log(`Queuing ${stories.length} stories for illustration`);
  for (const story of stories) {
    await Story.findByIdAndUpdate(story._id, { image_status: "pending" });
    await enqueueIllustration(String(story._id));
    console.log(`  • ${story.title}`);
  }

  await closeQueues();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
