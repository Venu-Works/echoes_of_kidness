// Who may moderate stories and who may manage the moderation team.
//
// - Owners: emails in ADMIN_EMAILS. Always admins; can't be changed from the UI,
//   so the site can never be locked out of its own admin area.
// - Admins: review stories and manage the team (added from /admin/team).
// - Moderators: review stories (approve, reject, overturn, regenerate images).
//
// Kept free of next-auth imports so lib/auth.ts can use it too.
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { StaffMember } from "@/models/StaffMember";

export type StaffRole = "admin" | "moderator";

export interface StaffAccess {
  email: string;
  role: StaffRole;
  isOwner: boolean;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function ownerEmails(env: Record<string, string | undefined> = process.env): string[] {
  return (env.ADMIN_EMAILS ?? "").split(",").map(normalizeEmail).filter(Boolean);
}

// Pure decision, kept separate from the database lookup so it can be tested
export function resolveAccess(
  email: string,
  owners: string[],
  storedRole: StaffRole | null | undefined
): StaffAccess | null {
  const normalized = normalizeEmail(email);
  if (owners.includes(normalized)) return { email: normalized, role: "admin", isOwner: true };
  if (storedRole) return { email: normalized, role: storedRole, isOwner: false };
  return null;
}

export function canModerate(access: StaffAccess | null): boolean {
  return !!access;
}

export function canManageTeam(access: StaffAccess | null): boolean {
  return access?.role === "admin";
}

// Always reads the database, so removing someone takes effect immediately
export async function getStaffAccess(email: string | null | undefined): Promise<StaffAccess | null> {
  if (!email) return null;
  const owners = ownerEmails();
  if (owners.includes(normalizeEmail(email))) return resolveAccess(email, owners, null);
  if (mongoose.connection.readyState !== 1) await connectDB();
  const member = await StaffMember.findOne({ email: normalizeEmail(email) })
    .select("role")
    .lean<{ role: StaffRole }>();
  return resolveAccess(email, owners, member?.role);
}
