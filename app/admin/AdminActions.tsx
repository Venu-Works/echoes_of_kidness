"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// mode "review": story is waiting for a decision (approve or reject)
// mode "rejected": story was rejected; admin can overturn and publish it
export function AdminActions({
  storyId,
  mode = "review",
}: {
  storyId: string;
  mode?: "review" | "rejected";
}) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState<"approve" | "reject" | null>(null);
  const [imageQueued, setImageQueued] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleAction(action: "approve" | "reject") {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        setImageQueued(data?.image_queued !== false);
        setDone(action);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong — please try again");
      }
    } finally {
      setLoading(null);
    }
  }

  if (done) {
    return (
      <p className="text-sm text-green-600 font-medium">
        {done === "reject"
          ? "✅ Decision recorded."
          : imageQueued
            ? "✅ Published — its sketch is being generated."
            : "✅ Published. The image queue is unavailable right now, so its sketch will be generated automatically once it's back."}
      </p>
    );
  }

  return (
    <div>
      <div className="flex gap-3">
        <button
          onClick={() => handleAction("approve")}
          disabled={!!loading}
          className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading === "approve"
            ? "Approving…"
            : mode === "rejected"
              ? "↩️ Overturn & publish"
              : "✅ Approve"}
        </button>
        {mode === "review" && (
          <button
            onClick={() => handleAction("reject")}
            disabled={!!loading}
            className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading === "reject" ? "Rejecting…" : "❌ Reject"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
