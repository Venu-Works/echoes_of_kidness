"use client";

import { useRouter, useSearchParams } from "next/navigation";

const THEMES = [
  { value: "", label: "All stories" },
  { value: "love", label: "❤️ Love" },
  { value: "respect", label: "🤝 Respect" },
  { value: "gratitude", label: "🙏 Gratitude" },
  { value: "kindness", label: "🌱 Kindness" },
];

export function ThemeFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("theme") ?? "";

  function handleFilter(value: string) {
    if (value) {
      router.push(`/stories?theme=${value}`);
    } else {
      router.push("/stories");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {THEMES.map(({ value, label }) => (
        <button
          key={value}
          aria-pressed={current === value}
          onClick={() => handleFilter(value)}
          className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
            current === value
              ? "bg-terracotta-600 text-white border-terracotta-600"
              : "bg-white text-muted border-sand hover:border-terracotta-300 hover:text-terracotta-600"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
