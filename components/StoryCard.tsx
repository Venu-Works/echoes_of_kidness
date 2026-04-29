import Link from "next/link";

interface StoryCardProps {
  story: {
    _id: string;
    title: string;
    display_name: string;
    theme: string[];
    word_count: number;
    published_at?: string | Date | null;
  };
}

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

export function StoryCard({ story }: StoryCardProps) {
  const readMinutes = Math.max(1, Math.ceil(story.word_count / 200));

  return (
    <Link
      href={`/stories/${story._id}`}
      className="group block bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-rose-200 transition-all"
    >
      <div className="flex flex-wrap gap-1.5 mb-3">
        {story.theme.map((t) => (
          <span
            key={t}
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${THEME_STYLES[t] ?? "bg-gray-100 text-gray-600"}`}
          >
            {THEME_LABELS[t] ?? t}
          </span>
        ))}
      </div>

      <h3 className="font-semibold text-gray-900 text-base leading-snug mb-2 group-hover:text-rose-600 transition-colors">
        {story.title}
      </h3>

      <p className="text-sm text-gray-500">
        By {story.display_name}
        <span className="mx-1.5">·</span>
        <span>⏱ {readMinutes} min read</span>
      </p>
    </Link>
  );
}
