import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
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

const ActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
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

  const body = await req.json();
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await connectDB();

  const update: Record<string, unknown> =
    parsed.data.action === "approve"
      ? { status: "approved", published_at: new Date(), image_status: "pending" }
      : { status: "rejected" };

  const story = await Story.findByIdAndUpdate(id, update, {
    new: true,
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  if (parsed.data.action === "approve") {
    try {
      await enqueueIllustration(id);
    } catch (err) {
      // Approval still stands; the image can be regenerated later
      console.error("[Admin API] Failed to queue illustration:", err);
      await Story.findByIdAndUpdate(id, { image_status: "failed" });
    }
  }

  return NextResponse.json({ success: true, status: story.status });
}
