"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RegenerateImageButton({
  storyId,
  imageStatus,
}: {
  storyId: string;
  imageStatus: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "queued" | "error">(
    imageStatus === "pending" ? "queued" : "idle"
  );
  const router = useRouter();

  async function regenerate() {
    setState("loading");
    const res = await fetch(`/api/admin/stories/${storyId}/image`, {
      method: "POST",
    });
    setState(res.ok ? "queued" : "error");
  }

  return (
    <div className="flex items-center gap-3 text-sm mb-8">
      <span className="text-muted-light">Admin:</span>
      {state === "queued" ? (
        <>
          <span className="text-amber-600">🎨 Image is being generated…</span>
          <button
            onClick={() => router.refresh()}
            className="text-muted underline hover:text-ink"
          >
            Refresh
          </button>
        </>
      ) : (
        <button
          onClick={regenerate}
          disabled={state === "loading"}
          className="px-3 py-1 border border-sand rounded-lg text-ink hover:bg-cream disabled:opacity-50 transition-colors"
        >
          {state === "loading" ? "Queuing..." : "🎨 Regenerate image"}
        </button>
      )}
      {imageStatus === "failed" && state === "idle" && (
        <span className="text-red-600">Last generation failed</span>
      )}
      {state === "error" && (
        <span className="text-red-600">Could not queue — try again</span>
      )}
    </div>
  );
}
