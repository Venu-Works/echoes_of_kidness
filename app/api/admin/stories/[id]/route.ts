import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { connectDB } from "@/lib/mongodb";
import { Story } from "@/models/Story";
import { ModerationLog } from "@/models/ModerationLog";
import { User } from "@/models/User";
import { sendApprovalEmail } from "@/lib/email";
import { enqueueIllustration } from "@/lib/queue/queue";

const ActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Moderators and admins may approve/reject
  const { access, error } = await requireStaff("moderate");
  if (error) return error;

  const body = await req.json();
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await connectDB();

  const approving = parsed.data.action === "approve";
  const update: Record<string, unknown> = approving
    ? { status: "approved", published_at: new Date(), image_status: "pending" }
    : { status: "rejected" };
  // Admins can approve stories waiting for review or overturn an AI
  // rejection; rejecting only applies to stories still waiting for review.
  const allowedFrom = approving ? ["human_review", "rejected"] : ["human_review"];

  let story;
  try {
    story = await Story.findOneAndUpdate(
      { _id: id, status: { $in: allowedFrom } },
      update,
      { new: true }
    );
  } catch {
    return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  }

  if (!story) {
    const exists = await Story.exists({ _id: id });
    return exists
      ? NextResponse.json(
          { error: "This story has already been decided or was edited by its author" },
          { status: 409 }
        )
      : NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  await ModerationLog.updateOne(
    { story_id: story._id },
    {
      admin_decision: approving ? "approved" : "rejected",
      admin_decided_by: access.email,
      admin_decided_at: new Date(),
    }
  );

  let imageQueued = false;
  if (approving) {
    try {
      await enqueueIllustration(id);
      imageQueued = true;
    } catch (err) {
      // Approval still stands. image_status stays "pending", so the worker's
      // periodic sweep queues the image once the queue is reachable again.
      console.error("[Admin API] Failed to queue illustration:", err);
    }

    // Tell the author, as the worker does for stories the AI approves.
    // Guest submissions have no account and so no email address.
    // sendApprovalEmail logs and swallows its own errors, so a mail problem
    // never undoes the approval.
    if (story.user_id) {
      const author = await User.findById(story.user_id).select("email").lean<{ email?: string }>();
      if (author?.email) await sendApprovalEmail(author.email, story.title, id);
    }
  }

  return NextResponse.json({ success: true, status: story.status, image_queued: imageQueued });
}
