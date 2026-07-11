// Benchmark Gemini 2.5 Flash and 2.5 Flash-Lite (BASE, no fine-tune)
// against NutriBench 50 and Flexen Hardset 25.
//
// Purpose: decide if fine-tuning 2.5 Flash is the winning path to replace
// the expensive 3 Flash Preview champion at ~64% lower serving cost.
//
// Gate: need ≥45% Acc@7.5g AND ≥50% Flexen all-4 to justify fine-tune.

import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { FOOD_CASES } from "../dataset.js";

for (const line of fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2];
}

const MODELS = (process.env.MODELS ?? "gemini-2.5-flash,gemini-2.5-flash-lite").split(",");
const CONCURRENCY = 6;

const google = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const COT = `ESTIMATION PROCESS (mandatory steps):
1. IDENTIFY: Food item(s), preparation method, cultural context from language.
2. WEIGH: Estimate serving weight in grams. State reasoning briefly.
3. LOOKUP: Recall per-100g macros from USDA reference data.
4. CALCULATE: Multiply per-100g values by (serving_weight / 100).
5. VERIFY: protein(g)*4 + carbs(g)*4 + fat(g)*9 must be within 10% of kcal.
6. CONFIDENCE: HIGH (well-known food, clear portion), MEDIUM (some ambiguity), LOW (complex/unclear).

ACCURACY RULES:
- Cooked chicken breast = 31g protein per 100g. Lean beef = 26g/100g. Eggs = 13g/100g.
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

async function callModel(model: string, prompt: string): Promise<any> {
  const res = await google.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
      maxOutputTokens: 16384,
      thinkingConfig: { thinkingBudget: -1 },
    },
  });
  return extractJson(res.text ?? "{}");
}

function num(x: any): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") { const m = x.match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; }
  return NaN;
}

async function runPool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (idx < items.length) { const i = idx++; results[i] = await fn(items[i], i); }
  }));
  return results;
}

function inBand(a: number, t: number, tol: number): boolean {
  return Number.isFinite(a) && Math.abs(a - t) / Math.max(t, 1) <= tol;
}

const SAMPLE = JSON.parse(fs.readFileSync("nutribench_sample_balanced.json", "utf8")).slice(0, 50);

async function benchModel(model: string) {
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  ${model}`);
  console.log(`═══════════════════════════════════════════════════════════════`);

  // Flexen Hardset
  console.log(`\n─── FLEXEN HARDSET (${FOOD_CASES.length}) ───`);
  const hsResults = await runPool(FOOD_CASES, CONCURRENCY, async (c) => {
    try { return { pred: await callModel(model, buildPrompt(c.input)), err: null as string | null }; }
    catch (e: any) { return { pred: null, err: String(e.message || e).substring(0, 80) }; }
  });

  let hsAll = 0, hsKcal = 0, hsKcalAcc20 = 0, hsMaeKcal = 0, hsErr = 0;
  for (let i = 0; i < hsResults.length; i++) {
    const r = hsResults[i], c = FOOD_CASES[i];
    if (!r.pred) { console.log(`[${i + 1}] ${c.input.substring(0, 42).padEnd(42)} ERR ${r.err}`); hsErr++; continue; }
    const kcal = num(r.pred.kcal), prot = num(r.pred.proteinG), carb = num(r.pred.carbsG), fat = num(r.pred.fatG);
    const okK = inBand(kcal, c.targetKcal, c.tolKcal);
    const okP = inBand(prot, c.targetProtein, c.tolProtein);
    const okC = inBand(carb, c.targetCarbs, c.tolCarbs);
    const okF = inBand(fat, c.targetFat, c.tolFat);
    const all = okK && okP && okC && okF;
    const errK = Math.abs(kcal - c.targetKcal);
    if (all) hsAll++;
    if (okK) hsKcal++;
    if (errK / Math.max(c.targetKcal, 50) <= 0.2) hsKcalAcc20++;
    hsMaeKcal += errK;
    console.log(`[${i + 1}] ${c.input.substring(0, 42).padEnd(42)} ${all ? "✓" : "✗"} ${Math.round(kcal)}/${c.targetKcal}`);
  }
  const hn = FOOD_CASES.length;
  console.log(`  all-4:      ${hsAll}/${hn} (${(hsAll / hn * 100).toFixed(0)}%)`);
  console.log(`  kcal-tol:   ${hsKcal}/${hn} (${(hsKcal / hn * 100).toFixed(0)}%)`);
  console.log(`  Acc@±20%:   ${hsKcalAcc20}/${hn} (${(hsKcalAcc20 / hn * 100).toFixed(0)}%)`);
  console.log(`  MAE kcal:   ${(hsMaeKcal / hn).toFixed(1)}`);
  console.log(`  errors:     ${hsErr}`);

  // NutriBench 50
  console.log(`\n─── NutriBench ${SAMPLE.length} ───`);
  const nbResults = await runPool(SAMPLE, CONCURRENCY, async (c: any) => {
    try { return { pred: await callModel(model, buildPrompt(c.meal_description)), err: null as string | null }; }
    catch (e: any) { return { pred: null, err: String(e.message || e).substring(0, 80) }; }
  });

  let nbCarbAcc = 0, nbKcalAcc20 = 0, nbMaeKcal = 0, nbMaeCarbs = 0, nbN = 0, nbErr = 0;
  for (let i = 0; i < nbResults.length; i++) {
    const r = nbResults[i], c = SAMPLE[i];
    if (!r.pred) { nbErr++; continue; }
    nbN++;
    const kcal = num(r.pred.kcal), carb = num(r.pred.carbsG);
    const errC = Math.abs(carb - c.carb);
    const errK = Math.abs(kcal - c.energy);
    if (errC <= 7.5) nbCarbAcc++;
    if (errK / Math.max(c.energy, 50) <= 0.2) nbKcalAcc20++;
    nbMaeKcal += errK;
    nbMaeCarbs += errC;
  }
  console.log(`  Acc@7.5g:   ${nbCarbAcc}/${nbN} (${(nbCarbAcc / nbN * 100).toFixed(2)}%)`);
  console.log(`  kcal Acc20: ${nbKcalAcc20}/${nbN} (${(nbKcalAcc20 / nbN * 100).toFixed(2)}%)`);
  console.log(`  MAE kcal:   ${(nbMaeKcal / nbN).toFixed(2)}`);
  console.log(`  MAE carbs:  ${(nbMaeCarbs / nbN).toFixed(2)}`);
  console.log(`  errors:     ${nbErr}/${SAMPLE.length}`);

  return {
    model,
    nutribench: { n: nbN, errors: nbErr, acc_7_5: nbCarbAcc / nbN, kcal_acc20: nbKcalAcc20 / nbN, mae_kcal: nbMaeKcal / nbN, mae_carbs: nbMaeCarbs / nbN },
    flexen_hardset: { n: hn, errors: hsErr, all_4: hsAll / hn, kcal_tol: hsKcal / hn, kcal_acc20: hsKcalAcc20 / hn, mae_kcal: hsMaeKcal / hn },
  };
}

const all = [];
for (const m of MODELS) all.push(await benchModel(m));

console.log("\n\n═══ SUMMARY ═══");
console.log("                          Gemini 3 FP      GPT-OSS 120B    " + all.map(a => a.model.replace("gemini-", "").padEnd(14)).join(""));
console.log(`NutriBench Acc@7.5g:      54.29%           49.60%          ` + all.map(a => (a.nutribench.acc_7_5 * 100).toFixed(2) + "%").map(s => s.padEnd(14)).join(""));
console.log(`NutriBench kcal Acc20:    66.71%           59.64%          ` + all.map(a => (a.nutribench.kcal_acc20 * 100).toFixed(2) + "%").map(s => s.padEnd(14)).join(""));
console.log(`NutriBench MAE kcal:      93.30            118.71          ` + all.map(a => a.nutribench.mae_kcal.toFixed(2)).map(s => s.padEnd(14)).join(""));
console.log(`Flexen Hardset all-4:     72%              36-48%          ` + all.map(a => (a.flexen_hardset.all_4 * 100).toFixed(0) + "%").map(s => s.padEnd(14)).join(""));
console.log(`Flexen Hardset Acc@20%:   88%              64-84%          ` + all.map(a => (a.flexen_hardset.kcal_acc20 * 100).toFixed(0) + "%").map(s => s.padEnd(14)).join(""));

console.log("\n═══ GATE ═══");
for (const a of all) {
  const g1 = a.nutribench.acc_7_5 >= 0.45;
  const g2 = a.flexen_hardset.all_4 >= 0.50;
  console.log(`${a.model}:`);
  console.log(`  NutriBench ≥45%: ${g1 ? "✓" : "✗"}  (${(a.nutribench.acc_7_5 * 100).toFixed(1)}%)`);
  console.log(`  Flexen all-4 ≥50%: ${g2 ? "✓" : "✗"}  (${(a.flexen_hardset.all_4 * 100).toFixed(0)}%)`);
  console.log(`  → ${g1 && g2 ? "PROCEED with fine-tune" : "BELOW gate, consider skipping"}`);
}

fs.writeFileSync(`finetune/bench_gemini_25_base_${Date.now()}.json`, JSON.stringify(all, null, 2));
console.log("\n→ Saved bench_gemini_25_base_*.json");
