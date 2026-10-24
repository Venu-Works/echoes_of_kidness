import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Story } from "@/models/Story";
import { enqueueIllustration } from "@/lib/queue/queue";

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

// Regenerate the illustration for an approved story
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (
    !session?.user?.email ||
    !getAdminEmails().includes(session.user.email)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

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
    console.error("[Admin API] Failed to queue illustration:", err);
    await Story.findByIdAndUpdate(id, { image_status: "failed" });
    return NextResponse.json(
      { error: "Could not queue image generation" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, image_status: "pending" });
}
