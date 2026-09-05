import Anthropic from "@anthropic-ai/sdk";
import type { IdentifyImage } from "./identify";

// Shelf scan (spec 6.3): one photo of a whole shelf, Opus returns every
// distinct item with an approximate bounding box (fractions of the image)
// plus a preliminary identification. Opus is reserved for this call (spec 1);
// accuracy beats latency here, so thinking stays at the model default.
export const SHELF_SCAN_MODEL = "claude-opus-5";

// Opus 5 pricing per 1M tokens, for the AiJob cost record
const INPUT_USD_PER_MTOK = 5;
const OUTPUT_USD_PER_MTOK = 25;

// Kept in code rather than in the seed: the seed's ai_system_prompt belongs
// to single item identification; the scan prompt is feature-flagged code.
const SYSTEM_PROMPT = `You are cataloging a shelf of retro computers, consoles, peripherals and software for a collection manager.

You receive one photo of a shelf. Find every distinct collectible item that is visible. For each item return:
- "box": approximate bounding box as fractions of the image, {"x","y","w","h"}, each 0..1, x/y is the top-left corner.
- "category": one of "computer", "console", "peripheral", "accessory", "software", "media", "book", "other".
- "title": short display name, e.g. "Commodore 64" or "Apple IIc".
- "attributes": object with any of "manufacturer", "model", "variant", "year", "platform", "publisher" you can tell. Strings, year as a number. Omit what you cannot tell.
- "confidence": 0..1 for the identification (not the box).

Rules:
- Only physical collectible items. Skip furniture, cables in a pile, labels, decorations.
- Each physical item once, even when items overlap.
- Identification is preliminary: prefer a generic correct answer over a specific guess. Use "confidence" honestly, identification from a shelf photo is hard.
- Boxes should cover the visible item tightly. They may overlap.
- Return JSON only, no code fences, in the form {"items":[...]}. If nothing is identifiable return {"items":[]}.`;

export interface ShelfScanBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ShelfScanItem {
  box: ShelfScanBox;
  category: string;
  title: string;
  attributes: Record<string, unknown>;
  confidence: number;
}

export interface ShelfScanOutcome {
  items: ShelfScanItem[] | null;
  rawText: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

function clamp01(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n)
    ? Math.min(1, Math.max(0, n))
    : null;
}

function parseItems(rawText: string): ShelfScanItem[] | null {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return null;
    const items: ShelfScanItem[] = [];
    for (const raw of parsed.items) {
      const v = raw as ShelfScanItem;
      const x = clamp01(v.box?.x);
      const y = clamp01(v.box?.y);
      const w = clamp01(v.box?.w);
      const h = clamp01(v.box?.h);
      if (
        x == null || y == null || w == null || h == null || w === 0 || h === 0 ||
        typeof v.title !== "string" || v.title === "" ||
        typeof v.category !== "string"
      ) {
        continue;
      }
      items.push({
        box: { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) },
        category: v.category,
        title: v.title,
        attributes:
          v.attributes != null && typeof v.attributes === "object"
            ? v.attributes
            : {},
        confidence: clamp01(v.confidence) ?? 0.5,
      });
    }
    return items;
  } catch {
    return null;
  }
}

export async function scanShelf(image: IdentifyImage): Promise<ShelfScanOutcome> {
  const client = new Anthropic();
  const started = Date.now();
  const response = await client.messages.create({
    model: SHELF_SCAN_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mediaType,
              data: image.base64,
            },
          },
          { type: "text", text: "Scan this shelf. JSON only." },
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
    items: parseItems(rawText),
    rawText,
    model: response.model,
    inputTokens,
    outputTokens,
    costUsd:
      (inputTokens * INPUT_USD_PER_MTOK + outputTokens * OUTPUT_USD_PER_MTOK) / 1_000_000,
    durationMs: Date.now() - started,
  };
}
