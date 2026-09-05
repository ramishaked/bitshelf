import Anthropic from "@anthropic-ai/sdk";

// ModelReference generation (spec 4.6.1): one Claude call with web search,
// fixed JSON out, Hebrew and English. Links are verified before saving and
// broken ones are dropped; the AI must not invent URLs.

export const MODEL_REFERENCE_MODEL = "claude-opus-5";

// Opus 5 pricing per 1M tokens, for the AiJob cost record
const INPUT_USD_PER_MTOK = 5;
const OUTPUT_USD_PER_MTOK = 25;

const SYSTEM_PROMPT = `You write reference entries about retro computers, consoles and peripherals for a collector's app. The UI language is Hebrew.

You get a manufacturer, model and optional variant. Use web search to verify facts. Return JSON only, no code fences:

{
  "release_year": 1984,
  "discontinued_year": 1988,
  "summary": {
    "he": "3-5 short sentences in Hebrew: what it is, why it matters historically, what is special about this variant.",
    "en": "The same in English."
  },
  "specs": { "CPU": "...", "Speed": "...", "RAM": "...", "Graphics": "...", "Sound": "...", "Media": "...", "Ports": "...", "Launch price": "..." },
  "links": [ { "label": "Wikipedia", "url": "https://..." } ],
  "tips": {
    "he": ["1-3 short collector tips in Hebrew: sought-after variants, common faults, value drivers."],
    "en": ["The same in English."]
  },
  "known_versions": "short comma separated list, e.g. ROM 255, 0, 3, 4X"
}

Rules:
- Hebrew is spoken-professional, short, no translationese. Latin model names stay in Latin.
- Only include links whose URL you actually saw in search results. Never invent a URL. 2 to 4 links: Wikipedia first, then a specialist source (Old-Computers, Apple2History, AtariAge and similar).
- Omit spec keys you are not sure about. A number you could not verify gets " (לא מאומת)" appended in the value.
- No em dashes anywhere. Use comma, period, colon or parentheses.`;

export interface ModelReferenceData {
  release_year?: number | null;
  discontinued_year?: number | null;
  summary: { he?: string; en?: string };
  specs?: Record<string, string>;
  links?: { label: string; url: string }[];
  tips?: { he?: string[]; en?: string[] };
  known_versions?: string | null;
}

export interface ModelReferenceOutcome {
  data: ModelReferenceData | null;
  rawText: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

function parseData(rawText: string): ModelReferenceData | null {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  // the answer may carry prose around the JSON when search results are cited
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as ModelReferenceData;
    if (parsed.summary == null || typeof parsed.summary !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

// spec 4.6.1: every link must answer before it is saved, broken ones are dropped
async function verifyLinks(
  links: { label: string; url: string }[],
): Promise<{ label: string; url: string }[]> {
  const checks = await Promise.all(
    links
      .filter((l) => typeof l.url === "string" && l.url.startsWith("https://"))
      .slice(0, 5)
      .map(async (link) => {
        try {
          const response = await fetch(link.url, {
            method: "HEAD",
            redirect: "follow",
            signal: AbortSignal.timeout(8000),
          });
          return response.ok ? link : null;
        } catch {
          return null;
        }
      }),
  );
  return checks.filter((l): l is { label: string; url: string } => l != null);
}

export async function generateModelReference(
  manufacturer: string,
  model: string,
  variant: string,
): Promise<ModelReferenceOutcome> {
  const client = new Anthropic();
  const started = Date.now();
  const subject = variant ? `${manufacturer} ${model} (${variant})` : `${manufacturer} ${model}`;
  const response = await client.messages.create({
    model: MODEL_REFERENCE_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    messages: [
      {
        role: "user",
        content: `Write the reference entry for: ${subject}. JSON only.`,
      },
    ],
  });

  const rawText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const data = parseData(rawText);
  if (data?.links) {
    data.links = await verifyLinks(data.links);
  }

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  return {
    data,
    rawText,
    model: response.model,
    inputTokens,
    outputTokens,
    costUsd:
      (inputTokens * INPUT_USD_PER_MTOK + outputTokens * OUTPUT_USD_PER_MTOK) / 1_000_000,
    durationMs: Date.now() - started,
  };
}
