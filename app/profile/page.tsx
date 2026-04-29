export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import type { Metadata } from "next";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Story } from "@/models/Story";

export const metadata: Metadata = { title: "My Stories" };

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Under Review", className: "bg-amber-100 text-amber-700" },
  approved: { label: "Published", className: "bg-green-100 text-green-700" },
  rejected: { label: "Not Published", className: "bg-red-100 text-red-700" },
  human_review: { label: "Human Review", className: "bg-purple-100 text-purple-700" },
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/profile");

  await connectDB();
  const userId = (session.user as { id: string }).id;

  const stories = await Story.find({ user_id: userId })
    .sort({ submitted_at: -1 })
    .lean();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">My Stories</h1>
        <p className="text-gray-500">
          Welcome back, {session.user?.name} 👋
        </p>
      </div>

      {submitted === "1" && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6 text-green-800 text-sm">
          🌸 Your story has been submitted and is under review. We&apos;ll notify you by email once it&apos;s published.
        </div>
      )}

      {submitted === "resubmitted" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6 text-blue-800 text-sm">
          🌸 Your updated story has been resubmitted and is under review.
        </div>
      )}

      {stories.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 mb-4">You haven&apos;t shared any stories yet.</p>
          <Link
            href="/submit"
            className="bg-rose-600 text-white px-6 py-2.5 rounded-full font-medium hover:bg-rose-700 transition-colors"
          >
            Share your first story 🌸
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {stories.map((story) => {
            const badge = STATUS_BADGE[story.status] ?? STATUS_BADGE.pending;
            const isPublished = story.status === "approved";

            return (
              <div
                key={String(story._id)}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    {isPublished ? (
                      <Link
                        href={`/stories/${String(story._id)}`}
                        className="font-semibold text-gray-900 hover:text-rose-600 transition-colors"
                      >
                        {story.title}
                      </Link>
                    ) : story.status === "rejected" ? (
                      <Link
                        href={`/edit/${String(story._id)}`}
                        className="font-semibold text-gray-900 hover:text-rose-600 transition-colors"
                      >
                        {story.title}
                      </Link>
                    ) : (
                      <p className="font-semibold text-gray-900">{story.title}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      {story.word_count} words ·{" "}
                      Submitted{" "}
                      {new Date(story.submitted_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    {story.status === "rejected" && (
                      <Link
                        href={`/edit/${String(story._id)}`}
                        className="inline-block mt-3 text-sm font-medium text-rose-600 border border-rose-300 px-3 py-1 rounded-full hover:bg-rose-50 transition-colors"
                      >
                        ✏️ Edit &amp; Resubmit
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
