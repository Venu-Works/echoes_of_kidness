import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Set AI_PROVIDER=gemini in .env.local to use Gemini (free tier)
// Set AI_PROVIDER=claude to use Anthropic Claude (default)
const PROVIDER = (process.env.AI_PROVIDER ?? "claude") as "claude" | "gemini";

const CLAUDE_MODEL = "claude-sonnet-4-6";
const GEMINI_MODEL = "gemini-2.5-flash"; // free tier available

declare global {
  // eslint-disable-next-line no-var
  var _anthropic: Anthropic | undefined;
  // eslint-disable-next-line no-var
  var _genAI: GoogleGenerativeAI | undefined;
}

function getAnthropicClient() {
  global._anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return global._anthropic;
}

function getGeminiClient() {
  global._genAI ??= new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return global._genAI;
}

export async function generateText(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 512
): Promise<string> {
  if (PROVIDER === "gemini") {
    const model = getGeminiClient().getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(userMessage);
    return result.response.text();
  }

  // Claude (default) — with prompt caching on the system prompt
  const response = await getAnthropicClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content.find((b) => b.type === "text");
  return block?.type === "text" ? block.text : "";
}

export function getActiveProvider() {
  return PROVIDER;
}
