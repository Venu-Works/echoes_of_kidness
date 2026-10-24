import Link from "next/link";
import { StoryImage } from "./StoryImage";

interface StoryCardProps {
  story: {
    _id: string;
    title: string;
    display_name: string;
    theme: string[];
    word_count: number;
    published_at?: string | Date | null;
    image_url?: string | null;
    read_count?: number;
    reaction_total?: number;
  };
}

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

// Sum of all reaction counts on a story (fields may be missing on older stories)
export function reactionTotal(reactions?: Record<string, number> | null): number {
  if (!reactions) return 0;
  return Object.values(reactions).reduce((sum, n) => sum + (n ?? 0), 0);
}

export function StoryCard({ story }: StoryCardProps) {
  const readMinutes = Math.max(1, Math.ceil(story.word_count / 200));

  return (
    <Link
      href={`/stories/${story._id}`}
      className="story-card group block bg-white border border-sand rounded-2xl overflow-hidden hover:shadow-md hover:border-terracotta-200 transition-all"
    >
      <StoryImage
        imageUrl={story.image_url}
        theme={story.theme}
        alt={story.title}
        width={640}
        height={360}
        className="group-hover:scale-[1.02] transition-transform duration-300"
      />

      <div className="p-5">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {story.theme.map((t) => (
            <span
              key={t}
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${THEME_STYLES[t] ?? "bg-sand-light text-muted"}`}
            >
              {THEME_LABELS[t] ?? t}
            </span>
          ))}
        </div>

        <h3 className="font-semibold text-ink text-base leading-snug mb-2 group-hover:text-terracotta-600 transition-colors">
          {story.title}
        </h3>

        <p className="text-sm text-muted">
          By {story.display_name}
          <span className="mx-1.5">·</span>
          <span>⏱ {readMinutes} min read</span>
        </p>

        {(!!story.read_count || !!story.reaction_total) && (
          <p className="text-xs text-muted-light mt-2">
            {!!story.read_count && (
              <span>👁 {story.read_count.toLocaleString()} {story.read_count === 1 ? "read" : "reads"}</span>
            )}
            {!!story.read_count && !!story.reaction_total && <span className="mx-1.5">·</span>}
            {!!story.reaction_total && (
              <span>
                🙏🤝❤️👏 {story.reaction_total.toLocaleString()}
              </span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}
