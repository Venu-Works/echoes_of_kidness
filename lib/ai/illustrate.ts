import { generateText } from "./generate";

// Change this one line to restyle every future illustration.
export const ILLUSTRATION_STYLE =
  "black and white graphite pencil sketch on off-white paper, hand-drawn, " +
  "expressive linework with soft cross-hatched shading, no colour, " +
  "warm and heartfelt mood";

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

const SCENE_SYSTEM_PROMPT = `You turn short personal stories into a single image description for an illustrator.

Rules:
- Describe ONE visual scene showing the key moment of the story (2-3 sentences, max 80 words).
- Include the people involved and what they are doing — their gestures, expressions and how they relate to each other — plus the setting and important objects from the story.
- Describe people by role, approximate age and clothing (e.g. "an elderly woman in a cotton saree"), never by name. Keep them generic and sketch-like, not portraits of real individuals.
- No text, letters, signs, logos or watermarks in the scene.
- Nothing violent, sad-graphic, or sexual, even if the story mentions it.
- Respond with the scene description only — no preamble, no quotes.`;

// Step 1: condense the story into a short, privacy-safe scene description.
export async function describeScene(
  title: string,
  body: string
): Promise<string> {
  const scene = await generateText(
    SCENE_SYSTEM_PROMPT,
    `Title: ${title}\n\nStory:\n${body}`,
    200
  );
  return scene.trim().replace(/^["']|["']$/g, "");
}

// Step 2: render the scene with Gemini's image model. Returns PNG bytes.
export async function renderImage(scene: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const prompt = `${scene}\n\nStyle: ${ILLUSTRATION_STYLE}. Wide landscape composition. No text or lettering.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "16:9" },
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Image generation failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[];
  };
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part?.inlineData) {
    throw new Error("Image generation returned no image (possibly blocked by safety filters)");
  }
  return Buffer.from(part.inlineData.data, "base64");
}
