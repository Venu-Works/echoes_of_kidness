import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/staff";
import { connectDB } from "@/lib/mongodb";
import { Story } from "@/models/Story";
import { ModerationLog } from "@/models/ModerationLog";

export async function GET(req: NextRequest) {
  const { error } = await requireStaff("moderate");
  if (error) return error;

  await connectDB();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 20;

  const [stories, total] = await Promise.all([
    Story.find({ status: "human_review" })
      .sort({ submitted_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Story.countDocuments({ status: "human_review" }),
  ]);

  // Attach moderation logs
  const storyIds = stories.map((s) => s._id);
  const logs = await ModerationLog.find({
    story_id: { $in: storyIds },
  }).lean();

  const logsByStoryId = Object.fromEntries(
    logs.map((l) => [String(l.story_id), l])
  );

  const enriched = stories.map((s) => ({
    ...s,
    moderation_log: logsByStoryId[String(s._id)] ?? null,
  }));

  return NextResponse.json({
    stories: enriched,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
