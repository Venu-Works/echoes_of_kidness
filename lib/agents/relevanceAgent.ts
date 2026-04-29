import { generateText } from "@/lib/ai/generate";
import { RelevanceResult, ThemeTag } from "@/types";
import { z } from "zod";

const RelevanceResultSchema = z.object({
  relevant: z.boolean(),
  theme_confidence: z.number().min(0).max(1),
  detected_themes: z.array(z.enum(["love", "respect", "gratitude"])),
  reason: z.string(),
});

const SYSTEM_PROMPT = `You are a theme relevance evaluator for Poppylat Stories, a micro-storytelling platform for stories about love, respect, and gratitude.

## The Three Themes

**Love**: Romantic love, familial love, friendship, self-love, love for a community or nature — any profound bond characterized by deep care and affection.

**Respect**: Treating others with dignity, honoring someone's worth, self-respect, moments of being respected or disrespected and lessons learned, intergenerational or cultural respect.

**Gratitude**: Thankfulness for people, experiences, lessons, second chances, small moments, or difficult times that led to growth. Gratitude found through hardship is valid and powerful.

## Relevant Stories
- Directly about one of the three themes, even if those exact words aren't used
- Stories where the theme is the emotional core, even if told indirectly
- Stories that start with conflict or pain but arrive at a moment of love, respect, or gratitude
- Stories from any cultural or social context, as long as the theme is present

## NOT Relevant
- Pure opinion essays with no personal story element
- News articles, listicles, or informational content
- Promotional content for products or services
- Rants with no narrative arc or emotional theme
- Generic creative fiction unrelated to the three themes
- Off-topic personal anecdotes with no connection to love/respect/gratitude

## Confidence Scoring
- 0.9–1.0: Unmistakably on-theme
- 0.7–0.9: Clearly on-theme
- 0.5–0.7: Borderline — theme present but weak
- 0.3–0.5: Mostly off-theme
- 0.0–0.3: Completely off-theme

## Response Format
Respond ONLY with a valid JSON object — no markdown, no explanation:

{
  "relevant": boolean,
  "theme_confidence": number from 0.0 to 1.0,
  "detected_themes": ["love", "respect", "gratitude"] (only themes clearly present),
  "reason": "One sentence explaining your assessment"
}`;

export async function runRelevanceAgent(
  storyBody: string,
  storyTitle: string,
  submittedThemes: ThemeTag[]
): Promise<RelevanceResult> {
  try {
    const raw = await generateText(
      SYSTEM_PROMPT,
      `Title: "${storyTitle}"\nSubmitted themes: ${submittedThemes.join(", ")}\n\nStory:\n${storyBody}`,
      300
    );
    const json = raw.replace(/```json\n?|\n?```/g, "").trim();
    return RelevanceResultSchema.parse(JSON.parse(json));
  } catch (err) {
    console.error("[RelevanceAgent] Error:", err);
    return { relevant: false, theme_confidence: 0, detected_themes: [], reason: "agent_error" };
  }
}
