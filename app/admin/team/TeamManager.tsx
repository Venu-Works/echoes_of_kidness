"use client";

import { useState } from "react";
import type { TeamMember } from "@/lib/team";

type Role = "moderator" | "admin";

const ROLE_BADGE: Record<TeamMember["role"], string> = {
  owner: "bg-terracotta-100 text-terracotta-700",
  admin: "bg-blue-100 text-blue-700",
  moderator: "bg-emerald-100 text-emerald-700",
};

export function TeamManager({
  initialTeam,
  currentEmail,
}: {
  initialTeam: TeamMember[];
  currentEmail: string;
}) {
  const [team, setTeam] = useState(initialTeam);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("moderator");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function send(method: "POST" | "DELETE", body: object, busyKey: string, success: string) {
    setBusy(busyKey);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/team", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({ kind: "error", text: data?.error ?? "Something went wrong — please try again" });
        return false;
      }
      setTeam(data.team);
      setMessage({ kind: "ok", text: success });
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    const exists = team.some((m) => m.email === trimmed.toLowerCase());
    const ok = await send(
      "POST",
      { email: trimmed, role },
      "add",
      exists ? `${trimmed} is now ${role === "admin" ? "an admin" : "a moderator"}.` : `Added ${trimmed} as ${role === "admin" ? "an admin" : "a moderator"}.`
    );
    if (ok) setEmail("");
  }

  function changeRole(member: TeamMember, next: Role) {
    void send("POST", { email: member.email, role: next }, member.email, `${member.email} is now ${next === "admin" ? "an admin" : "a moderator"}.`);
  }

  function remove(member: TeamMember) {
    if (!confirm(`Remove ${member.email} from the moderation team? They'll lose access immediately.`)) return;
    void send("DELETE", { email: member.email }, member.email, `Removed ${member.email}.`);
  }

  return (
    <div className="space-y-8">
      {/* Add someone */}
      <form onSubmit={add} className="bg-white rounded-xl border border-sand p-5">
        <h2 className="font-semibold text-ink mb-3">Add a team member</h2>
        <div className="flex flex-wrap gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="flex-1 min-w-[220px] border border-sand rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted-light focus:outline-none focus:ring-2 focus:ring-terracotta-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="border border-sand rounded-lg px-3 py-2 text-sm text-ink bg-white"
            aria-label="Role"
          >
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={busy === "add"}
            className="bg-terracotta-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-terracotta-700 disabled:opacity-50 transition-colors"
          >
            {busy === "add" ? "Adding…" : "Add"}
          </button>
        </div>
      </form>

      {message && (
        <p
          role="status"
          className={`text-sm ${message.kind === "ok" ? "text-green-700" : "text-red-700"}`}
        >
          {message.text}
        </p>
      )}

      {/* Current team */}
      <div className="bg-white rounded-xl border border-sand divide-y divide-sand">
        {team.map((member) => {
          const isMe = member.email === currentEmail;
          const editable = member.role !== "owner" && !isMe;
          return (
            <div key={member.email} className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <p className="text-ink font-medium">
                  {member.name ?? member.email}
                  {isMe && <span className="text-muted font-normal"> (you)</span>}
                </p>
                <p className="text-xs text-muted">
                  {member.name && <>{member.email} · </>}
                  {member.role === "owner"
                    ? "Owner — set in the server's ADMIN_EMAILS"
                    : `Added by ${member.added_by}${member.added_at ? ` on ${new Date(member.added_at).toLocaleDateString()}` : ""}`}
                  {!member.name && " · No account yet"}
                </p>
              </div>

              {editable ? (
                <>
                  <select
                    value={member.role}
                    disabled={busy === member.email}
                    onChange={(e) => changeRole(member, e.target.value as Role)}
                    className="border border-sand rounded-lg px-2 py-1 text-sm text-ink bg-white"
                    aria-label={`Role for ${member.email}`}
                  >
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={() => remove(member)}
                    disabled={busy === member.email}
                    className="text-sm text-red-700 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${ROLE_BADGE[member.role]}`}>
                  {member.role}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
