// Image-path eval mirroring FoodRecognitionService.analyzeImage from
// lib/services/food_recognition_service.dart. Uses Nutrition5k overhead RGB
// images as input and the dataset's gram-accurate macro labels as ground
// truth (peer-reviewed CVPR 2021 dataset, ~5006 dishes).
//
// Run: GEMINI_MODEL=gemini-3-flash-preview EVAL_NAME="Image — 3-flash" npx braintrust eval food_image.eval.ts

import "dotenv/config";
import fs from "fs";
import { Eval, currentSpan } from "braintrust";
import { GoogleGenAI, Type } from "@google/genai";

const MODEL_NAME = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
const TEMPERATURE = 0.1;

// Pricing — Gemini 3 Flash Preview: $0.50/1M input, $3.00/1M output. Image
// tokens are billed at the same rate as text input tokens (Gemini handles
// this internally — usageMetadata.promptTokenCount already includes image).
const GEMINI_INPUT_COST_PER_TOKEN = 0.50 / 1_000_000;
const GEMINI_OUTPUT_COST_PER_TOKEN = 3.00 / 1_000_000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

type Nutrition5kCase = {
  dish_id: string;
  image_path: string;
  kcal: number;
  mass_g: number;
  fat_g: number;
  carbs_g: number;
  protein_g: number;
  ingredients: string[];
};

const SAMPLE: Nutrition5kCase[] = JSON.parse(
  fs.readFileSync(process.env.IMAGE_DATASET ?? "nutrition5k_sample.json", "utf8"),
);
console.log(`Loaded ${SAMPLE.length} image cases`);

// 1:1 mirror of analyzeImage prompt body, with US region
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

Return ONLY the JSON object. Use 0 for fields you cannot estimate.`;

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
  required: ["name", "kcal", "carbsG", "proteinG", "fatG", "confidence"],
};

type RawNutrition = {
  name: string; kcal: number; carbsG: number; proteinG: number; fatG: number;
  servingSize?: string; confidence: "HIGH" | "MEDIUM" | "LOW"; reasoning?: string;
};

// Cost accumulator for end-of-run summary
const costAcc = { cases: 0, inTokens: 0, outTokens: 0, costUsd: 0 };
const accAcc = { kcal: 0, carbs: 0, protein: 0, fat: 0, kcalAcc20: 0 };
process.on("exit", () => {
  if (costAcc.cases === 0) return;
  const f = (x: number) => x.toFixed(2);
  console.log("\n=== IMAGE EVAL — Nutrition5k ===");
  console.log(`n = ${costAcc.cases} dishes`);
  console.log(`MAE kcal:    ${f(accAcc.kcal / costAcc.cases)} kcal`);
  console.log(`MAE carbs:   ${f(accAcc.carbs / costAcc.cases)} g`);
  console.log(`MAE protein: ${f(accAcc.protein / costAcc.cases)} g`);
  console.log(`MAE fat:     ${f(accAcc.fat / costAcc.cases)} g`);
  console.log(`kcal Acc@±20%: ${f((accAcc.kcalAcc20 / costAcc.cases) * 100)}%`);
  console.log("\n--- COST ---");
  console.log(`Avg tokens: ${(costAcc.inTokens / costAcc.cases).toFixed(0)} in / ${(costAcc.outTokens / costAcc.cases).toFixed(0)} out`);
  console.log(`Avg cost / call: $${(costAcc.costUsd / costAcc.cases).toFixed(5)}`);
  console.log(`Cost / 1k calls: $${((costAcc.costUsd / costAcc.cases) * 1000).toFixed(2)}`);
  console.log("\n--- Reference (Nutrition5k paper, CVPR 2021) ---");
  console.log("Best published image-only model MAE: kcal ~70, carb ~12g, fat ~6g, protein ~8g");
  console.log("================================\n");
});

async function task(input: Nutrition5kCase): Promise<RawNutrition> {
  const imageBytes = fs.readFileSync(input.image_path);
  const base64 = imageBytes.toString("base64");

  const res = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: base64 } },
          { text: IMAGE_PROMPT },
        ],
      },
    ],
    config: {
      temperature: TEMPERATURE,
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const text = res.text ?? "{}";
  const raw = JSON.parse(text) as RawNutrition;

  // Cost tracking
  const inTokens = res.usageMetadata?.promptTokenCount ?? 0;
  const outTokens = res.usageMetadata?.candidatesTokenCount ?? 0;
  const cost = inTokens * GEMINI_INPUT_COST_PER_TOKEN + outTokens * GEMINI_OUTPUT_COST_PER_TOKEN;
  costAcc.cases++;
  costAcc.inTokens += inTokens;
  costAcc.outTokens += outTokens;
  costAcc.costUsd += cost;

  // MAE accumulators
  const errKcal = Math.abs(raw.kcal - input.kcal);
  const errCarbs = Math.abs(raw.carbsG - input.carbs_g);
  const errProtein = Math.abs(raw.proteinG - input.protein_g);
  const errFat = Math.abs(raw.fatG - input.fat_g);
  accAcc.kcal += errKcal;
  accAcc.carbs += errCarbs;
  accAcc.protein += errProtein;
  accAcc.fat += errFat;
  if (errKcal / Math.max(input.kcal, 50) <= 0.2) accAcc.kcalAcc20++;

  try {
    currentSpan().log({
      metrics: {
        mae_kcal: errKcal,
        mae_carbs_g: errCarbs,
        mae_protein_g: errProtein,
        mae_fat_g: errFat,
        in_tokens: inTokens,
        out_tokens: outTokens,
        cost_usd: cost,
      },
    });
  } catch {}

  return raw;
}

// ── Scorers (only 3, headline-only) ──

const KcalAcc20 = ({ output, expected }: { output: RawNutrition; expected: Nutrition5kCase }) => ({
  name: "kcal_acc_20pct",
  score: Math.abs(output.kcal - expected.kcal) / Math.max(expected.kcal, 50) <= 0.2 ? 1 : 0,
});

// Weighted aggregate, same formula as text eval. Tolerance 25% (image is harder).
const MacroAggregate = ({ output, expected }: { output: RawNutrition; expected: Nutrition5kCase }) => {
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
      score(output.kcal, expected.kcal) * weights.kcal +
      score(output.proteinG, expected.protein_g) * weights.protein +
      score(output.carbsG, expected.carbs_g) * weights.carbs +
      score(output.fatG, expected.fat_g) * weights.fat,
  };
};

// MAE on kcal, normalized so it fits 0-1 (1 = perfect, 0 = >300 kcal off)
const KcalMaeNorm = ({ output, expected }: { output: RawNutrition; expected: Nutrition5kCase }) => ({
  name: "kcal_mae_norm",
  score: Math.max(0, 1 - Math.abs(output.kcal - expected.kcal) / 300),
});

Eval("flexen-food-image", {
  experimentName: process.env.EVAL_NAME ?? `Image — ${MODEL_NAME}`,
  data: () =>
    SAMPLE.map((c) => ({
      input: c,
      expected: c,
      metadata: { dish_id: c.dish_id, ingredients: c.ingredients.join(", ") },
    })),
  task,
  scores: [MacroAggregate, KcalAcc20, KcalMaeNorm],
  trialCount: 1,
  maxConcurrency: 4,
});
