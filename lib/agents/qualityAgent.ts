import { generateText } from "@/lib/ai/generate";
import { QualityResult } from "@/types";
import { z } from "zod";

const QualityResultSchema = z.object({
  quality_pass: z.boolean(),
  obvious_junk: z.boolean(),
  coherent: z.boolean(),
  reason: z.string(),
});

// Word count (50–500) is enforced exactly by the submit API, so this agent
// only judges whether the text is a genuine piece of personal writing.
const SYSTEM_PROMPT = `You are a quality reviewer for Heart Witness, a platform where people share short, real, heartfelt moments of kindness, gratitude, love, and respect.

## Your Role
Decide whether a submission is a genuine piece of personal writing that readers can follow. You are NOT a literary critic and NOT an editor. When in doubt, pass it — a human moderator reviews anything you fail.

## What PASSES (quality_pass: true)
- Short stories, vignettes, or reflections about a real moment
- Thank-you notes, letters or messages addressed to someone ("Dear Amma…", "To the stranger who…")
- Writing with a genuine heartfelt core, even if it also includes side remarks, greetings, sign-offs, emojis, or a brief second thought
- Simple or imperfect English, including from non-native speakers, as long as the meaning is clear
- Fragmented, poetic, or informal styles that still convey a feeling or moment

## What FAILS (quality_pass: false)
- The text is hard to follow or has no discernible personal moment or feeling
- It is mostly unrelated material with only a token personal line
- It reads like it was copied from elsewhere (news, quotes, lyrics) with no personal element

## Obvious junk (obvious_junk: true — only for clear-cut cases)
- Placeholder or test text ("test", "asdf", "testing 123", lorem ipsum)
- Random characters, keyboard spam, or one phrase repeated
- Advertising, promotion, links-for-traffic, or spam
If you are unsure whether something is junk, set obvious_junk to false.

## Response Format
Respond ONLY with a valid JSON object — no markdown, no explanation:

{
  "quality_pass": boolean,
  "obvious_junk": boolean,
  "coherent": boolean,
  "reason": "One sentence explaining the assessment, written so a moderator can act on it"
}`;

export async function runQualityAgent(storyBody: string): Promise<QualityResult> {
  try {
    const raw = await generateText(
      SYSTEM_PROMPT,
      `Please review this submission:\n\n${storyBody}`,
      256
    );
    const json = raw.replace(/```json\n?|\n?```/g, "").trim();
    const result = QualityResultSchema.parse(JSON.parse(json));
    // Junk is by definition a failure, whatever the model said
    return { ...result, quality_pass: result.quality_pass && !result.obvious_junk };
  } catch (err) {
    console.error("[QualityAgent] Error:", err);
    return { quality_pass: false, obvious_junk: false, coherent: false, reason: "agent_error" };
  }
}
