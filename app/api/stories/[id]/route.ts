import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Story } from "@/models/Story";
import { enqueueModeration } from "@/lib/queue/queue";
import { moderationJobId } from "@/lib/queue/jobId";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await connectDB();

  let story;
  try {
    story = await Story.findOne({ _id: id, status: "approved" }).lean();
  } catch {
    return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  }

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  return NextResponse.json(story);
}

const EditStorySchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(50),
  theme: z.array(z.enum(["love", "respect", "gratitude", "kindness"])).min(1).max(4),
  display_name: z.string().min(1).max(100),
  post_as_anonymous: z.boolean().optional(),
});

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as { id: string }).id;

  const body = await req.json();
  const parsed = EditStorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const wordCount = countWords(parsed.data.body);
  if (wordCount < 50 || wordCount > 500) {
    return NextResponse.json(
      { error: "Story must contain between 50 and 500 words" },
      { status: 400 }
    );
  }

  await connectDB();

  // Only allow editing own rejected stories
  const story = await Story.findOne({ _id: id, user_id: userId, status: "rejected" });
  if (!story) {
    return NextResponse.json(
      { error: "Story not found or cannot be edited" },
      { status: 404 }
    );
  }

  const displayName = parsed.data.post_as_anonymous ? "Anonymous" : parsed.data.display_name;

  if (process.env.NODE_ENV === "production") {
    try {
      const limit = await checkRateLimit(`user:${userId}`);
      if (!limit.allowed) return NextResponse.json({ error: "Please wait before resubmitting." }, { status: 429, headers: { "Retry-After": String(limit.resetIn) } });
    } catch {
      return NextResponse.json({ error: "Submissions are temporarily unavailable." }, { status: 503 });
    }
  }

  story.title = parsed.data.title;
  story.body = parsed.data.body;
  story.theme = parsed.data.theme;
  story.display_name = displayName;
  story.word_count = wordCount;
  story.status = "pending";
  story.submitted_at = new Date();
  story.published_at = null;
  await story.save();

  try {
    await enqueueModeration({
      storyId: story._id.toString(),
      storyTitle: story.title,
      storyBody: story.body,
      storyThemes: story.theme,
      userEmail: session.user?.email ?? undefined,
      submittedAt: story.submitted_at.toISOString(),
    }, moderationJobId(String(story._id), story.body, story.title, story.theme, story.submitted_at.toISOString()));
  } catch (err) {
    console.error("[Stories API] Failed to enqueue moderation job:", err);
  }

  return NextResponse.json({ message: "Story resubmitted for review." });
}
