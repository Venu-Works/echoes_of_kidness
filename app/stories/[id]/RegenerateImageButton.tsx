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
  const [state, setState] = useState<"idle" | "loading" | "queued" | "delayed" | "error">(
    imageStatus === "pending" ? "queued" : "idle"
  );
  const router = useRouter();

  async function regenerate() {
    setState("loading");
    const res = await fetch(`/api/admin/stories/${storyId}/image`, {
      method: "POST",
    });
    // 503 = queue unavailable; the story is still owed an image and the
    // worker will pick it up automatically
    setState(res.ok ? "queued" : res.status === 503 ? "delayed" : "error");
  }

  return (
    <div className="flex items-center gap-3 text-sm mb-8">
      <span className="text-muted-light">Admin:</span>
      {state === "queued" ? (
        <>
          <span className="text-amber-600">🎨 Preparing the image…</span>
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
          {state === "loading" ? "Queuing…" : "🎨 Regenerate image"}
        </button>
      )}
      {imageStatus === "failed" && state === "idle" && (
        <span className="text-red-600">The last image generation attempt failed.</span>
      )}
      {state === "delayed" && (
        <span className="text-amber-700">
          The image queue is unavailable right now. The image will be generated automatically once it&apos;s back.
        </span>
      )}
      {state === "error" && (
        <span className="text-red-600">Could not queue the image. Please try again.</span>
      )}
    </div>
  );
}
