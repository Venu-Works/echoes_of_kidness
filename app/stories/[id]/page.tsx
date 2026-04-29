export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { connectDB } from "@/lib/mongodb";
import { Story, IStoryDoc } from "@/models/Story";
import type { FlattenMaps, Types } from "mongoose";

type LeanStory = FlattenMaps<IStoryDoc> & { _id: Types.ObjectId };

const THEME_STYLES: Record<string, string> = {
  love: "bg-rose-100 text-rose-700",
  respect: "bg-blue-100 text-blue-700",
  gratitude: "bg-amber-100 text-amber-700",
};

const THEME_LABELS: Record<string, string> = {
  love: "❤️ Love",
  respect: "🤝 Respect",
  gratitude: "🙏 Gratitude",
};

async function getStory(id: string): Promise<LeanStory | null> {
  await connectDB();
  try {
    return (await Story.findOne({
      _id: id,
      status: "approved",
    }).lean()) as LeanStory | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const story = await getStory(id);
  if (!story) return { title: "Story not found" };

  return {
    title: story.title,
    description: `A story about ${story.theme.join(" & ")} by ${story.display_name}`,
    openGraph: {
      title: story.title,
      description: `A story about ${story.theme.join(" & ")} by ${story.display_name}`,
      type: "article",
    },
  };
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const story = await getStory(id);
  if (!story) notFound();

  const readMinutes = Math.max(1, Math.ceil(story.word_count / 200));
  const publishedDate = story.published_at
    ? new Date(story.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Back link */}
      <Link
        href="/stories"
        className="text-sm text-gray-500 hover:text-rose-600 transition-colors mb-8 inline-block"
      >
        ← Back to stories
      </Link>

      {/* Theme badges */}
      <div className="flex flex-wrap gap-2 mb-5">
        {story.theme.map((t) => (
          <span
            key={t}
            className={`text-sm px-3 py-1 rounded-full font-medium ${THEME_STYLES[t] ?? "bg-gray-100 text-gray-600"}`}
          >
            {THEME_LABELS[t] ?? t}
          </span>
        ))}
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
        {story.title}
      </h1>

      {/* Meta */}
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 pb-8 border-b">
        <span>By {story.display_name}</span>
        <span>·</span>
        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          ⏱ {readMinutes} min read
        </span>
        {publishedDate && (
          <>
            <span>·</span>
            <span>{publishedDate}</span>
          </>
        )}
      </div>

      {/* Story body */}
      <div className="story-body">
        {story.body.split("\n").map((paragraph, i) =>
          paragraph.trim() ? (
            <p key={i} className="mb-4 text-gray-800 leading-relaxed">
              {paragraph}
            </p>
          ) : (
            <br key={i} />
          )
        )}
      </div>

      {/* Footer CTA */}
      <div className="mt-12 pt-8 border-t text-center">
        <p className="text-gray-600 mb-4">Moved by this story?</p>
        <Link
          href="/submit"
          className="bg-rose-600 text-white px-6 py-2.5 rounded-full font-medium hover:bg-rose-700 transition-colors"
        >
          Share yours 🌸
        </Link>
      </div>
    </div>
  );
}
