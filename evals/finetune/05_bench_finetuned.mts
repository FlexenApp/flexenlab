// Benchmark the fine-tuned model on both NutriBench 500 AND Flexen 25-case
// hardset. Compares against Gemini 3 Flash Preview baseline and GPT-OSS 120B
// untrained baseline.
//
// Usage: MODEL_NAME="your-fine-tuned-model-id" npx tsx finetune/05_bench_finetuned.mts

import fs from "fs";
import OpenAI from "openai";
import { FOOD_CASES } from "../dataset.js";

for (const line of fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2];
}

const MODEL_NAME = process.env.MODEL_NAME;
if (!MODEL_NAME) {
  console.error("Set MODEL_NAME to your Together fine-tune model id");
  process.exit(1);
}

const together = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: "https://api.together.xyz/v1",
});

const COT = `ESTIMATION PROCESS (mandatory steps):
1. IDENTIFY: Food item(s), preparation method, cultural context from language.
2. WEIGH: Estimate serving weight in grams. State reasoning briefly.
3. LOOKUP: Recall per-100g macros from USDA reference data.
4. CALCULATE: Multiply per-100g values by (serving_weight / 100).
5. VERIFY: protein(g)*4 + carbs(g)*4 + fat(g)*9 must be within 10% of kcal. If not, recalculate kcal from macros.
6. CONFIDENCE: HIGH (well-known food, clear portion), MEDIUM (some ambiguity), LOW (complex/unclear).

ACCURACY RULES:
- Cooked chicken breast = 31g protein per 100g. Lean beef = 26g/100g. Eggs = 13g/100g.
- Cooking method matters: fried adds 10-15% weight in oil. Grilled/baked adds minimal fat.
- US portion sizes by default.

Return ONLY a JSON object with these exact keys:
  name (string), kcal (number), carbsG (number), proteinG (number),
  fatG (number), servingSize (string), confidence ("HIGH"|"MEDIUM"|"LOW"),
  reasoning (string).`;

function buildPrompt(input: string): string {
  return `You are a certified nutritionist. Estimate the nutritional content of the described food.

CONTEXT:
- Region: United States

${COT}

Food to estimate: <user_input>${input}</user_input>`;
}

function extractJson(txt: string): any {
  if (!txt) return null;
  let t = String(txt).replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const f = t.indexOf("{"), l = t.lastIndexOf("}");
  if (f >= 0 && l > f) t = t.substring(f, l + 1);
  try { return JSON.parse(t); } catch { return null; }
}

async function callModel(prompt: string): Promise<any> {
  const res = await together.chat.completions.create({
    model: MODEL_NAME!,
    temperature: 0.1,
    max_tokens: 2048,
    messages: [
      { role: "system", content: "You are a nutritionist. Respond with a single valid JSON object only." },
      { role: "user", content: prompt },
    ],
  });
  return extractJson(res.choices[0]?.message?.content ?? "{}");
}

function inBand(a: number, t: number, tol: number): boolean {
  return Number.isFinite(a) && Math.abs(a - t) / Math.max(t, 1) <= tol;
}

// ── 1. Flexen Hardset ──
console.log(`\n═══ FLEXEN HARDSET (${FOOD_CASES.length} cases) ═══`);
let hsAll = 0, hsKcal = 0, hsKcalAcc20 = 0, hsMaeKcal = 0;
for (let i = 0; i < FOOD_CASES.length; i++) {
  const c = FOOD_CASES[i];
  process.stdout.write(`[${i+1}/${FOOD_CASES.length}] ${c.input.substring(0, 50).padEnd(50)} `);
  let pred = null;
  try { pred = await callModel(buildPrompt(c.input)); }
  catch (e: any) { console.log(`ERR: ${String(e.message||e).substring(0,60)}`); continue; }
  if (!pred) { console.log("parse-fail"); continue; }
  const k = inBand(pred.kcal, c.targetKcal, c.tolKcal);
  const p = inBand(pred.proteinG, c.targetProtein, c.tolProtein);
  const cb = inBand(pred.carbsG, c.targetCarbs, c.tolCarbs);
  const f = inBand(pred.fatG, c.targetFat, c.tolFat);
  const errK = Math.abs((pred.kcal ?? 0) - c.targetKcal);
  if (k && p && cb && f) hsAll++;
  if (k) hsKcal++;
  if (errK / Math.max(c.targetKcal, 50) <= 0.2) hsKcalAcc20++;
  hsMaeKcal += errK;
  console.log(`${k && p && cb && f ? "✓" : "✗"} ${pred.kcal}/${c.targetKcal}`);
}
const n = FOOD_CASES.length;
console.log(`\nHardset all-4:     ${hsAll}/${n} (${(hsAll/n*100).toFixed(0)}%)`);
console.log(`Hardset kcal-tol:  ${hsKcal}/${n} (${(hsKcal/n*100).toFixed(0)}%)`);
console.log(`Hardset Acc@±20%:  ${hsKcalAcc20}/${n} (${(hsKcalAcc20/n*100).toFixed(0)}%)`);
console.log(`Hardset MAE kcal:  ${(hsMaeKcal/n).toFixed(1)}`);

// ── 2. NutriBench 500 ──
console.log(`\n\n═══ NutriBench 500 ═══`);
const SAMPLE = JSON.parse(fs.readFileSync("nutribench_sample_balanced.json", "utf8"));
let nbCarbAcc = 0, nbKcalAcc20 = 0, nbMaeKcal = 0, nbMaeCarbs = 0, nbN = 0, nbErr = 0;
for (let i = 0; i < SAMPLE.length; i++) {
  const c = SAMPLE[i];
  if (i % 50 === 0) process.stdout.write(`[${i}/${SAMPLE.length}] `);
  let pred = null;
  try { pred = await callModel(buildPrompt(c.meal_description)); }
  catch { nbErr++; continue; }
  if (!pred) { nbErr++; continue; }
  nbN++;
  const errC = Math.abs((pred.carbsG ?? 0) - c.carb);
  const errK = Math.abs((pred.kcal ?? 0) - c.energy);
  if (errC <= 7.5) nbCarbAcc++;
  if (errK / Math.max(c.energy, 50) <= 0.2) nbKcalAcc20++;
  nbMaeKcal += errK;
  nbMaeCarbs += errC;
}
console.log(`\nNutriBench Acc@7.5g:    ${nbCarbAcc}/${nbN} (${(nbCarbAcc/nbN*100).toFixed(2)}%)`);
console.log(`NutriBench kcal Acc20:  ${nbKcalAcc20}/${nbN} (${(nbKcalAcc20/nbN*100).toFixed(2)}%)`);
console.log(`NutriBench MAE kcal:    ${(nbMaeKcal/nbN).toFixed(2)}`);
console.log(`NutriBench MAE carbs:   ${(nbMaeCarbs/nbN).toFixed(2)}`);
console.log(`Errors: ${nbErr}/${SAMPLE.length}`);

console.log("\n\n═══ BASELINE COMPARISON ═══");
console.log("                          Gemini 3 Flash    GPT-OSS 120B    Fine-tuned");
console.log(`NutriBench Acc@7.5g:      54.29%            49.60%          ${(nbCarbAcc/nbN*100).toFixed(2)}%`);
console.log(`NutriBench kcal Acc20:    66.71%            59.64%          ${(nbKcalAcc20/nbN*100).toFixed(2)}%`);
console.log(`NutriBench MAE kcal:      93.30             118.71          ${(nbMaeKcal/nbN).toFixed(2)}`);
console.log(`Flexen Hardset all-4:     72%               36-48%          ${(hsAll/n*100).toFixed(0)}%`);
console.log(`Flexen Hardset Acc@20%:   88%               64-84%          ${(hsKcalAcc20/n*100).toFixed(0)}%`);

fs.writeFileSync(`finetune/bench_results_${Date.now()}.json`, JSON.stringify({
  model: MODEL_NAME,
  nutribench: { n: nbN, errors: nbErr, acc_7_5: nbCarbAcc/nbN, kcal_acc20: nbKcalAcc20/nbN, mae_kcal: nbMaeKcal/nbN, mae_carbs: nbMaeCarbs/nbN },
  flexen_hardset: { n, all_4: hsAll/n, kcal_tol: hsKcal/n, kcal_acc20: hsKcalAcc20/n, mae_kcal: hsMaeKcal/n },
}, null, 2));
console.log("\n→ Saved finetune/bench_results_*.json");
