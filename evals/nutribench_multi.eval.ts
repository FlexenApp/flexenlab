// Multi-provider NutriBench runner.
//
// Tests multiple LLMs against the same NutriBench sample with the SAME prompt,
// so we get an honest cross-provider comparison for model selection
// (Smart Router B4.2, fine-tune decision, etc.).
//
// Providers supported:
//   - google:       Vertex/Gemini via @google/genai (GEMINI_API_KEY)
//   - openai:       Official OpenAI API (OPENAI_API_KEY)
//   - ollama:       Ollama Cloud, OpenAI-compatible endpoint (OLLAMA_API_KEY, OLLAMA_HOST)
//   - anthropic:    Claude via @anthropic-ai/sdk (ANTHROPIC_API_KEY)
//
// Usage:
//   MODEL_PROVIDER=openai MODEL_NAME=gpt-5-mini \
//     EVAL_NAME="NutriBench gpt-5-mini" \
//     NUTRIBENCH_FILE=nutribench_sample_balanced.json \
//     npx braintrust eval nutribench_multi.eval.ts
//
// For a full sweep use the shell loop in run_sweep.sh (see sibling file).

import "dotenv/config";
import fs from "fs";
import { Eval, currentSpan } from "braintrust";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const PROVIDER = (process.env.MODEL_PROVIDER ?? "google").toLowerCase();
const MODEL_NAME = process.env.MODEL_NAME ?? "gemini-3-flash-preview";
const TEMPERATURE = Number(process.env.TEMPERATURE ?? "0.1");
const MAX_TOKENS = Number(process.env.MAX_TOKENS ?? "4096"); // high enough for reasoning models

// Pricing per 1M tokens (April 2026). Source: provider dashboards + public pages.
// Ollama Cloud = flat subscription → cost per call treated as 0 for sweep purposes.
const PRICING: Record<string, { in: number; out: number }> = {
  // Google Gemini
  "gemini-3-flash-preview":    { in: 0.30, out: 2.50 },
  "gemini-3-pro-preview":      { in: 1.25, out: 10.0 },
  "gemini-2.5-pro":            { in: 1.25, out: 10.0 },
  "gemini-2.5-flash":          { in: 0.15, out: 0.60 },
  "gemini-2.5-flash-lite":     { in: 0.075, out: 0.30 },
  // OpenAI — classic (non-reasoning)
  "gpt-4.1":                   { in: 2.00, out: 8.00 },
  "gpt-4.1-mini":              { in: 0.40, out: 1.60 },
  "gpt-4.1-nano":              { in: 0.10, out: 0.40 },
  // OpenAI — GPT-5 series (reasoning)
  "gpt-5":                     { in: 1.25, out: 10.0 },
  "gpt-5-mini":                { in: 0.25, out: 2.00 },
  "gpt-5-nano":                { in: 0.05, out: 0.40 },
  // OpenAI — GPT-5.1 / 5.2 / 5.4 (newer reasoning)
  "gpt-5.1":                   { in: 1.25, out: 10.0 },
  "gpt-5.2":                   { in: 1.25, out: 10.0 },
  "gpt-5.4":                   { in: 2.50, out: 10.0 },
  "gpt-5.4-mini":              { in: 0.25, out: 2.00 },
  "gpt-5.4-nano":              { in: 0.05, out: 0.40 },
  // Anthropic
  "claude-haiku-4-5-20251001": { in: 0.80, out: 4.00 },
  "claude-sonnet-4-5-20250929":{ in: 3.00, out: 15.0 },
  "claude-sonnet-4-6":         { in: 3.00, out: 15.0 },
  "claude-opus-4-5-20251101":  { in: 15.0, out: 75.0 },
  "claude-opus-4-6":           { in: 15.0, out: 75.0 },
};
function priceFor(model: string): { in: number; out: number } {
  return PRICING[model] ?? { in: 0, out: 0 };
}

// ── Prompt (identical to production, mirrored from food_recognition_service.dart) ──
// Set LONG_PROMPT=1 to use an expanded variant with calibration examples +
// edge-case handling + negative examples (from long_prompt_variant.ts).
import { LONG_COT_INSTRUCTIONS } from "./long_prompt_variant";
const SHORT_COT = `ESTIMATION PROCESS (mandatory steps):
1. IDENTIFY: Food item(s), preparation method, cultural context from language.
2. WEIGH: Estimate serving weight in grams. State reasoning briefly.
3. LOOKUP: Recall per-100g macros from USDA reference data.
4. CALCULATE: Multiply per-100g values by (serving_weight / 100).
5. VERIFY: protein(g)*4 + carbs(g)*4 + fat(g)*9 must be within 10% of kcal. If not, recalculate kcal from macros.
6. CONFIDENCE: HIGH (well-known food, clear portion), MEDIUM (some ambiguity), LOW (complex/unclear).

ACCURACY RULES:
- Cooked chicken breast = 31g protein per 100g. Lean beef = 26g/100g. Eggs = 13g/100g.
- Cooking method matters: fried adds 10-15% weight in oil (~120 kcal per tbsp absorbed). Grilled/baked adds minimal fat.
- US portion sizes by default.

Return ONLY a JSON object with these exact keys:
  name (string), kcal (number), carbsG (number), proteinG (number),
  fatG (number), servingSize (string), confidence ("HIGH"|"MEDIUM"|"LOW"),
  reasoning (string).`;
const COT_INSTRUCTIONS = process.env.LONG_PROMPT === "1" ? LONG_COT_INSTRUCTIONS : SHORT_COT;
if (process.env.LONG_PROMPT === "1") console.log("[prompt] Using LONG prompt variant with calibration examples");

type NutriBenchCase = {
  meal_description: string;
  carb: number; fat: number; energy: number; protein: number;
  country: string; serving_type: string;
};

type RawNutrition = {
  name: string; kcal: number; carbsG: number; proteinG: number; fatG: number;
  servingSize: string; confidence: "HIGH" | "MEDIUM" | "LOW"; reasoning?: string;
};

const SAMPLE_FILE = process.env.NUTRIBENCH_FILE ?? "nutribench_sample_balanced.json";
const SAMPLE: NutriBenchCase[] = JSON.parse(fs.readFileSync(SAMPLE_FILE, "utf8"));
console.log(`[${PROVIDER}/${MODEL_NAME}] Loaded ${SAMPLE.length} cases from ${SAMPLE_FILE}`);

// ── Provider clients (lazy) ──
let googleClient: GoogleGenAI | null = null;
let openaiClient: OpenAI | null = null;
let ollamaClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function getGoogle(): GoogleGenAI {
  return googleClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
}
function getOpenAI(): OpenAI {
  return openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
}
function getOllama(): OpenAI {
  const host = process.env.OLLAMA_HOST ?? "https://ollama.com";
  return ollamaClient ??= new OpenAI({
    apiKey: process.env.OLLAMA_API_KEY!,
    baseURL: `${host}/v1`,
  });
}
function getAnthropic(): Anthropic {
  return anthropicClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

// ── Model invocation per provider ──
function buildPrompt(input: NutriBenchCase): string {
  return `You are a certified nutritionist. Estimate the nutritional content of the described food.

CONTEXT:
- Region: United States

${COT_INSTRUCTIONS}

Food to estimate: <user_input>${input.meal_description}</user_input>`;
}

const googleSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    kcal: { type: Type.NUMBER },
    carbsG: { type: Type.NUMBER },
    proteinG: { type: Type.NUMBER },
    fatG: { type: Type.NUMBER },
    servingSize: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
    reasoning: { type: Type.STRING },
  },
  required: ["name", "kcal", "carbsG", "proteinG", "fatG", "servingSize", "confidence"],
};

type CallResult = { raw: RawNutrition; inputTokens: number; outputTokens: number };

// Extract a JSON object from noisy model output (handles markdown fences,
// leading prose, reasoning-model "content empty, answer in text" weirdness).
function extractJson(txt: string): string {
  if (!txt) return "{}";
  // Strip markdown fences
  let t = txt.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  // Find first { ... last } span
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.substring(first, last + 1);
  return t;
}

async function callGoogle(prompt: string): Promise<CallResult> {
  const res = await getGoogle().models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      temperature: TEMPERATURE,
      responseMimeType: "application/json",
      responseSchema: googleSchema,
      maxOutputTokens: MAX_TOKENS,
    },
  });
  const usage = (res as any).usageMetadata ?? {};
  return {
    raw: JSON.parse(extractJson(res.text ?? "{}")),
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
  };
}

async function callOpenAICompatible(client: OpenAI, prompt: string, useJsonMode = true): Promise<CallResult> {
  // GPT-5 family (reasoning) use max_completion_tokens and don't allow temperature override
  const isGpt5Reasoning = /^gpt-5/.test(MODEL_NAME);
  const body: any = {
    model: MODEL_NAME,
    messages: [
      { role: "system", content: "You are a nutritionist. Respond with a single valid JSON object only. No prose, no markdown fences, no reasoning — just the JSON." },
      { role: "user", content: prompt },
    ],
  };
  if (isGpt5Reasoning) {
    body.max_completion_tokens = MAX_TOKENS;
  } else {
    body.temperature = TEMPERATURE;
    body.max_tokens = MAX_TOKENS;
  }
  if (useJsonMode) body.response_format = { type: "json_object" };
  const res = await client.chat.completions.create(body);
  const msg = res.choices[0]?.message as any;
  // Reasoning models leave content empty and put everything in `reasoning`.
  // If content is empty, try reasoning field as fallback.
  const txt = (msg?.content && msg.content.trim()) ? msg.content : (msg?.reasoning ?? "{}");
  const usage = res.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
  return {
    raw: JSON.parse(extractJson(txt)),
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
  };
}

async function callAnthropic(prompt: string): Promise<CallResult> {
  const res = await getAnthropic().messages.create({
    model: MODEL_NAME,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: "You respond with valid JSON only. No prose outside the JSON object.",
    messages: [{ role: "user", content: prompt }],
  });
  const block = res.content.find((c) => c.type === "text") as { type: "text"; text: string } | undefined;
  return {
    raw: JSON.parse(extractJson(block?.text ?? "{}")),
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
  };
}

async function dispatch(prompt: string): Promise<CallResult> {
  switch (PROVIDER) {
    case "google":    return callGoogle(prompt);
    case "openai":    return callOpenAICompatible(getOpenAI(), prompt);
    case "ollama":    return callOpenAICompatible(getOllama(), prompt, false); // Ollama's json_object mode is flaky for reasoning models
    case "anthropic": return callAnthropic(prompt);
    default: throw new Error(`Unknown MODEL_PROVIDER: ${PROVIDER}`);
  }
}

// ── Metric aggregation (paper-comparable) ──
const agg = {
  n: 0, maeKcal: 0, maeCarbs: 0, maeProtein: 0, maeFat: 0,
  accCarbs: 0, accKcal20: 0, errors: 0,
  inputTokens: 0, outputTokens: 0, totalCost: 0,
};
process.on("exit", () => {
  // Always append a row to results CSV so we can tabulate after the sweep
  try {
    const f = "sweep_results.csv";
    const header = "provider,model,n,errors,macro_agg_proxy,acc7_5,kcal_acc20,mae_kcal,mae_carbs,avg_in,avg_out,cost_per_call,cost_per_1k\n";
    if (!fs.existsSync(f)) fs.writeFileSync(f, header);
    const n = agg.n || 1;
    const row = [
      PROVIDER, MODEL_NAME, agg.n, agg.errors,
      "-", // macro_agg computed by braintrust, not here
      ((agg.accCarbs / n) * 100).toFixed(2),
      ((agg.accKcal20 / n) * 100).toFixed(2),
      (agg.maeKcal / n).toFixed(2),
      (agg.maeCarbs / n).toFixed(2),
      (agg.inputTokens / n).toFixed(0),
      (agg.outputTokens / n).toFixed(0),
      (agg.totalCost / n).toFixed(6),
      ((agg.totalCost / n) * 1000).toFixed(3),
    ].join(",");
    fs.appendFileSync(f, row + "\n");
  } catch {}

  if (agg.n === 0) return;
  const f = (x: number) => x.toFixed(2);
  const avgIn = agg.inputTokens / agg.n;
  const avgOut = agg.outputTokens / agg.n;
  const costPerCall = agg.totalCost / agg.n;
  console.log(`\n=== ${PROVIDER}/${MODEL_NAME} — NutriBench RAW METRICS ===`);
  console.log(`n = ${agg.n} cases  (errors/skipped: ${agg.errors})`);
  console.log(`Accuracy@7.5g (carbs): ${f((agg.accCarbs / agg.n) * 100)}%`);
  console.log(`MAE carbs:    ${f(agg.maeCarbs / agg.n)} g`);
  console.log(`MAE protein:  ${f(agg.maeProtein / agg.n)} g`);
  console.log(`MAE fat:      ${f(agg.maeFat / agg.n)} g`);
  console.log(`MAE kcal:     ${f(agg.maeKcal / agg.n)} kcal`);
  console.log(`kcal Acc@±20%: ${f((agg.accKcal20 / agg.n) * 100)}%`);
  console.log(`Avg tokens:   ${avgIn.toFixed(0)} in / ${avgOut.toFixed(0)} out`);
  console.log(`Avg cost:     $${costPerCall.toFixed(6)} / call  (per 1k: $${(costPerCall * 1000).toFixed(3)})`);
  console.log("=========================================================");
});

async function task(input: NutriBenchCase): Promise<RawNutrition> {
  let result: CallResult;
  try {
    result = await dispatch(buildPrompt(input));
  } catch (e) {
    agg.errors++;
    console.error(`[${MODEL_NAME}] error:`, (e as Error).message?.substring(0, 200));
    return { name: "ERROR", kcal: 0, carbsG: 0, proteinG: 0, fatG: 0, servingSize: "", confidence: "LOW" };
  }
  const raw = result.raw;
  // Coerce numeric fields — reasoning models sometimes return strings like "~500" or null
  const num = (v: any): number => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const m = v.match(/-?\d+(\.\d+)?/);
      if (m) return parseFloat(m[0]);
    }
    return 0;
  };
  raw.kcal = num(raw.kcal);
  raw.carbsG = num(raw.carbsG);
  raw.proteinG = num(raw.proteinG);
  raw.fatG = num(raw.fatG);

  // Cost accounting
  const p = priceFor(MODEL_NAME);
  const cost = (result.inputTokens / 1e6) * p.in + (result.outputTokens / 1e6) * p.out;
  agg.inputTokens += result.inputTokens;
  agg.outputTokens += result.outputTokens;
  agg.totalCost += cost;

  const errCarb = Math.abs(raw.carbsG - input.carb);
  const errProtein = Math.abs(raw.proteinG - input.protein);
  const errFat = Math.abs(raw.fatG - input.fat);
  const errKcal = Math.abs(raw.kcal - input.energy);
  agg.n++;
  agg.maeKcal += errKcal;
  agg.maeCarbs += errCarb;
  agg.maeProtein += errProtein;
  agg.maeFat += errFat;
  if (errCarb <= 7.5) agg.accCarbs++;
  if (errKcal / Math.max(input.energy, 50) <= 0.2) agg.accKcal20++;

  try {
    currentSpan().log({
      metrics: {
        mae_kcal_g: errKcal, mae_carbs_g: errCarb, mae_protein_g: errProtein, mae_fat_g: errFat,
        input_tokens: result.inputTokens, output_tokens: result.outputTokens, cost_usd: cost,
      },
      metadata: { provider: PROVIDER, model: MODEL_NAME },
    });
  } catch {}

  // Per-case detail log for error analysis (DETAIL_LOG=<filename>)
  if (process.env.DETAIL_LOG) {
    try {
      const line = JSON.stringify({
        model: MODEL_NAME,
        query: input.meal_description,
        query_len: input.meal_description.length,
        country: input.country,
        serving_type: input.serving_type,
        gt_kcal: input.energy, pred_kcal: raw.kcal, err_kcal: errKcal,
        gt_carbs: input.carb, pred_carbs: raw.carbsG, err_carbs: errCarb,
        gt_protein: input.protein, pred_protein: raw.proteinG, err_protein: errProtein,
        gt_fat: input.fat, pred_fat: raw.fatG, err_fat: errFat,
        confidence: raw.confidence,
        acc7_5: errCarb <= 7.5,
        kcal_acc20: errKcal / Math.max(input.energy, 50) <= 0.2,
      });
      fs.appendFileSync(process.env.DETAIL_LOG, line + "\n");
    } catch {}
  }

  return raw;
}

// ── Scorers (identical to nutribench.eval.ts for apples-to-apples) ──
const Acc7p5Carbs = ({ output, expected }: { output: RawNutrition; expected: NutriBenchCase }) => ({
  name: "nutribench_acc_at_7.5_carbs",
  score: Math.abs(output.carbsG - expected.carb) <= 7.5 ? 1 : 0,
});
const KcalAcc20Pct = ({ output, expected }: { output: RawNutrition; expected: NutriBenchCase }) => ({
  name: "kcal_acc_within_20_pct",
  score: Math.abs(output.kcal - expected.energy) / Math.max(expected.energy, 50) <= 0.2 ? 1 : 0,
});
const MacroAggregate = ({ output, expected }: { output: RawNutrition; expected: NutriBenchCase }) => {
  const weights = { kcal: 0.4, protein: 0.25, carbs: 0.2, fat: 0.15 };
  const tol = 0.25;
  const s = (a: number, e: number) => {
    const pct = Math.abs(a - e) / Math.max(Math.abs(e), 5);
    if (pct <= tol) return 1;
    if (pct >= 2 * tol) return 0;
    return 1 - (pct - tol) / tol;
  };
  return {
    name: "macro_aggregate",
    score:
      s(output.kcal, expected.energy) * weights.kcal +
      s(output.proteinG, expected.protein) * weights.protein +
      s(output.carbsG, expected.carb) * weights.carbs +
      s(output.fatG, expected.fat) * weights.fat,
  };
};

Eval("flexen-food-text-multi", {
  experimentName: process.env.EVAL_NAME ?? `NutriBench — ${PROVIDER}/${MODEL_NAME}`,
  data: () =>
    SAMPLE.map((c, i) => ({
      input: c,
      expected: c,
      metadata: { country: c.country, serving_type: c.serving_type, idx: i, provider: PROVIDER, model: MODEL_NAME },
    })),
  task,
  scores: [MacroAggregate, Acc7p5Carbs, KcalAcc20Pct],
  trialCount: 1,
  maxConcurrency: Number(process.env.MAX_CONCURRENCY ?? "4"),
});
