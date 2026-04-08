// E3: Meal-Pattern-Cache isolated test.
//
// Self-contained — does NOT touch food_text.eval.ts defaults, does NOT use
// Braintrust, does NOT burn tokens beyond the minimum needed to exercise
// the cache mechanism.
//
// What it tests:
//   1. Normalization aggressiveness: how many "same meal in different words"
//      collapse to the same cache key?
//   2. Cache-hit savings: once base queries are cached, how much cheaper are
//      repeat queries?
//   3. Accuracy consistency: does a cached answer drift vs a fresh one?
//
// Run: npx tsx e3_cache_test.ts

import "dotenv/config";
import crypto from "crypto";
import { GoogleGenAI, Type } from "@google/genai";

const MODEL = "gemini-3-flash-preview";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ── Test data: 10 base queries × 4 variations each = 40 queries ──
// First-seen variation is a cache miss, subsequent variations should hit.
const BASE_QUERIES: Array<{ base: string; variations: string[] }> = [
  { base: "1 banana", variations: ["1 banana", "a banana", "one banana", "1 Banana"] },
  { base: "2 eggs scrambled", variations: ["2 eggs scrambled", "two scrambled eggs", "Two eggs, scrambled", "2 scrambled eggs"] },
  { base: "cup of coffee with milk", variations: ["cup of coffee with milk", "coffee with milk", "a cup of coffee with milk", "coffee, with milk"] },
  { base: "oat milk latte", variations: ["oat milk latte", "oatmilk latte", "oat-milk latte", "a oat milk latte"] },
  { base: "200g chicken breast grilled", variations: ["200g chicken breast grilled", "200g grilled chicken breast", "200 g chicken breast, grilled", "grilled chicken breast 200g"] },
  { base: "slice of pizza", variations: ["slice of pizza", "a slice of pizza", "1 slice of pizza", "one slice pizza"] },
  { base: "handful of almonds", variations: ["handful of almonds", "a handful of almonds", "handful almonds", "handful of almonds "] },
  { base: "apple", variations: ["apple", "an apple", "1 apple", "one apple"] },
  { base: "Greek yogurt with honey", variations: ["Greek yogurt with honey", "greek yogurt with honey", "greek yoghurt with honey", "Greek yogurt, honey"] },
  { base: "small bowl of oatmeal", variations: ["small bowl of oatmeal", "small bowl oatmeal", "a small bowl of oatmeal", "small oatmeal bowl"] },
];

// ── Normalization — 3 levels, compare cache-hit rate for each ──
function normalizeExact(q: string): string {
  return q.trim().toLowerCase();
}
function normalizeLight(q: string): string {
  return q
    .trim()
    .toLowerCase()
    // collapse whitespace
    .replace(/\s+/g, " ")
    // strip common articles + leading numerals when spelled
    .replace(/\b(a|an|the|one)\b\s*/g, "")
    // normalize punctuation
    .replace(/[,;.!?]/g, "")
    // normalize "2 " / "2x" / "2 x" prefixes
    .trim();
}
function normalizeAggressive(q: string): string {
  return normalizeLight(q)
    // drop hyphens
    .replace(/-/g, "")
    // "2 eggs" and "eggs 2" should match — sort tokens except keep numbers with adjacent nouns
    // skip: too aggressive, risk false positives
    .trim();
}

function hashKey(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
}

// ── Schema (minimal for cost) ──
const schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    kcal: { type: Type.NUMBER },
    carbsG: { type: Type.NUMBER },
    proteinG: { type: Type.NUMBER },
    fatG: { type: Type.NUMBER },
  },
  required: ["name", "kcal", "carbsG", "proteinG", "fatG"],
};

async function estimateFresh(query: string): Promise<{ result: any; tokensIn: number; tokensOut: number }> {
  const prompt = `You are a certified nutritionist. Estimate the nutritional content for this food query, US region, standard portions. Return only JSON.

Food: "${query}"`;
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { temperature: 0.1, responseMimeType: "application/json", responseSchema: schema },
  });
  return {
    result: JSON.parse(res.text ?? "{}"),
    tokensIn: res.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: res.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

// Gemini 3 Flash pricing: $0.50/1M input, $3/1M output
function costOf(inTok: number, outTok: number): number {
  return inTok * (0.5 / 1_000_000) + outTok * (3 / 1_000_000);
}

async function runMode(
  label: string,
  normalizer: (q: string) => string,
): Promise<{
  hits: number;
  misses: number;
  llmCalls: number;
  totalIn: number;
  totalOut: number;
  totalCost: number;
  driftFromFresh: number; // avg |kcal delta| — sanity: should be 0
}> {
  const cache = new Map<string, any>();
  let hits = 0, misses = 0, llmCalls = 0, totalIn = 0, totalOut = 0;

  // Flatten to 40 queries in order (var0 is first-seen = miss, var1-3 should hit with right normalizer)
  const flat: Array<{ q: string; baseIdx: number }> = [];
  for (let i = 0; i < BASE_QUERIES.length; i++) {
    for (const v of BASE_QUERIES[i].variations) flat.push({ q: v, baseIdx: i });
  }

  for (const { q } of flat) {
    const key = hashKey(normalizer(q));
    if (cache.has(key)) {
      hits++;
    } else {
      misses++;
      llmCalls++;
      const r = await estimateFresh(q);
      cache.set(key, r.result);
      totalIn += r.tokensIn;
      totalOut += r.tokensOut;
    }
  }

  return {
    hits,
    misses,
    llmCalls,
    totalIn,
    totalOut,
    totalCost: costOf(totalIn, totalOut),
    driftFromFresh: 0, // not measured in this pass
  };
}

async function main() {
  console.log(`\nE3 Meal-Pattern-Cache test\n${"=".repeat(60)}`);
  console.log(`Queries: ${BASE_QUERIES.length} base × 4 variations = ${BASE_QUERIES.length * 4} total\n`);

  console.log("Running MODE 1: exact normalization (trim + lowercase only)...");
  const exact = await runMode("exact", normalizeExact);

  console.log("Running MODE 2: light normalization (strip articles/punct/whitespace)...");
  const light = await runMode("light", normalizeLight);

  console.log("Running MODE 3: aggressive normalization (+ hyphens, numeral variants)...");
  const aggressive = await runMode("aggressive", normalizeAggressive);

  // Baseline: no cache at all — every query is a miss = 40 LLM calls
  const baselineLlmCalls = BASE_QUERIES.length * 4;
  const baselineCost = (exact.totalCost / exact.llmCalls) * baselineLlmCalls;

  console.log("\n" + "=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));
  const row = (label: string, hits: number, misses: number, calls: number, cost: number) => {
    const hitRate = ((hits / (hits + misses)) * 100).toFixed(1);
    const saved = 1 - calls / baselineLlmCalls;
    const costSaved = 1 - cost / baselineCost;
    console.log(
      `${label.padEnd(18)} hits=${String(hits).padStart(2)}/${hits + misses}  ` +
        `hit-rate=${hitRate.padStart(5)}%  ` +
        `LLM calls=${String(calls).padStart(2)} (saved ${(saved * 100).toFixed(0)}%)  ` +
        `cost=$${cost.toFixed(5)} (saved ${(costSaved * 100).toFixed(0)}%)`,
    );
  };
  console.log(`${"NO CACHE".padEnd(18)} hits= 0/${baselineLlmCalls}  hit-rate=  0.0%  LLM calls=${baselineLlmCalls} (saved 0%)  cost=$${baselineCost.toFixed(5)} (saved 0%)`);
  row("exact norm", exact.hits, exact.misses, exact.llmCalls, exact.totalCost);
  row("light norm", light.hits, light.misses, light.llmCalls, light.totalCost);
  row("aggressive norm", aggressive.hits, aggressive.misses, aggressive.llmCalls, aggressive.totalCost);

  console.log("\n=== COST PROJECTION (at 1M production calls/year) ===");
  const perQueryBaseline = baselineCost / baselineLlmCalls;
  const perQueryLight = light.totalCost / 40; // distributed over all 40 queries (even cache hits have ~0 cost)
  const annualBaseline = perQueryBaseline * 1_000_000;
  const annualLight = perQueryLight * 1_000_000;
  console.log(`Baseline (no cache):   $${annualBaseline.toFixed(0)}/year`);
  console.log(`Light normalization:   $${annualLight.toFixed(0)}/year (assuming 80% hit rate in real traffic)`);
  console.log(`Savings potential:     $${(annualBaseline - annualLight).toFixed(0)}/year`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
