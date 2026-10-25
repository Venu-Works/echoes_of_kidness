"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminActions({ storyId }: { storyId: string }) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleAction(action: "approve" | "reject") {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  if (done) {
    return (
      <p className="text-sm text-green-600 font-medium">✅ Decision recorded.</p>
    );
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={() => handleAction("approve")}
        disabled={!!loading}
        className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {loading === "approve" ? "Approving…" : "✅ Approve"}
      </button>
      <button
        onClick={() => handleAction("reject")}
        disabled={!!loading}
        className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {loading === "reject" ? "Rejecting…" : "❌ Reject"}
      </button>
    </div>
  );
}
