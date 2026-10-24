"use client";

import { useEffect, useState } from "react";

export function StoryShare({ title, url }: { title: string; url: string }) {
  const [canShare, setCanShare] = useState(false);
  const [message, setMessage] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setShowLink(false);
      setMessage("Link copied. Ready to share!");
    } catch {
      setShowLink(true);
      setMessage("Select and copy the story link below.");
    }
  }

  async function share() {
    setSharing(true);
    setMessage("");
    try {
      await navigator.share({ title, text: `${title} — Heart Witness`, url });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        await copyLink();
      }
    } finally {
      setSharing(false);
    }
  }

  const encodedUrl = encodeURIComponent(url);
  const text = encodeURIComponent(`${title} — Heart Witness`);
  const links = [
    { name: "WhatsApp", href: `https://wa.me/?text=${text}%20${encodedUrl}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
    { name: "X", href: `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}` },
  ];
  const buttonClass = "inline-flex items-center justify-center rounded-full border border-sand bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-terracotta-300 hover:bg-terracotta-50";

  return (
    <section aria-label="Share this story" className="mt-8 rounded-2xl border border-sand bg-sand-light/40 p-5 sm:p-6">
      <h2 className="text-xl mb-1">Good stories are worth passing on.</h2>
      <p className="text-sm text-muted mb-4">Send a little inspiration to someone you know.</p>
      <div className="flex flex-wrap gap-2">
        {canShare && <button type="button" onClick={share} disabled={sharing} className={`${buttonClass} disabled:opacity-50`}>{sharing ? "Opening…" : "Share…"}</button>}
        {links.map(({ name, href }) => (
          <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${name} (opens in a new tab)`} className={buttonClass}>{name}</a>
        ))}
        <button type="button" onClick={copyLink} className={buttonClass}>Copy link</button>
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-sm text-muted">{message}</p>
      {showLink && <input aria-label="Story link to copy" value={url} readOnly onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full rounded-lg border border-sand bg-white p-3 text-sm" />}
    </section>
  );
}
