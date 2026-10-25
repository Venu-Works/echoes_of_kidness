import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Story } from "@/models/Story";
import { getModerationQueue } from "@/lib/queue/queue";
import { checkRateLimit } from "@/lib/rateLimit";
import { moderationJobId } from "@/lib/queue/jobId";

const SubmitStorySchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  body: z.string().min(50, "Story must be at least 50 words"),
  theme: z
    .array(z.enum(["love", "respect", "gratitude", "kindness"]))
    .min(1, "Select at least one theme")
    .max(4),
  display_name: z.string().min(1).max(100),
  post_as_anonymous: z.boolean().optional(),
});

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function GET(req: NextRequest) {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const theme = searchParams.get("theme");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 12;

  const query: Record<string, unknown> = { status: "approved" };
  if (theme && ["love", "respect", "gratitude", "kindness"].includes(theme)) {
    query.theme = theme;
  }

  const [stories, total] = await Promise.all([
    Story.find(query)
      .sort({ published_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-body")
      .lean(),
    Story.countDocuments(query),
  ]);

  return NextResponse.json({
    stories,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id ?? null;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SubmitStorySchema.safeParse(body);
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

  if (process.env.NODE_ENV === "production") {
    // Vercel supplies this trusted header. Other hosts must sanitize it at their proxy.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim();
    const key = userId ? `user:${userId}` : ip ? `ip:${ip}` : "unknown";
    try {
      const limit = await checkRateLimit(key);
      if (!limit.allowed) return NextResponse.json(
        { error: "Please wait before submitting another story." },
        { status: 429, headers: { "Retry-After": String(limit.resetIn) } }
      );
    } catch {
      return NextResponse.json({ error: "Submissions are temporarily unavailable. Please try again shortly." }, { status: 503 });
    }
  }

  await connectDB();

  const displayName = parsed.data.post_as_anonymous
    ? "Anonymous"
    : parsed.data.display_name;

  const story = await Story.create({
    user_id: userId,
    display_name: displayName,
    title: parsed.data.title,
    body: parsed.data.body,
    theme: parsed.data.theme,
    word_count: wordCount,
    status: "pending",
    submitted_at: new Date(),
  });

  try {
    await getModerationQueue().add("moderate-story", {
      storyId: story._id.toString(),
      storyTitle: story.title,
      storyBody: story.body,
      storyThemes: story.theme,
      userEmail: session?.user?.email ?? undefined,
      submittedAt: story.submitted_at.toISOString(),
    }, { jobId: moderationJobId(String(story._id), story.body, story.title, story.theme, story.submitted_at.toISOString()) });
  } catch (err) {
    console.error("[Stories API] Failed to enqueue moderation job:", err);
    // Story is saved as "pending" — can be processed manually if queue fails
  }

  return NextResponse.json(
    {
      message:
        "Your story has been submitted! It will be reviewed shortly.",
      storyId: story._id.toString(),
    },
    { status: 201 }
  );
}
