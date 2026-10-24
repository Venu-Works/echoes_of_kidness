export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { connectDB } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Story, IStoryDoc } from "@/models/Story";
import { StoryImage } from "@/components/StoryImage";
import { RegenerateImageButton } from "./RegenerateImageButton";
import { StoryEngagement } from "@/components/StoryEngagement";
import { StoryShare } from "@/components/StoryShare";
import { getSiteUrl } from "@/lib/site";
import { Reaction } from "@/models/Reaction";
import { getReactorKey } from "@/lib/reactor";
import type { ReactionType } from "@/types";
import type { FlattenMaps, Types } from "mongoose";

type LeanStory = FlattenMaps<IStoryDoc> & { _id: Types.ObjectId };

const THEME_STYLES: Record<string, string> = {
  love: "bg-rose-100 text-rose-700",
  respect: "bg-blue-100 text-blue-700",
  gratitude: "bg-amber-100 text-amber-700",
  kindness: "bg-emerald-100 text-emerald-700",
};

const THEME_LABELS: Record<string, string> = {
  love: "❤️ Love",
  respect: "🤝 Respect",
  gratitude: "🙏 Gratitude",
  kindness: "🌱 Kindness",
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
  if (!story) return { title: "Story not found", robots: { index: false, follow: false } };

  const url = new URL(`/stories/${String(story._id)}`, getSiteUrl()).toString();
  const description = `A story about ${story.theme.join(" & ")} by ${story.display_name} on Heart Witness.`;
  const image = story.image_url || new URL("/opengraph-image", getSiteUrl()).toString();

  return {
    title: story.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: story.title,
      description,
      url,
      siteName: "Heart Witness",
      type: "article",
      images: [{ url: image, alt: story.image_url ? story.title : "Heart Witness — stories worth sharing" }],
      ...(story.published_at ? { publishedTime: new Date(story.published_at).toISOString() } : {}),
    },
    twitter: { card: "summary_large_image", title: story.title, description, images: [image] },
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

  const session = await getServerSession(authOptions);
  const isAdmin = !!(session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;

  const reactorKey = await getReactorKey();
  const myReactions = reactorKey
    ? (
        await Reaction.find(
          { story_id: story._id, reactor_key: reactorKey },
          { type: 1 }
        ).lean<{ type: ReactionType }[]>()
      ).map((r) => r.type)
    : [];

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
        className="text-sm text-muted hover:text-terracotta-600 transition-colors mb-8 inline-block"
      >
        ← Back to stories
      </Link>

      {/* Illustration */}
      <StoryImage
        imageUrl={story.image_url}
        theme={story.theme}
        alt={story.title}
        width={1280}
        height={720}
        priority
        className="rounded-2xl mb-8"
      />

      {/* Theme badges */}
      <div className="flex flex-wrap gap-2 mb-5">
        {story.theme.map((t) => (
          <span
            key={t}
            className={`text-sm px-3 py-1 rounded-full font-medium ${THEME_STYLES[t] ?? "bg-sand-light text-muted"}`}
          >
            {THEME_LABELS[t] ?? t}
          </span>
        ))}
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-ink mb-4 leading-tight">
        {story.title}
      </h1>

      {/* Meta */}
      <div className="flex items-center gap-4 text-sm text-muted mb-8 pb-8 border-b">
        <span>By {story.display_name}</span>
        <span>·</span>
        <span className="bg-sand-light text-muted px-2 py-0.5 rounded-full">
          ⏱ {readMinutes} min read
        </span>
        {publishedDate && (
          <>
            <span>·</span>
            <span>{publishedDate}</span>
          </>
        )}
      </div>

      {isAdmin && (
        <RegenerateImageButton
          storyId={String(story._id)}
          imageStatus={story.image_status ?? "none"}
        />
      )}

      {/* Story body */}
      <div className="story-body">
        {story.body.split("\n").map((paragraph, i) =>
          paragraph.trim() ? (
            <p key={i} className="mb-4 text-muted leading-relaxed">
              {paragraph}
            </p>
          ) : (
            <br key={i} />
          )
        )}
      </div>

      {/* Reads & reactions */}
      <StoryEngagement
        storyId={String(story._id)}
        initialReadCount={story.read_count ?? 0}
        initialCounts={{
          gratitude: story.reactions?.gratitude ?? 0,
          respect: story.reactions?.respect ?? 0,
          love: story.reactions?.love ?? 0,
          applause: story.reactions?.applause ?? 0,
        }}
        initialMine={myReactions}
      />

      <StoryShare title={story.title} url={new URL(`/stories/${String(story._id)}`, getSiteUrl()).toString()} />

      {/* Footer CTA */}
      <div className="mt-12 pt-8 border-t text-center">
        <p className="text-muted mb-4">Moved by this story?</p>
        <Link
          href="/submit"
          className="bg-terracotta-600 text-white px-6 py-2.5 rounded-full font-medium hover:bg-terracotta-700 transition-colors"
        >
          Share yours 🌸
        </Link>
      </div>
    </div>
  );
}
