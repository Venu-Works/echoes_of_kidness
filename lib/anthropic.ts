import Anthropic from "@anthropic-ai/sdk";

declare global {
  // eslint-disable-next-line no-var
  var _anthropicClient: Anthropic | undefined;
}

export const anthropic =
  global._anthropicClient ??
  new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

if (process.env.NODE_ENV !== "production") {
  global._anthropicClient = anthropic;
}
