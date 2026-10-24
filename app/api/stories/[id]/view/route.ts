import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Story } from "@/models/Story";

// Records one read of a story. Called from the browser once per session
// (see StoryEngagement), so page refreshes and most bots don't count.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await connectDB();

  let story;
  try {
    story = await Story.findOneAndUpdate(
      { _id: id, status: "approved" },
      { $inc: { read_count: 1 } },
      { new: true, projection: { read_count: 1 } }
    ).lean<{ read_count: number }>();
  } catch {
    return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  }

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  return NextResponse.json({ read_count: story.read_count });
}
