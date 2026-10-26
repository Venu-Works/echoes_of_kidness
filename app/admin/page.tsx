export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Story } from "@/models/Story";
import { ModerationLog } from "@/models/ModerationLog";
import { AdminActions } from "./AdminActions";
import { canManageTeam, canModerate, getStaffAccess } from "@/lib/staffRoles";

export const metadata: Metadata = { title: "Admin — Story review" };

const REJECTED_WINDOW_DAYS = 30;

type LogLike = {
  verdict_reason?: string;
  admin_decision?: string;
  admin_decided_by?: string;
  safety_result?: { safe?: boolean; flags?: string[] };
  relevance_result?: { relevant?: boolean; theme_confidence?: number; reason?: string };
  quality_result?: { quality_pass?: boolean; obvious_junk?: boolean; reason?: string };
};

// Older logs were written before verdict_reason existed, so rebuild a
// reason from the individual agent results when it's missing.
function aiReason(log?: LogLike): string | null {
  if (!log) return null;
  if (log.verdict_reason) return log.verdict_reason;
  const parts: string[] = [];
  if (log.safety_result && !log.safety_result.safe) {
    parts.push(`Safety flags: ${(log.safety_result.flags ?? []).join(", ")}`);
  }
  if (log.quality_result && !log.quality_result.quality_pass) {
    parts.push(`Quality: ${log.quality_result.reason}`);
  }
  if (log.relevance_result && !log.relevance_result.relevant) {
    parts.push(`Relevance: ${log.relevance_result.reason}`);
  }
  return parts.join(" · ") || null;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Moderators and admins can review; only admins see the Team link
  const access = await getStaffAccess(session.user?.email);
  if (!canModerate(access)) redirect("/");

  const tab = (await searchParams).tab === "rejected" ? "rejected" : "review";
  const since = new Date(Date.now() - REJECTED_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  await connectDB();
  const [stories, reviewCount, rejectedCount] = await Promise.all([
    tab === "review"
      ? Story.find({ status: "human_review" }).sort({ submitted_at: -1 }).lean()
      : Story.find({ status: "rejected", submitted_at: { $gte: since } })
          .sort({ submitted_at: -1 })
          .limit(50)
          .lean(),
    Story.countDocuments({ status: "human_review" }),
    Story.countDocuments({ status: "rejected", submitted_at: { $gte: since } }),
  ]);

  const storyIds = stories.map((s) => s._id);
  const logs = await ModerationLog.find({
    story_id: { $in: storyIds },
  }).lean();

  const logMap = Object.fromEntries(
    logs.map((l) => [l.story_id.toString(), l as unknown as LogLike])
  );

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
      active
        ? "bg-terracotta-600 text-white border-terracotta-600"
        : "bg-white text-muted border-sand hover:border-terracotta-300 hover:text-terracotta-600"
    }`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
          <h1 className="text-3xl font-bold text-ink">
            Story review queue
          </h1>
          {canManageTeam(access) && (
            <Link href="/admin/team" className="text-sm text-terracotta-700 hover:underline">
              Manage moderators →
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className={tabClass(tab === "review")}>
            Needs review ({reviewCount})
          </Link>
          <Link href="/admin?tab=rejected" className={tabClass(tab === "rejected")}>
            Recently rejected ({rejectedCount})
          </Link>
        </div>
        {tab === "rejected" && (
          <p className="text-sm text-muted mt-3">
            Stories rejected in the last {REJECTED_WINDOW_DAYS} days. If the AI got it
            wrong, you can overturn the decision and publish the story.
          </p>
        )}
      </div>

      {stories.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-sand text-muted">
          {tab === "review"
            ? "All clear! No stories need human review."
            : `No stories were rejected in the last ${REJECTED_WINDOW_DAYS} days.`}
        </div>
      ) : (
        <div className="space-y-6">
          {stories.map((story) => {
            const log = logMap[String(story._id)];
            const reason = aiReason(log);
            const rejectedByAdmin = log?.admin_decision === "rejected";
            return (
              <div
                key={String(story._id)}
                className="bg-white rounded-xl border border-sand p-6"
              >
                <h2 className="font-bold text-lg text-ink mb-1">
                  {story.title}
                </h2>
                <p className="text-sm text-muted mb-4">
                  By {story.display_name} · {story.word_count} words ·{" "}
                  {new Date(story.submitted_at).toLocaleDateString()}
                  {tab === "rejected" && (
                    <>
                      {" · "}
                      <span className={rejectedByAdmin ? "text-ink" : "text-red-700"}>
                        {rejectedByAdmin
                          ? `Rejected by ${log?.admin_decided_by ?? "an admin"}`
                          : "Rejected by AI"}
                      </span>
                    </>
                  )}
                </p>

                {/* Story body */}
                <div className="bg-cream rounded-lg p-4 mb-4 text-sm text-ink leading-relaxed max-h-48 overflow-y-auto whitespace-pre-line">
                  {story.body}
                </div>

                {/* Moderation log */}
                {log && (
                  <div className="bg-purple-50 rounded-lg p-4 mb-4 text-xs space-y-3">
                    <p className="font-semibold text-purple-800">
                      AI moderation report
                    </p>
                    {reason && <p className="text-ink">{reason}</p>}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="font-medium text-ink">Safety</span>
                        <p className="text-muted">
                          {log.safety_result?.safe ? "✅ Safe" : "❌ Flagged"}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-ink">Relevance</span>
                        <p className="text-muted">
                          {log.relevance_result?.relevant ? "✅" : "⚠️"} Confidence:{" "}
                          {(log.relevance_result?.theme_confidence ?? 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-ink">Quality</span>
                        <p className="text-muted">
                          {log.quality_result?.obvious_junk
                            ? "❌ Junk / spam"
                            : log.quality_result?.quality_pass
                              ? "✅ Pass"
                              : "⚠️ Uncertain"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <AdminActions
                  storyId={String(story._id)}
                  mode={tab === "rejected" ? "rejected" : "review"}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
