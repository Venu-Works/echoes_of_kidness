export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { authOptions } from "@/lib/auth";
import { canManageTeam, getStaffAccess } from "@/lib/staffRoles";
import { listTeam } from "@/lib/team";
import { TeamManager } from "./TeamManager";

export const metadata: Metadata = { title: "Admin — Moderation team" };

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const access = await getStaffAccess(session.user?.email);
  if (!canManageTeam(access)) redirect(access ? "/admin" : "/");

  const team = await listTeam();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/admin" className="text-sm text-muted hover:text-terracotta-600">
        ← Review queue
      </Link>
      <h1 className="text-3xl font-bold text-ink mt-4 mb-2">Moderation team</h1>
      <p className="text-muted mb-8">
        <strong className="text-ink font-medium">Moderators</strong> can approve, reject and
        overturn stories and regenerate images.{" "}
        <strong className="text-ink font-medium">Admins</strong> can also manage this team. You
        can add someone before they have an account — access starts when they sign in with
        that email.
      </p>

      <TeamManager initialTeam={team} currentEmail={access!.email} />
    </div>
  );
}
