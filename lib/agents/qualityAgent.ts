import { generateText } from "@/lib/ai/generate";
import { QualityResult } from "@/types";
import { z } from "zod";

const QualityResultSchema = z.object({
  quality_pass: z.boolean(),
  word_count: z.number().int().nonnegative(),
  coherent: z.boolean(),
  reason: z.string(),
});

const SYSTEM_PROMPT = `You are a story quality evaluator for Poppylat Stories, a micro-storytelling platform for heartfelt personal stories under 500 words.

## Your Role
Evaluate whether a story meets the minimum quality bar for publication. You are NOT a literary critic — check for basic readability and coherence only.

## Quality Requirements

### Minimum Word Count
The story must have at least 50 words. Count carefully.

### Coherence
The story must make sense as a piece of writing:
- A discernible subject or event being described
- Sentences that connect to each other
- A basic narrative arc, reflection, or emotional moment (need not be complex)

## What PASSES
- Simple, plainly-written stories from non-native English speakers (do not penalize for grammar if meaning is clear)
- Fragmented or poetic writing styles that convey meaning
- Rough, unpolished but emotionally honest stories
- Short vignettes that are complete thoughts (50+ words)

## What FAILS
- Fewer than 50 words
- Completely incoherent text (random words, keyboard spam, lorem ipsum)
- Placeholder or test submissions ("test", "asdfghjkl", "testing 123")
- A single repeated word or phrase with no narrative content

## Response Format
Respond ONLY with a valid JSON object — no markdown, no explanation:

{
  "quality_pass": boolean,
  "word_count": integer,
  "coherent": boolean,
  "reason": "One sentence explaining the assessment (especially important if failing)"
}`;

export async function runQualityAgent(storyBody: string): Promise<QualityResult> {
  try {
    const raw = await generateText(
      SYSTEM_PROMPT,
      `Please evaluate the quality of this story:\n\n${storyBody}`,
      256
    );
    const json = raw.replace(/```json\n?|\n?```/g, "").trim();
    return QualityResultSchema.parse(JSON.parse(json));
  } catch (err) {
    console.error("[QualityAgent] Error:", err);
    return { quality_pass: false, word_count: 0, coherent: false, reason: "agent_error" };
  }
}
