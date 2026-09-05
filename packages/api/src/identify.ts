import Anthropic from "@anthropic-ai/sdk";

// Single item identification (spec 6.1, 6.2): one Claude call with all the
// photos and the CollectionType's system prompt, JSON out. Routine
// identification runs on Sonnet; Opus is reserved for shelf scan (spec 1).
export const IDENTIFY_MODEL = "claude-sonnet-5";

// Sonnet 5 pricing per 1M tokens, for the AiJob cost record
const INPUT_USD_PER_MTOK = 2;
const OUTPUT_USD_PER_MTOK = 10;

export type IdentifyMediaType = "image/jpeg" | "image/png" | "image/webp";

export interface IdentifyImage {
  base64: string;
  mediaType: IdentifyMediaType;
}

// Shape mandated by the seed's ai_system_prompt. Unknown keys are ignored by
// the client (spec 6.1 step 3).
export interface IdentifyResult {
  category: string;
  title: string;
  attributes: Record<string, unknown>;
  confidence: number;
  field_confidence?: Record<string, number>;
  alternatives?: string[];
  notes?: string | null;
}

export interface IdentifyOutcome {
  result: IdentifyResult | null;
  rawText: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

function parseResult(rawText: string): IdentifyResult | null {
  // the prompt forbids fences, strip them anyway if the model slips
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned) as IdentifyResult;
    if (typeof parsed.category !== "string" || typeof parsed.attributes !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function identifyItem(
  images: IdentifyImage[],
  systemPrompt: string,
): Promise<IdentifyOutcome> {
  const client = new Anthropic();
  const started = Date.now();
  const response = await client.messages.create({
    model: IDENTIFY_MODEL,
    max_tokens: 2048,
    // identification is latency sensitive (spec target: 4 to 8 seconds)
    output_config: { effort: "low" },
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          ...images.map((image) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: image.mediaType,
              data: image.base64,
            },
          })),
          { type: "text" as const, text: "Identify this item. JSON only." },
        ],
      },
    ],
  });

  const rawText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  return {
    result: parseResult(rawText),
    rawText,
    model: response.model,
    inputTokens,
    outputTokens,
    costUsd:
      (inputTokens * INPUT_USD_PER_MTOK + outputTokens * OUTPUT_USD_PER_MTOK) / 1_000_000,
    durationMs: Date.now() - started,
  };
}
