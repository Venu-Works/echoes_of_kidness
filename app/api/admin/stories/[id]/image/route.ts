import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/staff";
import { connectDB } from "@/lib/mongodb";
import { Story } from "@/models/Story";
import { enqueueIllustration } from "@/lib/queue/queue";

// Regenerate the illustration for an approved story
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await requireStaff("moderate");
  if (error) return error;

  await connectDB();

  const story = await Story.findOneAndUpdate(
    { _id: id, status: "approved" },
    { image_status: "pending" },
    { new: true }
  );
  if (!story) {
    return NextResponse.json(
      { error: "Approved story not found" },
      { status: 404 }
    );
  }

  try {
    await enqueueIllustration(id);
  } catch (err) {
    // Leave image_status "pending": the worker's sweep will queue it later
    console.error("[Admin API] Failed to queue illustration:", err);
    return NextResponse.json(
      { error: "The image queue is unavailable right now — the image will be generated automatically once it's back" },
      { status: 503 }
    );
  }

  return NextResponse.json({ success: true, image_status: "pending" });
}
