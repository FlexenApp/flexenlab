// Runs our current best system (Gemini 3 Flash + no RAG by default) against
// the NutriBench v2 USA sample. Reports both our metrics AND the published
// NutriBench metrics (Accuracy@7.5g for carbs, MAE) so we can compare to the
// Llama 3.1 8B baseline (33-35% acc@7.5, 36 MAE) from the paper.
//
// Run:  GEMINI_MODEL=gemini-3-flash-preview EVAL_NAME="NutriBench v2 USA" DISABLE_RAG=1 npx braintrust eval nutribench.eval.ts

import "dotenv/config";
import fs from "fs";
import { Eval, currentSpan } from "braintrust";
import { GoogleGenAI, Type } from "@google/genai";

const MODEL_NAME = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
const TEMPERATURE = 0.1;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

type NutriBenchCase = {
  meal_description: string;
  carb: number;
  fat: number;
  energy: number;
  protein: number;
  country: string;
  serving_type: string;
};

const SAMPLE_FILE = process.env.NUTRIBENCH_FILE ?? "nutribench_sample.json";
const SAMPLE: NutriBenchCase[] = JSON.parse(fs.readFileSync(SAMPLE_FILE, "utf8"));
console.log(`Loaded ${SAMPLE.length} cases from ${SAMPLE_FILE}`);

// Use the EXACT same prompt as our flexen production code (mirrored from
// food_recognition_service.dart). Gemini 3 Flash + this prompt = our system.
const COT_INSTRUCTIONS = `ESTIMATION PROCESS (mandatory steps):
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

Return ONLY the JSON object.`;

const responseSchema = {
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

type RawNutrition = {
  name: string; kcal: number; carbsG: number; proteinG: number; fatG: number;
  servingSize: string; confidence: "HIGH" | "MEDIUM" | "LOW"; reasoning?: string;
};

// Aggregator for the published paper metrics — printed at exit.
const agg = { n: 0, maeKcal: 0, maeCarbs: 0, maeProtein: 0, maeFat: 0, accCarbs: 0, accKcal20: 0 };
process.on("exit", () => {
  if (agg.n === 0) return;
  const f = (x: number) => x.toFixed(2);
  console.log("\n=== NutriBench RAW METRICS (paper-comparable) ===");
  console.log(`n = ${agg.n} cases (USA subset)`);
  console.log(`Accuracy@7.5g (carbs): ${f((agg.accCarbs / agg.n) * 100)}%`);
  console.log(`MAE carbs:    ${f(agg.maeCarbs / agg.n)} g`);
  console.log(`MAE protein:  ${f(agg.maeProtein / agg.n)} g`);
  console.log(`MAE fat:      ${f(agg.maeFat / agg.n)} g`);
  console.log(`MAE kcal:     ${f(agg.maeKcal / agg.n)} kcal`);
  console.log(`kcal Acc@±20%: ${f((agg.accKcal20 / agg.n) * 100)}%`);
  console.log("\nLlama 3.1 8B baseline (paper):");
  console.log("  Accuracy@7.5g (CoT): 35.27%");
  console.log("  MAE carbs:           37.17 g");
  console.log("=================================================");
});

// E6: ISO country code → human-readable name for region-aware prompting.
// Only the countries actually present in NutriBench v2.
const COUNTRY_NAMES: Record<string, string> = {
  USA: "the United States", ARG: "Argentina", BRA: "Brazil", MEX: "Mexico",
  CRI: "Costa Rica", GTM: "Guatemala", PER: "Peru", ITA: "Italy",
  BGR: "Bulgaria", ROU: "Romania", BFA: "Burkina Faso", COD: "DR Congo",
  ETH: "Ethiopia", KEN: "Kenya", STP: "São Tomé and Príncipe", TUN: "Tunisia",
  ZMB: "Zambia", IND: "India", LKA: "Sri Lanka", PAK: "Pakistan",
  PHL: "the Philippines", MYS: "Malaysia", LAO: "Laos", KNA: "Saint Kitts and Nevis",
};
function countryName(iso: string): string {
  return COUNTRY_NAMES[iso] ?? iso;
}

async function task(input: NutriBenchCase): Promise<RawNutrition> {
  // E6: Regional prompt routing — use the country ISO code from the dataset
  // to inject a region hint. USE_REGION_HINT=1 enables; default off uses the
  // previous hard-coded "United States" context for clean A/B.
  const USE_REGION_HINT = process.env.USE_REGION_HINT === "1";
  const regionLine = USE_REGION_HINT
    ? `- Region: ${countryName(input.country)} (use typical portion sizes, cuisine conventions, and ingredient preparations common in ${countryName(input.country)})`
    : `- Region: United States`;

  const prompt = `You are a certified nutritionist. Estimate the nutritional content of the described food.

CONTEXT:
${regionLine}

${COT_INSTRUCTIONS}

Food to estimate: <user_input>${input.meal_description}</user_input>`;

  const res = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      temperature: TEMPERATURE,
      responseMimeType: "application/json",
      responseSchema,
    },
  });
  const raw = JSON.parse(res.text ?? "{}") as RawNutrition;

  // Accumulate paper-comparable metrics
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

  // Per-row raw MAE values as metadata (not scores → no quota)
  try {
    currentSpan().log({
      metrics: {
        mae_kcal_g: errKcal,
        mae_carbs_g: errCarb,
        mae_protein_g: errProtein,
        mae_fat_g: errFat,
      },
    });
  } catch {}

  return raw;
}

// ── Scoring ──

// Published NutriBench metric: Accuracy@7.5g — fraction of cases where the
// model's CARB estimate is within 7.5g of ground truth. (From the paper.)
const Acc7p5Carbs = ({ output, expected }: { output: RawNutrition; expected: NutriBenchCase }) => ({
  name: "nutribench_acc_at_7.5_carbs",
  score: Math.abs(output.carbsG - expected.carb) <= 7.5 ? 1 : 0,
});

// MAE per macro — Braintrust requires 0-1, so we normalize by a reasonable
// cap (kcal: 500, macros: 50g) and INVERT (1 = perfect, 0 = capped error or
// worse). Raw MAE in grams/kcal exposed in metadata for paper comparison.
const maeScore = (mae: number, cap: number) => Math.max(0, 1 - mae / cap);

const MaeCarbsNorm = ({ output, expected }: { output: RawNutrition; expected: NutriBenchCase }) => {
  const mae = Math.abs(output.carbsG - expected.carb);
  return { name: "mae_carbs_norm", score: maeScore(mae, 50), metadata: { raw_mae_g: mae } };
};
const MaeProteinNorm = ({ output, expected }: { output: RawNutrition; expected: NutriBenchCase }) => {
  const mae = Math.abs(output.proteinG - expected.protein);
  return { name: "mae_protein_norm", score: maeScore(mae, 50), metadata: { raw_mae_g: mae } };
};
const MaeFatNorm = ({ output, expected }: { output: RawNutrition; expected: NutriBenchCase }) => {
  const mae = Math.abs(output.fatG - expected.fat);
  return { name: "mae_fat_norm", score: maeScore(mae, 50), metadata: { raw_mae_g: mae } };
};
const MaeKcalNorm = ({ output, expected }: { output: RawNutrition; expected: NutriBenchCase }) => {
  const mae = Math.abs(output.kcal - expected.energy);
  return { name: "mae_kcal_norm", score: maeScore(mae, 500), metadata: { raw_mae_kcal: mae } };
};

// Our familiar weighted aggregate (cal 40 / p 25 / c 20 / f 15) using a
// uniform 25% tolerance — comparable across runs.
const MacroAggregate = ({ output, expected }: { output: RawNutrition; expected: NutriBenchCase }) => {
  const weights = { kcal: 0.4, protein: 0.25, carbs: 0.2, fat: 0.15 };
  const tol = 0.25;
  const score = (act: number, exp: number) => {
    const denom = Math.max(Math.abs(exp), 5);
    const pctErr = Math.abs(act - exp) / denom;
    if (pctErr <= tol) return 1;
    if (pctErr >= 2 * tol) return 0;
    return 1 - (pctErr - tol) / tol;
  };
  return {
    name: "macro_aggregate",
    score:
      score(output.kcal, expected.energy) * weights.kcal +
      score(output.proteinG, expected.protein) * weights.protein +
      score(output.carbsG, expected.carb) * weights.carbs +
      score(output.fatG, expected.fat) * weights.fat,
  };
};

// kcal accuracy at ±20% — practical user-facing metric (matches Cal AI's claim)
const KcalAcc20Pct = ({ output, expected }: { output: RawNutrition; expected: NutriBenchCase }) => ({
  name: "kcal_acc_within_20_pct",
  score: Math.abs(output.kcal - expected.energy) / Math.max(expected.energy, 50) <= 0.2 ? 1 : 0,
});

Eval("flexen-food-text", {
  experimentName: process.env.EVAL_NAME ?? `NutriBench v2 USA — ${MODEL_NAME}`,
  data: () =>
    SAMPLE.map((c, i) => ({
      input: c,
      expected: c,
      metadata: { country: c.country, serving_type: c.serving_type, idx: i },
    })),
  task,
  // Only 3 scores — MAE values are logged as metadata in task() instead.
  scores: [
    MacroAggregate,    // our weighted aggregate (cross-eval comparable)
    Acc7p5Carbs,       // NutriBench paper headline metric
    KcalAcc20Pct,      // Cal-AI-comparable practical metric
  ],
  trialCount: 1,
  maxConcurrency: 4,
});
