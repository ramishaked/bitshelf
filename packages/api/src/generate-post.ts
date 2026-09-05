import Anthropic from "@anthropic-ai/sdk";

// Post generator (spec 8.2): short social text about an item, three styles,
// Hebrew or English. The user edits and shares through the iOS share sheet;
// there is no direct posting API.

export const GENERATE_POST_MODEL = "claude-opus-5";

// Opus 5 pricing per 1M tokens, for the AiJob cost record
const INPUT_USD_PER_MTOK = 5;
const OUTPUT_USD_PER_MTOK = 25;

export type PostStyle = "story" | "sale" | "question";

const STYLE_BRIEF: Record<PostStyle, string> = {
  story:
    "Story: what the item is and why it is interesting, warm collector tone, 2-4 sentences.",
  sale: "Sale: a for-sale post. Lead with the item and condition, mention the asking price when given, end with a call to message. 2-4 sentences.",
  question:
    "Question to the community: the collector wants help, for example identifying the exact variant or a fault. 1-3 sentences ending with a clear question.",
};

export interface GeneratePostInput {
  title: string;
  year?: number | null;
  condition?: string | null;
  workingStatus?: string | null;
  notes?: string | null;
  price?: string | null;
  style: PostStyle;
  language: "he" | "en";
}

export interface GeneratePostOutcome {
  text: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export async function generatePost(input: GeneratePostInput): Promise<GeneratePostOutcome> {
  const client = new Anthropic();
  const started = Date.now();
  const facts = [
    `Item: ${input.title}`,
    input.year ? `Year: ${input.year}` : null,
    input.condition ? `Cosmetic condition: ${input.condition}/5` : null,
    input.workingStatus ? `Working status: ${input.workingStatus}` : null,
    input.price ? `Asking price: ${input.price}` : null,
    input.notes ? `Owner notes: ${input.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: GENERATE_POST_MODEL,
    max_tokens: 1024,
    output_config: { effort: "low" },
    system: `You write short social media posts for a retro computing collector. Language: ${input.language === "he" ? "Hebrew, spoken-professional, no translationese, Latin model names stay in Latin" : "English"}. ${STYLE_BRIEF[input.style]}
Rules: plain text only, no hashtags unless natural (max 2), no emoji, no em dashes (use comma, period, colon or parentheses), never invent facts that are not in the input, never mention serial numbers or where the item is stored. Return the post text only.`,
    messages: [{ role: "user", content: facts }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  return {
    text: text || null,
    model: response.model,
    inputTokens,
    outputTokens,
    costUsd:
      (inputTokens * INPUT_USD_PER_MTOK + outputTokens * OUTPUT_USD_PER_MTOK) / 1_000_000,
    durationMs: Date.now() - started,
  };
}
