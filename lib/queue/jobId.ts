import { createHash } from "crypto";

// A revised submission gets a new ID, while recovery of the same content deduplicates.
export function moderationJobId(storyId: string, body: string, title: string, themes: string[], submittedAt = ""): string {
  const version = createHash("sha256").update(JSON.stringify([body, title, themes, submittedAt])).digest("hex").slice(0, 24);
  return `moderate-${storyId}-${version}`;
}
