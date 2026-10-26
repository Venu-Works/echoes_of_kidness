import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { normalizeEmail, ownerEmails, requireStaff } from "@/lib/staff";
import { StaffMember } from "@/models/StaffMember";
import { listTeam } from "@/lib/team";

// Everything here is admin-only: moderators can review stories but not
// change who else can.

export async function GET() {
  const { error } = await requireStaff("manage-team");
  if (error) return error;
  return NextResponse.json({ team: await listTeam() });
}

const UpsertSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(254),
  role: z.enum(["moderator", "admin"]),
});

// Add someone, or change their role
export async function POST(req: NextRequest) {
  const { access, error } = await requireStaff("manage-team");
  if (error) return error;

  const parsed = UpsertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const email = normalizeEmail(parsed.data.email);

  if (ownerEmails().includes(email)) {
    return NextResponse.json(
      { error: "That person is an owner (set in the server's ADMIN_EMAILS) and already has full access" },
      { status: 400 }
    );
  }
  if (email === access.email) {
    return NextResponse.json({ error: "You can't change your own role" }, { status: 400 });
  }

  await connectDB();
  const existing = await StaffMember.findOne({ email });
  if (existing) {
    existing.role = parsed.data.role;
    existing.updated_by = access.email;
    existing.updated_at = new Date();
    await existing.save();
  } else {
    await StaffMember.create({ email, role: parsed.data.role, added_by: access.email });
  }

  return NextResponse.json({ team: await listTeam() });
}

const RemoveSchema = z.object({ email: z.string().trim().email() });

export async function DELETE(req: NextRequest) {
  const { access, error } = await requireStaff("manage-team");
  if (error) return error;

  const parsed = RemoveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const email = normalizeEmail(parsed.data.email);

  if (ownerEmails().includes(email)) {
    return NextResponse.json(
      { error: "Owners are set in the server's ADMIN_EMAILS and can't be removed here" },
      { status: 400 }
    );
  }
  if (email === access.email) {
    return NextResponse.json({ error: "You can't remove yourself" }, { status: 400 });
  }

  await connectDB();
  const removed = await StaffMember.deleteOne({ email });
  if (!removed.deletedCount) {
    return NextResponse.json({ error: "That person isn't on the team" }, { status: 404 });
  }
  return NextResponse.json({ team: await listTeam() });
}
