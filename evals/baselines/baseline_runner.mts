// Unified baseline runner for Flexen food-AI.
// Tests any (model, variant, dataset) combination against Gemini 3 Flash
// Preview and GPT-OSS 120B (via Ollama Cloud) so we have a full reference
// matrix to compare against the fine-tuned model later.
//
// Usage (single run):
//   MODEL=gemini VARIANT=baseline DATASET=nutribench_100 \
//     npx tsx baselines/baseline_runner.mts
//
// Usage (via orchestrator): see run_all_baselines.sh

import fs from "fs";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

// Load API keys
for (const line of fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2];
}

const MODEL = (process.env.MODEL ?? "gemini").toLowerCase();
const VARIANT = (process.env.VARIANT ?? "baseline").toLowerCase();
const DATASET = (process.env.DATASET ?? "nutribench_100").toLowerCase();
const OUT_DIR = "baselines/results";
fs.mkdirSync(OUT_DIR, { recursive: true });

const google = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const ollama = new OpenAI({
  apiKey: process.env.OLLAMA_API_KEY!,
  baseURL: "https://ollama.com/v1",
  timeout: 300_000,
});

// ─────────────────────────────────────────────────────────────
// Prompt variants — variant builders return (systemMsg, userPrompt)
// ─────────────────────────────────────────────────────────────

const COT_SHORT = `ESTIMATION PROCESS (mandatory steps):
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

const COT_STRICT_CONFIDENCE = COT_SHORT.replace(
  "6. CONFIDENCE: HIGH (well-known food, clear portion), MEDIUM (some ambiguity), LOW (complex/unclear).",
  `6. CONFIDENCE RULES (strict):
   - HIGH: ONLY if (a) you can cite a specific USDA/brand reference AND (b) the query specifies explicit portion/weight. Otherwise MEDIUM.
   - MEDIUM: partial information, common food but ambiguous portion, or missing brand confirmation.
   - LOW: obscure/regional food, multi-component without clear weights, unfamiliar preparation. If uncertain between HIGH/MEDIUM → default MEDIUM.`
);

const COT_WITH_NEGATIVE_EXAMPLES = COT_SHORT + `\n\nNEGATIVE EXAMPLES (common failure modes to avoid):
- "1 apple" → NOT 50 kcal (too low, that's 100g not full apple). A medium apple is ~95 kcal.
- "grilled chicken salad" → NOT just salad kcal, MUST include chicken (~150-200g cooked).
- "fried rice" → NOT plain rice kcal, MUST add oil (+80-120 kcal per cup).
- "smoothie" → NOT 50 kcal, MUST account for fruit + milk/yogurt base (typically 200-350 kcal).`;

const COT_FEW_SHOT = COT_SHORT + `\n\nCALIBRATION EXAMPLES (anchor your estimates to these):
- 1 large banana (~120g): 105 kcal, 27g carbs, 1g protein, 0g fat
- 1 medium apple (~180g): 95 kcal, 25g carbs, 0.5g protein, 0.3g fat
- Big Mac meal (burger only): 563 kcal, 45g carbs, 26g protein, 33g fat
- 100g cooked white rice: 130 kcal, 28g carbs, 2.7g protein, 0.3g fat
- 100g grilled salmon: 208 kcal, 0g carbs, 22g protein, 13g fat`;

const COUNTRY_NAMES: Record<string, string> = {
  USA: "the United States", ARG: "Argentina", BRA: "Brazil", MEX: "Mexico",
  CRI: "Costa Rica", GTM: "Guatemala", PER: "Peru", ITA: "Italy",
  BGR: "Bulgaria", ROU: "Romania", BFA: "Burkina Faso", COD: "DR Congo",
  ETH: "Ethiopia", KEN: "Kenya", STP: "São Tomé and Príncipe", TUN: "Tunisia",
  ZMB: "Zambia", IND: "India", LKA: "Sri Lanka", PAK: "Pakistan",
  PHL: "the Philippines", MYS: "Malaysia", LAO: "Laos", KNA: "Saint Kitts and Nevis",
};

// A prompt-variant spec, given the "user_input" text and optional metadata
type PromptSpec = { system: string; user: string };
type PromptBuilder = (query: string, meta?: { country?: string }) => PromptSpec;

const VARIANTS: Record<string, PromptBuilder> = {
  baseline: (q, m) => ({
    system: "You are a certified nutritionist. Respond with a single valid JSON object only. No prose outside the JSON.",
    user: `You are a certified nutritionist. Estimate the nutritional content of the described food.

CONTEXT:
- Region: United States

${COT_SHORT}

Food to estimate: <user_input>${q}</user_input>`,
  }),

  region_hint: (q, m) => {
    const regionName = COUNTRY_NAMES[m?.country ?? "USA"] ?? "the United States";
    return {
      system: "You are a certified nutritionist. Respond with a single valid JSON object only. No prose outside the JSON.",
      user: `You are a certified nutritionist. Estimate the nutritional content of the described food.

CONTEXT:
- Region: ${regionName} (use typical portion sizes, cuisine conventions, and ingredient preparations common in ${regionName})

${COT_SHORT}

Food to estimate: <user_input>${q}</user_input>`,
    };
  },

  strict_confidence: (q) => ({
    system: "You are a certified nutritionist. Respond with a single valid JSON object only. No prose outside the JSON.",
    user: `You are a certified nutritionist. Estimate the nutritional content of the described food.

CONTEXT:
- Region: United States

${COT_STRICT_CONFIDENCE}

Food to estimate: <user_input>${q}</user_input>`,
  }),

  few_shot: (q) => ({
    system: "You are a certified nutritionist. Respond with a single valid JSON object only. No prose outside the JSON.",
    user: `You are a certified nutritionist. Estimate the nutritional content of the described food.

CONTEXT:
- Region: United States

${COT_FEW_SHOT}

Food to estimate: <user_input>${q}</user_input>`,
  }),

  negative_examples: (q) => ({
    system: "You are a certified nutritionist. Respond with a single valid JSON object only. No prose outside the JSON.",
    user: `You are a certified nutritionist. Estimate the nutritional content of the described food.

CONTEXT:
- Region: United States

${COT_WITH_NEGATIVE_EXAMPLES}

Food to estimate: <user_input>${q}</user_input>`,
  }),

  lean_schema: (q) => ({
    system: "You are a certified nutritionist. Respond with a JSON object containing ONLY: name, kcal, carbsG, proteinG, fatG, confidence. Do NOT include reasoning, servingSize, or any other fields.",
    user: `Estimate nutrition for: ${q}

Region: United States.

Rules:
- Identify food, estimate weight, calculate macros from USDA per-100g values.
- Atwater check: protein*4 + carbs*4 + fat*9 ≈ kcal.
- Confidence: HIGH/MEDIUM/LOW based on your certainty.

Return ONLY: {"name", "kcal", "carbsG", "proteinG", "fatG", "confidence"}`,
  }),

  minimal_schema: (q) => ({
    system: "Return only 5 numbers: name, kcal, carbsG, proteinG, fatG. No other fields.",
    user: `Estimate: ${q}. US portions.

Return: {"name", "kcal", "carbsG", "proteinG", "fatG"}`,
  }),

  structured_reasoning: (q) => ({
    system: "You are a certified nutritionist. Respond with a JSON object showing your work: identified_food, estimated_weight_g, per_100g_kcal, per_100g_carbs, per_100g_protein, per_100g_fat, then final totals: name, kcal, carbsG, proteinG, fatG, servingSize, confidence, reasoning.",
    user: `Estimate nutrition for: ${q}

CONTEXT:
- Region: United States

${COT_SHORT}

Include intermediate calculation fields (identified_food, estimated_weight_g, per_100g_*) BEFORE the final totals.

Return JSON.`,
  }),

  two_stage_identify: (q) => ({
    // Stage 1 only: identify the food and portion. A separate stage 2 does the calc.
    // This variant is called twice by the runner.
    system: "You are a certified nutritionist. Identify the food and estimate portion weight. Return JSON.",
    user: `Identify this food: ${q}

Return ONLY: {"identified_food": "...", "weight_g": <number>, "region": "United States"}`,
  }),
};

// Variants that need special multi-call handling beyond a single prompt
const SPECIAL_VARIANTS = new Set([
  "self_consistency",
  "atwater_retry",
  "critic_loop",
  "two_stage",
]);

// ─────────────────────────────────────────────────────────────
// Model callers
// ─────────────────────────────────────────────────────────────

function extractJson(txt: string): any {
  if (!txt) return null;
  let t = String(txt).replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const f = t.indexOf("{"), l = t.lastIndexOf("}");
  if (f >= 0 && l > f) t = t.substring(f, l + 1);
  try { return JSON.parse(t); } catch { return null; }
}

async function callGemini(spec: PromptSpec): Promise<any> {
  const res = await google.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${spec.system}\n\n${spec.user}`,
    config: { temperature: 0.1, responseMimeType: "application/json", maxOutputTokens: 4096 } as any,
  });
  return extractJson(res.text ?? "{}");
}

async function callOllama(spec: PromptSpec): Promise<any> {
  const res = await ollama.chat.completions.create({
    model: "gpt-oss:120b",
    temperature: 0.1,
    max_tokens: 4096,
    messages: [
      { role: "system", content: spec.system },
      { role: "user", content: spec.user },
    ],
  });
  const msg: any = res.choices[0]?.message ?? {};
  const txt = (msg.content && msg.content.trim()) ? msg.content : (msg.reasoning ?? "{}");
  return extractJson(txt);
}

async function callModel(spec: PromptSpec): Promise<any> {
  return MODEL === "gemini" ? callGemini(spec) : callOllama(spec);
}

// ─────────────────────────────────────────────────────────────
// Special variants (multi-call logic)
// ─────────────────────────────────────────────────────────────

async function selfConsistency(query: string, meta: any, n = 3): Promise<any> {
  // Run baseline N times, take median of numeric fields
  const runs: any[] = [];
  for (let i = 0; i < n; i++) {
    const r = await callModel(VARIANTS.baseline(query, meta));
    if (r) runs.push(r);
  }
  if (runs.length === 0) return null;
  const median = (arr: number[]) => {
    const s = arr.slice().sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  return {
    name: runs[0].name,
    kcal: median(runs.map(r => Number(r.kcal) || 0)),
    carbsG: median(runs.map(r => Number(r.carbsG) || 0)),
    proteinG: median(runs.map(r => Number(r.proteinG) || 0)),
    fatG: median(runs.map(r => Number(r.fatG) || 0)),
    servingSize: runs[0].servingSize,
    confidence: runs[0].confidence,
    reasoning: `self-consistency n=${runs.length}`,
    _runs: runs,
  };
}

async function atwaterRetry(query: string, meta: any): Promise<any> {
  const r1 = await callModel(VARIANTS.baseline(query, meta));
  if (!r1) return null;
  const kcal = Number(r1.kcal) || 0;
  const computed = (Number(r1.proteinG) || 0) * 4 + (Number(r1.carbsG) || 0) * 4 + (Number(r1.fatG) || 0) * 9;
  const drift = Math.abs(computed - kcal) / Math.max(kcal, 1);
  if (drift <= 0.10) return r1; // good enough
  // Retry with feedback
  const retrySpec: PromptSpec = {
    system: "You are a certified nutritionist. Respond with a single valid JSON object only.",
    user: `Estimate nutrition for: ${query}

Previous attempt had Atwater drift: protein*4 + carbs*4 + fat*9 = ${computed.toFixed(0)}, but kcal = ${kcal} (drift ${(drift * 100).toFixed(0)}%).

REDO the estimate. Ensure Atwater consistency: protein*4 + carbs*4 + fat*9 must be within 10% of kcal.

Region: United States.

Return JSON: {"name", "kcal", "carbsG", "proteinG", "fatG", "servingSize", "confidence", "reasoning"}`,
  };
  const r2 = await callModel(retrySpec);
  return r2 || r1;
}

async function criticLoop(query: string, meta: any): Promise<any> {
  const r1 = await callModel(VARIANTS.baseline(query, meta));
  if (!r1) return null;
  const criticSpec: PromptSpec = {
    system: "You are a critical nutritionist reviewer. Find errors in previous estimates and produce a corrected version.",
    user: `Original query: ${query}

Previous estimate:
${JSON.stringify(r1, null, 2)}

REVIEW this estimate critically:
- Are the macros plausible for the described portion?
- Does Atwater check hold (P*4 + C*4 + F*9 ≈ kcal)?
- Is the serving size realistic for US portions?
- Is the confidence calibration correct?

Produce a CORRECTED JSON estimate. If the original is good, return the same values. If wrong, fix them.

Return JSON: {"name", "kcal", "carbsG", "proteinG", "fatG", "servingSize", "confidence", "reasoning"}`,
  };
  const r2 = await callModel(criticSpec);
  return r2 || r1;
}

async function twoStage(query: string, meta: any): Promise<any> {
  // Stage 1: identify
  const stage1 = await callModel(VARIANTS.two_stage_identify(query, meta));
  if (!stage1) return null;
  // Stage 2: compute macros given the identification
  const stage2Spec: PromptSpec = {
    system: "You are a certified nutritionist. Calculate macros given a pre-identified food and weight. Return JSON.",
    user: `Identified food: ${stage1.identified_food}
Weight: ${stage1.weight_g}g
Region: United States.

Calculate the full nutrition based on USDA per-100g values × (weight / 100).
Atwater check: protein*4 + carbs*4 + fat*9 within 10% of kcal.

Return: {"name", "kcal", "carbsG", "proteinG", "fatG", "servingSize", "confidence", "reasoning"}`,
  };
  const r2 = await callModel(stage2Spec);
  return r2;
}

// Dispatch a single case through a variant
async function dispatchVariant(query: string, meta: any): Promise<any> {
  switch (VARIANT) {
    case "self_consistency": return selfConsistency(query, meta);
    case "atwater_retry":    return atwaterRetry(query, meta);
    case "critic_loop":      return criticLoop(query, meta);
    case "two_stage":        return twoStage(query, meta);
    default: {
      const builder = VARIANTS[VARIANT];
      if (!builder) throw new Error(`Unknown variant: ${VARIANT}`);
      return callModel(builder(query, meta));
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Dataset loaders + scorers
// ─────────────────────────────────────────────────────────────

type NutriCase = { meal_description: string; carb: number; fat: number; energy: number; protein: number; country: string };
type FlexenCase = { input: string; targetKcal: number; targetProtein: number; targetCarbs: number; targetFat: number; tolKcal: number; tolProtein: number; tolCarbs: number; tolFat: number; };

async function runNutriBench(file: string) {
  const SAMPLE: NutriCase[] = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`[${MODEL}/${VARIANT}] NutriBench ${SAMPLE.length} cases`);

  let n = 0, errors = 0;
  let maeKcal = 0, maeCarbs = 0, maeProtein = 0, maeFat = 0;
  let accCarbs = 0, accKcal20 = 0;
  const rows: any[] = [];

  for (let i = 0; i < SAMPLE.length; i++) {
    const c = SAMPLE[i];
    if (i % 10 === 0) process.stdout.write(`  ${i}/${SAMPLE.length}\r`);
    let pred: any = null;
    try { pred = await dispatchVariant(c.meal_description, { country: c.country }); }
    catch (e: any) { errors++; continue; }
    if (!pred) { errors++; continue; }
    const num = (v: any) => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") { const m = v.match(/-?\d+(\.\d+)?/); if (m) return parseFloat(m[0]); }
      return 0;
    };
    const pKcal = num(pred.kcal), pCarbs = num(pred.carbsG), pProt = num(pred.proteinG), pFat = num(pred.fatG);
    const eKcal = Math.abs(pKcal - c.energy);
    const eCarbs = Math.abs(pCarbs - c.carb);
    const eProt = Math.abs(pProt - c.protein);
    const eFat = Math.abs(pFat - c.fat);
    n++;
    maeKcal += eKcal; maeCarbs += eCarbs; maeProtein += eProt; maeFat += eFat;
    if (eCarbs <= 7.5) accCarbs++;
    if (eKcal / Math.max(c.energy, 50) <= 0.2) accKcal20++;
    rows.push({ query: c.meal_description, country: c.country, gt_kcal: c.energy, pred_kcal: pKcal, err_kcal: eKcal, acc7_5: eCarbs <= 7.5 });
  }
  console.log();
  const result = {
    model: MODEL, variant: VARIANT, dataset: DATASET, n, errors,
    acc_7_5: n ? accCarbs / n : 0,
    kcal_acc_20: n ? accKcal20 / n : 0,
    mae_kcal: n ? maeKcal / n : 0,
    mae_carbs: n ? maeCarbs / n : 0,
    mae_protein: n ? maeProtein / n : 0,
    mae_fat: n ? maeFat / n : 0,
  };
  console.log(`  → Acc@7.5: ${(result.acc_7_5*100).toFixed(1)}%  kcal Acc20: ${(result.kcal_acc_20*100).toFixed(1)}%  MAE kcal: ${result.mae_kcal.toFixed(1)}  errors: ${errors}`);
  return { ...result, rows };
}

async function runFlexenHardset() {
  const { FOOD_CASES } = await import("../dataset.js");
  console.log(`[${MODEL}/${VARIANT}] Flexen hardset ${FOOD_CASES.length} cases`);
  let all = 0, kcalTol = 0, kcalAcc20 = 0, maeKcal = 0, errors = 0;
  const rows: any[] = [];

  for (let i = 0; i < FOOD_CASES.length; i++) {
    const c = FOOD_CASES[i];
    let pred: any = null;
    try { pred = await dispatchVariant(c.input, {}); }
    catch { errors++; continue; }
    if (!pred) { errors++; continue; }
    const inBand = (a: number, t: number, tol: number) =>
      Number.isFinite(a) && Math.abs(a - t) / Math.max(t, 1) <= tol;
    const num = (v: any) => Number.isFinite(Number(v)) ? Number(v) : 0;
    const k = inBand(num(pred.kcal), c.targetKcal, c.tolKcal);
    const p = inBand(num(pred.proteinG), c.targetProtein, c.tolProtein);
    const cb = inBand(num(pred.carbsG), c.targetCarbs, c.tolCarbs);
    const f = inBand(num(pred.fatG), c.targetFat, c.tolFat);
    const errK = Math.abs(num(pred.kcal) - c.targetKcal);
    if (k) kcalTol++;
    if (k && p && cb && f) all++;
    if (errK / Math.max(c.targetKcal, 50) <= 0.2) kcalAcc20++;
    maeKcal += errK;
    rows.push({ query: c.input, gt_kcal: c.targetKcal, pred_kcal: num(pred.kcal), all, errK });
  }
  const n = FOOD_CASES.length;
  const result = {
    model: MODEL, variant: VARIANT, dataset: "flexen_hardset", n, errors,
    all_4_in_band: all / n,
    kcal_in_tolerance: kcalTol / n,
    kcal_acc_20: kcalAcc20 / n,
    mae_kcal: maeKcal / n,
  };
  console.log(`  → all-4: ${(result.all_4_in_band*100).toFixed(0)}%  kcal-tol: ${(result.kcal_in_tolerance*100).toFixed(0)}%  kcal Acc20: ${(result.kcal_acc_20*100).toFixed(0)}%  MAE: ${result.mae_kcal.toFixed(1)}`);
  return { ...result, rows };
}

async function runE12() {
  const { E12_CASES } = await import("./e12_cases.mjs");
  console.log(`[${MODEL}/${VARIANT}] E12 long multi-meal ${E12_CASES.length} cases`);
  let withinTol = 0, maeKcal = 0, errors = 0;
  const rows: any[] = [];
  for (let i = 0; i < E12_CASES.length; i++) {
    const c: any = E12_CASES[i];
    let pred: any = null;
    try { pred = await dispatchVariant(c.query, {}); } catch { errors++; continue; }
    if (!pred) { errors++; continue; }
    const pKcal = Number(pred.kcal) || 0;
    const err = Math.abs(pKcal - c.targetKcal);
    const pctErr = err / Math.max(c.targetKcal, 1);
    if (pctErr <= 0.20) withinTol++;
    maeKcal += err;
    rows.push({ query: c.query, gt: c.targetKcal, pred: pKcal, err, within_20: pctErr <= 0.20 });
  }
  const n = E12_CASES.length;
  const result = {
    model: MODEL, variant: VARIANT, dataset: "e12_long_queries", n, errors,
    within_20pct: withinTol / n,
    mae_kcal: maeKcal / n,
  };
  console.log(`  → within ±20%: ${withinTol}/${n}  MAE kcal: ${result.mae_kcal.toFixed(1)}`);
  return { ...result, rows };
}

async function runE13() {
  const { E13_ATTACKS } = await import("./e13_cases.mjs");
  console.log(`[${MODEL}/${VARIANT}] E13 prompt injection ${E13_ATTACKS.length} cases`);
  let robust = 0, vulnerable = 0, refused = 0;
  const rows: any[] = [];
  for (let i = 0; i < E13_ATTACKS.length; i++) {
    const attack: any = E13_ATTACKS[i];
    let pred: any = null;
    try { pred = await dispatchVariant(attack.query, {}); } catch {}
    if (!pred) { refused++; continue; }
    const isRobust = new Function("o", `return ${attack.isRobust}`)(pred);
    const isVulnerable = new Function("o", `return ${attack.isVulnerable}`)(pred);
    let verdict = "refused";
    if (isVulnerable) { vulnerable++; verdict = "vulnerable"; }
    else if (isRobust) { robust++; verdict = "robust"; }
    else { refused++; }
    rows.push({ attack: attack.name, verdict, pred });
  }
  const n = E13_ATTACKS.length;
  const result = {
    model: MODEL, variant: VARIANT, dataset: "e13_injection", n,
    robust_rate: robust / n,
    vulnerable_rate: vulnerable / n,
    refused_rate: refused / n,
  };
  console.log(`  → robust: ${robust}/${n}  vulnerable: ${vulnerable}/${n}  refused: ${refused}/${n}`);
  return { ...result, rows };
}

async function runE3Consistency() {
  // 10 base queries × 4 variations. Measures output determinism.
  // A stable model should give same kcal regardless of phrasing variation.
  const BASE = [
    { base: "1 banana", variations: ["1 banana", "a banana", "one banana", "1 Banana"] },
    { base: "2 eggs scrambled", variations: ["2 eggs scrambled", "two scrambled eggs", "Two eggs, scrambled", "2 scrambled eggs"] },
    { base: "cup of coffee with milk", variations: ["cup of coffee with milk", "coffee with milk", "a cup of coffee with milk", "coffee, with milk"] },
    { base: "oat milk latte", variations: ["oat milk latte", "oatmilk latte", "oat-milk latte", "an oat milk latte"] },
    { base: "200g chicken breast grilled", variations: ["200g chicken breast grilled", "200g grilled chicken breast", "200 g chicken breast, grilled", "grilled chicken breast 200g"] },
    { base: "medium apple", variations: ["medium apple", "a medium apple", "one medium apple", "1 medium apple"] },
    { base: "cheese pizza slice", variations: ["cheese pizza slice", "slice of cheese pizza", "one slice of cheese pizza", "a cheese pizza slice"] },
    { base: "cup of white rice", variations: ["cup of white rice", "1 cup white rice", "a cup of cooked white rice", "one cup white rice"] },
    { base: "Big Mac", variations: ["Big Mac", "big mac", "McDonald's Big Mac", "a Big Mac"] },
    { base: "tall latte", variations: ["tall latte", "Tall latte", "Starbucks tall latte", "a tall latte"] },
  ];
  console.log(`[${MODEL}/${VARIANT}] E3 consistency ${BASE.length} × 4 = ${BASE.length * 4} queries`);
  const perBase: any[] = [];
  let totalDriftPct = 0, groupsEvaluated = 0;

  for (const group of BASE) {
    const predKcals: number[] = [];
    for (const v of group.variations) {
      let pred: any = null;
      try { pred = await dispatchVariant(v, {}); } catch {}
      if (pred && Number.isFinite(Number(pred.kcal))) predKcals.push(Number(pred.kcal));
    }
    if (predKcals.length < 2) continue;
    const mean = predKcals.reduce((a, b) => a + b, 0) / predKcals.length;
    const maxDrift = Math.max(...predKcals.map(k => Math.abs(k - mean)));
    const driftPct = maxDrift / Math.max(mean, 1);
    totalDriftPct += driftPct;
    groupsEvaluated++;
    perBase.push({ base: group.base, predKcals, mean: Math.round(mean), maxDrift: Math.round(maxDrift), driftPct: (driftPct * 100).toFixed(1) + "%" });
  }
  const result = {
    model: MODEL, variant: VARIANT, dataset: "e3_consistency",
    n_groups: groupsEvaluated,
    avg_drift_pct: groupsEvaluated ? totalDriftPct / groupsEvaluated : 0,
  };
  console.log(`  → avg cross-variation drift: ${(result.avg_drift_pct * 100).toFixed(2)}% (lower = more deterministic)`);
  return { ...result, per_base: perBase };
}

// ─────────────────────────────────────────────────────────────
// Main dispatch
// ─────────────────────────────────────────────────────────────

const started = Date.now();
let result: any;
switch (DATASET) {
  case "nutribench_50":   result = await runNutriBench("baselines/nutribench_50.json"); break;
  case "nutribench_100":  result = await runNutriBench("baselines/nutribench_100.json"); break;
  case "nutribench_500":  result = await runNutriBench("nutribench_sample_balanced.json"); break;
  case "flexen_hardset":  result = await runFlexenHardset(); break;
  case "e12":             result = await runE12(); break;
  case "e13":             result = await runE13(); break;
  case "e3":              result = await runE3Consistency(); break;
  default: throw new Error(`Unknown dataset: ${DATASET}`);
}
result.elapsed_sec = Math.round((Date.now() - started) / 1000);

const outFile = `${OUT_DIR}/${MODEL}_${VARIANT}_${DATASET}.json`;
fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
console.log(`→ ${outFile}  (${result.elapsed_sec}s)`);
