// Multi-provider image eval on Nutrition5k.
// Same prompt as production analyzeImage. Cross-provider comparison only
// for Vision-capable models that realistically fit Flexen's cost/quality band.
//
// Usage:
//   MODEL_PROVIDER=openai MODEL_NAME=gpt-4.1 IMAGE_DATASET=nutrition5k_sample.json \
//     EVAL_NAME="Image gpt-4.1" npx braintrust eval food_image_multi.eval.ts

import "dotenv/config";
import fs from "fs";
import path from "path";
import { Eval, currentSpan } from "braintrust";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const PROVIDER = (process.env.MODEL_PROVIDER ?? "google").toLowerCase();
const MODEL_NAME = process.env.MODEL_NAME ?? "gemini-3-flash-preview";
const TEMPERATURE = Number(process.env.TEMPERATURE ?? "0.1");
const MAX_TOKENS = Number(process.env.MAX_TOKENS ?? "4096");

// Pricing per 1M tokens (April 2026). Image tokens billed same as text input
// by all major providers (Gemini, OpenAI, Anthropic).
const PRICING: Record<string, { in: number; out: number }> = {
  "gemini-3-flash-preview":    { in: 0.30, out: 2.50 },
  "gemini-3-pro-preview":      { in: 1.25, out: 10.0 },
  "gemini-2.5-flash":          { in: 0.15, out: 0.60 },
  "gemini-2.5-flash-lite":     { in: 0.075, out: 0.30 },
  "gpt-4.1":                   { in: 2.00, out: 8.00 },
  "gpt-4.1-mini":              { in: 0.40, out: 1.60 },
  "claude-haiku-4-5-20251001": { in: 0.80, out: 4.00 },
  "claude-sonnet-4-5-20250929":{ in: 3.00, out: 15.0 },
};
function priceFor(m: string) { return PRICING[m] ?? { in: 0, out: 0 }; }

const IMAGE_PROMPT = `You are a certified nutritionist analyzing a food photograph.

CONTEXT:
- Region: United States

VISUAL ANALYSIS STEPS:
1. SCAN: List every distinct food item visible (main dish, sides, sauces, beverages, garnishes).
2. SCALE: Estimate portion sizes using visual references:
   - Standard dinner plate ~26cm diameter
   - Palm-sized portion of meat ~100-120g
   - Fist-sized portion of rice/pasta ~150g cooked
   - Fork length ~19cm, tablespoon bowl ~15ml
3. HIDDEN COMPONENTS: Consider what is NOT visible — sauces under food, oil used in cooking, butter on bread, cheese inside a sandwich, dressing on salad. Add these to the estimate.
4. DEPTH: Foods piled high contain more than a flat spread. Estimate depth and adjust weight.
5. CAMERA ANGLE: If the photo is taken at an angle (not from above), items closer to the camera appear larger. Compensate mentally.

ESTIMATION PROCESS (mandatory steps):
1. IDENTIFY: Food item(s), preparation method.
2. WEIGH: Estimate serving weight in grams. State reasoning briefly.
3. LOOKUP: Recall per-100g macros from USDA reference data.
4. CALCULATE: Multiply per-100g values by (serving_weight / 100).
5. VERIFY: protein(g)*4 + carbs(g)*4 + fat(g)*9 must be within 10% of kcal.
6. CONFIDENCE: HIGH (well-known food, clear portion), MEDIUM (some ambiguity), LOW (complex/unclear).

Return ONLY a JSON object with keys: name, kcal, carbsG, proteinG, fatG, servingSize, confidence ("HIGH"|"MEDIUM"|"LOW"), reasoning.
Use 0 for fields you cannot estimate.`;

type Nutrition5kCase = {
  dish_id: string; image_path: string;
  kcal: number; mass_g: number;
  fat_g: number; carbs_g: number; protein_g: number;
  ingredients: string[];
};
type RawNutrition = {
  name: string; kcal: number; carbsG: number; proteinG: number; fatG: number;
  servingSize?: string; confidence: "HIGH" | "MEDIUM" | "LOW"; reasoning?: string;
};
type CallResult = { raw: RawNutrition; inputTokens: number; outputTokens: number };

const DATASET_FILE = process.env.IMAGE_DATASET ?? "nutrition5k_sample.json";
const SAMPLE: Nutrition5kCase[] = JSON.parse(fs.readFileSync(DATASET_FILE, "utf8"));
console.log(`[${PROVIDER}/${MODEL_NAME}] Loaded ${SAMPLE.length} image cases from ${DATASET_FILE}`);

// Lazy clients
let googleClient: GoogleGenAI | null = null;
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
function getGoogle()    { return googleClient    ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }); }
function getOpenAI()    { return openaiClient    ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }); }
function getAnthropic() { return anthropicClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }); }

function extractJson(txt: string): string {
  if (!txt) return "{}";
  let t = txt.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.substring(first, last + 1);
  return t;
}

function loadImage(imagePath: string): { base64: string; mimeType: string } {
  const bytes = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType =
    ext === ".png" ? "image/png" :
    ext === ".webp" ? "image/webp" :
    "image/jpeg";
  return { base64: bytes.toString("base64"), mimeType };
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
  required: ["name", "kcal", "carbsG", "proteinG", "fatG", "confidence"],
};

async function callGoogle(img: { base64: string; mimeType: string }): Promise<CallResult> {
  const res = await getGoogle().models.generateContent({
    model: MODEL_NAME,
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: img.mimeType, data: img.base64 } },
        { text: IMAGE_PROMPT },
      ],
    }],
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

async function callOpenAI(img: { base64: string; mimeType: string }): Promise<CallResult> {
  const res = await getOpenAI().chat.completions.create({
    model: MODEL_NAME,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Respond with a single valid JSON object only. No prose, no markdown fences." },
      {
        role: "user",
        content: [
          { type: "text", text: IMAGE_PROMPT },
          { type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64}` } },
        ] as any,
      },
    ],
  });
  const msg: any = res.choices[0]?.message ?? {};
  const txt = (msg.content && msg.content.trim()) ? msg.content : (msg.reasoning ?? "{}");
  const usage = res.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
  return {
    raw: JSON.parse(extractJson(txt)),
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
  };
}

async function callAnthropic(img: { base64: string; mimeType: string }): Promise<CallResult> {
  const res = await getAnthropic().messages.create({
    model: MODEL_NAME,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: "Respond with a single valid JSON object only. No prose outside the JSON.",
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: img.mimeType as any, data: img.base64 },
        },
        { type: "text", text: IMAGE_PROMPT },
      ],
    }],
  });
  const block = res.content.find((c) => c.type === "text") as { type: "text"; text: string } | undefined;
  return {
    raw: JSON.parse(extractJson(block?.text ?? "{}")),
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
  };
}

async function dispatch(img: { base64: string; mimeType: string }): Promise<CallResult> {
  switch (PROVIDER) {
    case "google":    return callGoogle(img);
    case "openai":    return callOpenAI(img);
    case "anthropic": return callAnthropic(img);
    default: throw new Error(`Unknown MODEL_PROVIDER: ${PROVIDER}`);
  }
}

// Aggregation
const agg = {
  n: 0, errors: 0,
  maeKcal: 0, maeCarbs: 0, maeProtein: 0, maeFat: 0, accKcal20: 0,
  inputTokens: 0, outputTokens: 0, totalCost: 0,
};
process.on("exit", () => {
  try {
    const f = "image_sweep_results.csv";
    const header = "provider,model,n,errors,kcal_acc20,mae_kcal,mae_carbs,mae_protein,mae_fat,avg_in,avg_out,cost_per_call,cost_per_1k\n";
    if (!fs.existsSync(f)) fs.writeFileSync(f, header);
    const n = agg.n || 1;
    const row = [
      PROVIDER, MODEL_NAME, agg.n, agg.errors,
      ((agg.accKcal20 / n) * 100).toFixed(2),
      (agg.maeKcal / n).toFixed(2),
      (agg.maeCarbs / n).toFixed(2),
      (agg.maeProtein / n).toFixed(2),
      (agg.maeFat / n).toFixed(2),
      (agg.inputTokens / n).toFixed(0),
      (agg.outputTokens / n).toFixed(0),
      (agg.totalCost / n).toFixed(6),
      ((agg.totalCost / n) * 1000).toFixed(3),
    ].join(",");
    fs.appendFileSync(f, row + "\n");
  } catch {}

  if (agg.n === 0) return;
  const f = (x: number) => x.toFixed(2);
  const n = agg.n;
  console.log(`\n=== ${PROVIDER}/${MODEL_NAME} — IMAGE METRICS ===`);
  console.log(`n = ${n} dishes  (errors: ${agg.errors})`);
  console.log(`MAE kcal:     ${f(agg.maeKcal / n)}`);
  console.log(`MAE carbs:    ${f(agg.maeCarbs / n)} g`);
  console.log(`MAE protein:  ${f(agg.maeProtein / n)} g`);
  console.log(`MAE fat:      ${f(agg.maeFat / n)} g`);
  console.log(`kcal Acc@±20%: ${f((agg.accKcal20 / n) * 100)}%`);
  console.log(`Avg tokens:   ${(agg.inputTokens / n).toFixed(0)} in / ${(agg.outputTokens / n).toFixed(0)} out`);
  console.log(`Avg cost:     $${(agg.totalCost / n).toFixed(6)} / call  (per 1k: $${((agg.totalCost / n) * 1000).toFixed(3)})`);
  console.log("==========================================");
});

async function task(input: Nutrition5kCase): Promise<RawNutrition> {
  let result: CallResult;
  try {
    const img = loadImage(input.image_path);
    result = await dispatch(img);
  } catch (e) {
    agg.errors++;
    console.error(`[${MODEL_NAME}] error:`, (e as Error).message?.substring(0, 200));
    return { name: "ERROR", kcal: 0, carbsG: 0, proteinG: 0, fatG: 0, confidence: "LOW" };
  }
  const raw = result.raw;
  const num = (v: any): number => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") { const m = v.match(/-?\d+(\.\d+)?/); if (m) return parseFloat(m[0]); }
    return 0;
  };
  raw.kcal = num(raw.kcal);
  raw.carbsG = num(raw.carbsG);
  raw.proteinG = num(raw.proteinG);
  raw.fatG = num(raw.fatG);

  const p = priceFor(MODEL_NAME);
  const cost = (result.inputTokens / 1e6) * p.in + (result.outputTokens / 1e6) * p.out;
  agg.inputTokens += result.inputTokens;
  agg.outputTokens += result.outputTokens;
  agg.totalCost += cost;

  const errKcal = Math.abs(raw.kcal - input.kcal);
  const errCarbs = Math.abs(raw.carbsG - input.carbs_g);
  const errProtein = Math.abs(raw.proteinG - input.protein_g);
  const errFat = Math.abs(raw.fatG - input.fat_g);
  agg.n++;
  agg.maeKcal += errKcal;
  agg.maeCarbs += errCarbs;
  agg.maeProtein += errProtein;
  agg.maeFat += errFat;
  if (errKcal / Math.max(input.kcal, 50) <= 0.2) agg.accKcal20++;

  try {
    currentSpan().log({
      metrics: {
        mae_kcal: errKcal, mae_carbs_g: errCarbs,
        mae_protein_g: errProtein, mae_fat_g: errFat,
        in_tokens: result.inputTokens, out_tokens: result.outputTokens, cost_usd: cost,
      },
      metadata: { provider: PROVIDER, model: MODEL_NAME },
    });
  } catch {}

  return raw;
}

// Scorers
const KcalAcc20 = ({ output, expected }: { output: RawNutrition; expected: Nutrition5kCase }) => ({
  name: "kcal_acc_20pct",
  score: Math.abs(output.kcal - expected.kcal) / Math.max(expected.kcal, 50) <= 0.2 ? 1 : 0,
});
const KcalMaeNorm = ({ output, expected }: { output: RawNutrition; expected: Nutrition5kCase }) => ({
  name: "kcal_mae_norm",
  score: Math.max(0, 1 - Math.abs(output.kcal - expected.kcal) / 300),
});
const MacroAggregate = ({ output, expected }: { output: RawNutrition; expected: Nutrition5kCase }) => {
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
      s(output.kcal, expected.kcal) * weights.kcal +
      s(output.proteinG, expected.protein_g) * weights.protein +
      s(output.carbsG, expected.carbs_g) * weights.carbs +
      s(output.fatG, expected.fat_g) * weights.fat,
  };
};

Eval("flexen-food-image-multi", {
  experimentName: process.env.EVAL_NAME ?? `Image — ${PROVIDER}/${MODEL_NAME}`,
  data: () =>
    SAMPLE.map((c) => ({
      input: c,
      expected: c,
      metadata: { dish_id: c.dish_id, ingredients: c.ingredients.join(", "), provider: PROVIDER, model: MODEL_NAME },
    })),
  task,
  scores: [MacroAggregate, KcalAcc20, KcalMaeNorm],
  trialCount: 1,
  maxConcurrency: Number(process.env.MAX_CONCURRENCY ?? "3"),
});
