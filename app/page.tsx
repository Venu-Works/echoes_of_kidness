export const dynamic = "force-dynamic";

import Link from "next/link";
import { connectDB } from "@/lib/mongodb";
import { Story } from "@/models/Story";
import { StoryCard } from "@/components/StoryCard";

async function getFeaturedStories() {
  await connectDB();
  return Story.find({ status: "approved" })
    .sort({ published_at: -1 })
    .limit(6)
    .select("-body")
    .lean();
}

export default async function HomePage() {
  const stories = await getFeaturedStories();

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-rose-50 via-white to-amber-50 py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-5xl mb-4">🌸</div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            Stories that touch the heart
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto">
            Real stories about <span className="text-rose-600 font-semibold">love</span>,{" "}
            <span className="text-blue-600 font-semibold">respect</span>, and{" "}
            <span className="text-amber-600 font-semibold">gratitude</span> — under 500 words,
            readable in 2 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/submit"
              className="bg-rose-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-rose-700 transition-colors"
            >
              Share Your Story
            </Link>
            <Link
              href="/stories"
              className="bg-white text-gray-800 px-8 py-3 rounded-full font-semibold border border-gray-300 hover:border-gray-400 transition-colors"
            >
              Browse Stories
            </Link>
          </div>
        </div>
      </section>

      {/* Featured stories */}
      <section className="max-w-5xl mx-auto px-4 py-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Recent Stories</h2>
          <Link href="/stories" className="text-rose-600 text-sm font-medium hover:underline">
            View all →
          </Link>
        </div>

        {stories.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">No stories yet.</p>
            <p className="text-sm">Be the first to share yours! 🌸</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {stories.map((story) => {
              const id = String(story._id);
              return (
                <StoryCard
                  key={id}
                  story={{
                    _id: id,
                    title: story.title as string,
                    display_name: story.display_name as string,
                    theme: story.theme as string[],
                    word_count: story.word_count as number,
                    published_at: story.published_at as Date | null,
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="bg-rose-50 border-t border-rose-100 py-14 px-4">
        <div className="max-w-xl mx-auto text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-3">
            Have a story to share?
          </h3>
          <p className="text-gray-600 mb-6">
            Your story doesn&apos;t need to be perfect — just real.
          </p>
          <Link
            href="/submit"
            className="bg-rose-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-rose-700 transition-colors"
          >
            Share My Story 🌸
          </Link>
        </div>
      </section>
    </div>
  );
}
