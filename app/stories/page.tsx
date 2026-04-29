export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { connectDB } from "@/lib/mongodb";
import { Story } from "@/models/Story";
import { StoryCard } from "@/components/StoryCard";
import { ThemeFilter } from "@/components/ThemeFilter";
import Link from "next/link";

async function getStories(theme?: string, page = 1) {
  await connectDB();
  const limit = 12;
  const query: Record<string, unknown> = { status: "approved" };
  if (theme && ["love", "respect", "gratitude"].includes(theme)) {
    query.theme = theme;
  }

  const [stories, total] = await Promise.all([
    Story.find(query)
      .sort({ published_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-body")
      .lean(),
    Story.countDocuments(query),
  ]);

  return { stories, total, pages: Math.ceil(total / limit) };
}

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; page?: string }>;
}) {
  const { theme, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1"));
  const { stories, total, pages } = await getStories(theme, page);

  const themeLabel = theme
    ? theme.charAt(0).toUpperCase() + theme.slice(1)
    : "All";

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {themeLabel} Stories
        </h1>
        <p className="text-gray-500 mb-5">
          {total} {total === 1 ? "story" : "stories"} published
        </p>

        <Suspense>
          <ThemeFilter />
        </Suspense>
      </div>

      {stories.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">No stories yet in this category.</p>
          <Link href="/submit" className="text-rose-600 font-medium hover:underline">
            Be the first to share one 🌸
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
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

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex justify-center gap-2">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/stories?${theme ? `theme=${theme}&` : ""}page=${p}`}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    p === page
                      ? "bg-rose-600 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:border-rose-300"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
