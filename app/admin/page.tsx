export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Story } from "@/models/Story";
import { ModerationLog } from "@/models/ModerationLog";
import { AdminActions } from "./AdminActions";

export const metadata: Metadata = { title: "Admin — Human Review" };

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  if (
    !session.user?.email ||
    !getAdminEmails().includes(session.user.email)
  ) {
    redirect("/");
  }

  await connectDB();
  const stories = await Story.find({ status: "human_review" })
    .sort({ submitted_at: -1 })
    .lean();

  const storyIds = stories.map((s) => s._id);
  const logs = await ModerationLog.find({
    story_id: { $in: storyIds },
  }).lean();

  const logMap = Object.fromEntries(
    logs.map((l) => [l.story_id.toString(), l])
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          Human Review Queue
        </h1>
        <p className="text-gray-500">
          {stories.length} {stories.length === 1 ? "story" : "stories"} awaiting review
        </p>
      </div>

      {stories.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 text-gray-500">
          All clear! No stories need human review.
        </div>
      ) : (
        <div className="space-y-6">
          {stories.map((story) => {
            const log = logMap[String(story._id)];
            return (
              <div
                key={String(story._id)}
                className="bg-white rounded-xl border border-gray-200 p-6"
              >
                <h2 className="font-bold text-lg text-gray-900 mb-1">
                  {story.title}
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  By {story.display_name} · {story.word_count} words ·{" "}
                  {new Date(story.submitted_at).toLocaleDateString()}
                </p>

                {/* Story body */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-800 leading-relaxed max-h-48 overflow-y-auto">
                  {story.body}
                </div>

                {/* Moderation log */}
                {log && (
                  <div className="bg-purple-50 rounded-lg p-4 mb-4 text-xs space-y-2">
                    <p className="font-semibold text-purple-800 mb-2">
                      AI Moderation Report
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="font-medium text-gray-700">Safety</span>
                        <p className="text-gray-600">
                          {(log.safety_result as { safe?: boolean })?.safe
                            ? "✅ Safe"
                            : "❌ Flagged"}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Relevance</span>
                        <p className="text-gray-600">
                          Confidence:{" "}
                          {(
                            (log.relevance_result as { theme_confidence?: number })
                              ?.theme_confidence ?? 0
                          ).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Quality</span>
                        <p className="text-gray-600">
                          {(log.quality_result as { quality_pass?: boolean })?.quality_pass
                            ? "✅ Pass"
                            : "❌ Fail"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <AdminActions storyId={String(story._id)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
