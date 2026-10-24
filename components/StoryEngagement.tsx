"use client";

import { useEffect, useState } from "react";
import type { ReactionCounts, ReactionType } from "@/types";

const REACTIONS: { type: ReactionType; emoji: string; label: string; active: string }[] = [
  { type: "gratitude", emoji: "🙏", label: "Gratitude", active: "bg-amber-50 border-amber-400 text-amber-800" },
  { type: "respect", emoji: "🤝", label: "Respect", active: "bg-blue-50 border-blue-400 text-blue-800" },
  { type: "love", emoji: "❤️", label: "Love", active: "bg-rose-50 border-rose-400 text-rose-800" },
  { type: "applause", emoji: "👏", label: "Applause", active: "bg-violet-50 border-violet-400 text-violet-800" },
];

export function StoryEngagement({
  storyId,
  initialReadCount,
  initialCounts,
  initialMine,
}: {
  storyId: string;
  initialReadCount: number;
  initialCounts: ReactionCounts;
  initialMine: ReactionType[];
}) {
  const [readCount, setReadCount] = useState(initialReadCount);
  const [counts, setCounts] = useState(initialCounts);
  const [mine, setMine] = useState<ReactionType[]>(initialMine);
  const [busy, setBusy] = useState<ReactionType | null>(null);

  // Count one read per story per browser session
  useEffect(() => {
    const key = `hw_read_${storyId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch(`/api/stories/${storyId}/view`, { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setReadCount(data.read_count))
      .catch(() => {});
  }, [storyId]);

  async function toggle(type: ReactionType) {
    if (busy) return;
    const had = mine.includes(type);

    // Optimistic update so the tap feels instant
    setBusy(type);
    setMine((m) => (had ? m.filter((t) => t !== type) : [...m, type]));
    setCounts((c) => ({ ...c, [type]: Math.max(0, c[type] + (had ? -1 : 1)) }));

    try {
      const res = await fetch(`/api/stories/${storyId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCounts(data.counts);
      setMine(data.mine);
    } catch {
      // Roll back if the server didn't accept it
      setMine((m) => (had ? [...m, type] : m.filter((t) => t !== type)));
      setCounts((c) => ({ ...c, [type]: Math.max(0, c[type] + (had ? 1 : -1)) }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-12 pt-8 border-t">
      <div className="flex items-center justify-between mb-4">
        <p className="text-ink font-medium">How did this story make you feel?</p>
        <span className="text-sm text-muted">
          👁 {readCount.toLocaleString()} {readCount === 1 ? "read" : "reads"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {REACTIONS.map(({ type, emoji, label, active }) => {
          const selected = mine.includes(type);
          return (
            <button
              key={type}
              onClick={() => toggle(type)}
              aria-pressed={selected}
              disabled={busy === type}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                selected
                  ? active
                  : "bg-white border-sand text-ink hover:border-muted-light"
              }`}
            >
              <span className="text-base">{emoji}</span>
              <span>{label}</span>
              <span className={selected ? "font-semibold" : "text-muted"}>{counts[type]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
