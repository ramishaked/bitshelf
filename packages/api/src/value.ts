import config from "./value-config.json";

// Three point value from price observations (spec 9). No AI anywhere here;
// the coefficients live in value-config.json, not in code.

export interface ValueObservation {
  price: number;
  source: string;
  observedAt: Date;
}

export interface ValueItemFacts {
  workingStatus: string | null;
  completeness: string | null;
  conditionGrade: number | null;
}

export interface ValueResult {
  low: number;
  fair: number;
  high: number;
  confidence: "none" | "low" | "medium" | "high";
  askingCount: number;
  soldCount: number;
}

function weightedPercentile(sorted: { price: number; weight: number }[], p: number): number {
  const total = sorted.reduce((sum, o) => sum + o.weight, 0);
  let acc = 0;
  for (const o of sorted) {
    acc += o.weight;
    if (acc >= total * p) return o.price;
  }
  return sorted[sorted.length - 1]?.price ?? 0;
}

export function computeValue(
  observations: ValueObservation[],
  facts: ValueItemFacts,
  now = new Date(),
): ValueResult | null {
  const maxAgeMs = config.max_observation_age_days * 86_400_000;
  const relevant = observations.filter(
    (o) => now.getTime() - o.observedAt.getTime() <= maxAgeMs && o.price > 0,
  );
  const soldCount = relevant.filter((o) => o.source === "ebay_sold").length;
  const askingCount = relevant.length - soldCount;
  if (relevant.length === 0) return null;

  const weighted = relevant
    .map((o) => ({
      price: o.price,
      // sold observations count double (spec 9.2)
      weight: o.source === "ebay_sold" ? config.sold_weight : 1,
    }))
    .sort((a, b) => a.price - b.price);

  let low = weightedPercentile(weighted, 0.25);
  let fair = weightedPercentile(weighted, 0.5);
  let high = weightedPercentile(weighted, 0.75);

  const statusFactor =
    (config.working_status_factor as Record<string, number>)[
      facts.workingStatus ?? "untested"
    ] ?? 1;
  const completenessFactor =
    (config.completeness_factor as Record<string, number>)[facts.completeness ?? ""] ?? 1;
  const conditionFactor =
    facts.conditionGrade != null && facts.conditionGrade <= config.low_condition_max_grade
      ? config.low_condition_factor
      : 1;
  const factor = statusFactor * completenessFactor * conditionFactor;
  low = Math.round(low * factor);
  fair = Math.round(fair * factor);
  high = Math.round(high * factor);

  const confidence: ValueResult["confidence"] =
    soldCount >= 3
      ? "high"
      : askingCount >= 4
        ? "medium"
        : "low";

  return { low, fair, high, confidence, askingCount, soldCount };
}
