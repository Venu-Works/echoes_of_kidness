import { connectDB } from "@/lib/mongodb";
import { normalizeEmail, ownerEmails } from "@/lib/staffRoles";
import { StaffMember } from "@/models/StaffMember";
import { User } from "@/models/User";

export interface TeamMember {
  email: string;
  role: "owner" | "admin" | "moderator";
  name: string | null; // null = no account yet
  added_by: string | null;
  added_at: string | null;
}

// Owners (from ADMIN_EMAILS) first, then everyone added from the UI
export async function listTeam(): Promise<TeamMember[]> {
  await connectDB();
  const owners = ownerEmails();
  const members = await StaffMember.find()
    .sort({ added_at: 1 })
    .lean<{ email: string; role: "admin" | "moderator"; added_by: string; added_at: Date }[]>();
  const emails = [...owners, ...members.map((m) => m.email)];
  // Account emails are stored as typed, so match case-insensitively
  const users = await User.find({ email: { $in: emails } })
    .collation({ locale: "en", strength: 2 })
    .select("email name")
    .lean<{ email: string; name: string }[]>();
  const nameByEmail = new Map(users.map((u) => [normalizeEmail(u.email), u.name]));

  return [
    ...owners.map((email) => ({
      email, role: "owner" as const, name: nameByEmail.get(email) ?? null, added_by: null, added_at: null,
    })),
    ...members
      .filter((m) => !owners.includes(m.email))
      .map((m) => ({
        email: m.email, role: m.role, name: nameByEmail.get(m.email) ?? null,
        added_by: m.added_by, added_at: m.added_at.toISOString(),
      })),
  ];
}
