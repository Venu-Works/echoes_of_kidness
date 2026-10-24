"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MAX_WORDS = 500;
const MIN_WORDS = 50;

const THEMES = [
  { value: "love", label: "❤️ Love" },
  { value: "respect", label: "🤝 Respect" },
  { value: "gratitude", label: "🙏 Gratitude" },
  { value: "kindness", label: "🌱 Kindness" },
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function SubmitForm({ userName }: { userName?: string | null }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [themes, setThemes] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState(userName ?? "");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const wordCount = countWords(body);
  const overLimit = wordCount > MAX_WORDS;
  const underMinimum = wordCount < MIN_WORDS && body.trim().length > 0;

  function toggleTheme(value: string) {
    setThemes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (overLimit || themes.length === 0) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          theme: themes,
          display_name: anonymous ? "Anonymous" : displayName,
          post_as_anonymous: anonymous,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Submission failed. Please try again.");
        return;
      }

      router.push("/profile?submitted=1");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Story Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give your story a title"
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
          required
          maxLength={200}
        />
      </div>

      {/* Story body */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-sm font-semibold text-gray-700">
            Your Story
          </label>
          <span
            className={`text-sm font-medium tabular-nums ${
              overLimit
                ? "text-red-600"
                : underMinimum
                ? "text-amber-600"
                : wordCount >= 450
                ? "text-orange-500"
                : "text-gray-500"
            }`}
          >
            {wordCount} / {MAX_WORDS} words
          </span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          placeholder="Share your heartfelt story here... (minimum 50 words)"
          className={`w-full border rounded-lg px-4 py-3 text-gray-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none ${
            overLimit ? "border-red-400 bg-red-50" : "border-gray-300"
          }`}
          required
        />
        {overLimit && (
          <p className="text-red-600 text-sm mt-1">
            Please trim your story to 500 words or fewer.
          </p>
        )}
        {underMinimum && (
          <p className="text-amber-600 text-sm mt-1">
            Stories must be at least 50 words.
          </p>
        )}
      </div>

      {/* Theme tags */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Themes <span className="text-gray-400 font-normal">(select at least one)</span>
        </label>
        <div className="flex gap-3">
          {THEMES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleTheme(value)}
              className={`px-5 py-2 rounded-full border font-medium text-sm transition-colors ${
                themes.includes(value)
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-rose-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Post as */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Post as
        </label>
        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="w-4 h-4 text-rose-600"
          />
          <span className="text-sm text-gray-700">Post anonymously</span>
        </label>
        {!anonymous && (
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            required={!anonymous}
            maxLength={100}
          />
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || overLimit || themes.length === 0 || wordCount < MIN_WORDS}
        className="w-full bg-rose-600 text-white py-3 rounded-lg font-semibold hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Submitting..." : "Share My Story 🌸"}
      </button>
    </form>
  );
}
