// Access checks for staff-only API routes. Role rules live in staffRoles.ts.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageTeam, canModerate, getStaffAccess, StaffAccess } from "@/lib/staffRoles";

export * from "@/lib/staffRoles";

// Returns the caller's access, or a ready-made error response
export async function requireStaff(
  need: "moderate" | "manage-team"
): Promise<{ access: StaffAccess; error?: never } | { access?: never; error: NextResponse }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Please sign in" }, { status: 401 }) };
  }
  const access = await getStaffAccess(session.user.email);
  const allowed = need === "manage-team" ? canManageTeam(access) : canModerate(access);
  if (!allowed || !access) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) };
  }
  return { access };
}
