// Benchmark Llama 3.3 70B Instruct Turbo (BASE, no fine-tune) against
// NutriBench 50 and Flexen Hardset 25 via Together serverless.
//
// Purpose: decide if Llama 70B is close enough to Gemini that a fine-tune
// would plausibly close the gap with 57% cost savings.
//
// Gate: need ≥48% Acc@7.5g on NutriBench AND ≥40% all-4 on Flexen Hardset
// to justify spending $25 on a fine-tune run.

import fs from "fs";
import OpenAI from "openai";
import { FOOD_CASES } from "../dataset.js";

for (const line of fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2];
}

const MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";
const CONCURRENCY = 8;

const together = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: "https://api.together.xyz/v1",
});

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

async function callModel(prompt: string): Promise<any> {
  const res = await together.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    max_tokens: 2048,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are a certified nutritionist. Respond with a single valid JSON object only, no prose." },
      { role: "user", content: prompt },
    ],
  });
  return extractJson(res.choices[0]?.message?.content ?? "{}");
}

function num(x: any): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const m = x.match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  }
  return NaN;
}

async function runPool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: n }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

function inBand(a: number, t: number, tol: number): boolean {
  return Number.isFinite(a) && Math.abs(a - t) / Math.max(t, 1) <= tol;
}

// ── 1. Flexen Hardset ──
console.log(`\n═══ ${MODEL} — FLEXEN HARDSET (${FOOD_CASES.length} cases) ═══`);
const hsResults = await runPool(FOOD_CASES, CONCURRENCY, async (c, i) => {
  try {
    const pred = await callModel(buildPrompt(c.input));
    if (!pred) return { i, pred: null, err: "parse-fail" };
    return { i, pred, err: null };
  } catch (e: any) {
    return { i, pred: null, err: String(e.message || e).substring(0, 80) };
  }
});

let hsAll = 0, hsKcal = 0, hsKcalAcc20 = 0, hsMaeKcal = 0, hsErr = 0;
for (const r of hsResults) {
  const c = FOOD_CASES[r.i];
  if (!r.pred) { console.log(`[${r.i + 1}] ${c.input.substring(0, 45).padEnd(45)} ERR: ${r.err}`); hsErr++; continue; }
  const p = r.pred;
  const kcal = num(p.kcal), prot = num(p.proteinG), carb = num(p.carbsG), fat = num(p.fatG);
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
  console.log(`[${r.i + 1}] ${c.input.substring(0, 45).padEnd(45)} ${all ? "✓" : "✗"} ${Math.round(kcal)}/${c.targetKcal}`);
}
const hn = FOOD_CASES.length;
console.log(`\nHardset all-4:     ${hsAll}/${hn} (${(hsAll / hn * 100).toFixed(0)}%)`);
console.log(`Hardset kcal-tol:  ${hsKcal}/${hn} (${(hsKcal / hn * 100).toFixed(0)}%)`);
console.log(`Hardset Acc@±20%:  ${hsKcalAcc20}/${hn} (${(hsKcalAcc20 / hn * 100).toFixed(0)}%)`);
console.log(`Hardset MAE kcal:  ${(hsMaeKcal / hn).toFixed(1)}`);
console.log(`Hardset errors:    ${hsErr}`);

// ── 2. NutriBench 50 (balanced sample, same as baseline) ──
const SAMPLE = JSON.parse(fs.readFileSync("nutribench_sample_balanced.json", "utf8")).slice(0, 50);
console.log(`\n\n═══ ${MODEL} — NutriBench ${SAMPLE.length} ═══`);

const nbResults = await runPool(SAMPLE, CONCURRENCY, async (c: any) => {
  try {
    const pred = await callModel(buildPrompt(c.meal_description));
    return { pred, err: null as string | null };
  } catch (e: any) {
    return { pred: null, err: String(e.message || e).substring(0, 80) };
  }
});

let nbCarbAcc = 0, nbKcalAcc20 = 0, nbMaeKcal = 0, nbMaeCarbs = 0, nbN = 0, nbErr = 0;
for (let i = 0; i < nbResults.length; i++) {
  const r = nbResults[i];
  const c = SAMPLE[i];
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

console.log(`NutriBench Acc@7.5g:    ${nbCarbAcc}/${nbN} (${(nbCarbAcc / nbN * 100).toFixed(2)}%)`);
console.log(`NutriBench kcal Acc20:  ${nbKcalAcc20}/${nbN} (${(nbKcalAcc20 / nbN * 100).toFixed(2)}%)`);
console.log(`NutriBench MAE kcal:    ${(nbMaeKcal / nbN).toFixed(2)}`);
console.log(`NutriBench MAE carbs:   ${(nbMaeCarbs / nbN).toFixed(2)}`);
console.log(`Errors: ${nbErr}/${SAMPLE.length}`);

// ── Comparison ──
console.log("\n\n═══ BASELINE COMPARISON (base models, no fine-tune) ═══");
console.log("                         Gemini 3 Flash    GPT-OSS 120B    Llama 3.3 70B");
console.log(`NutriBench Acc@7.5g:     54.29%            49.60%          ${(nbCarbAcc / nbN * 100).toFixed(2)}%`);
console.log(`NutriBench kcal Acc20:   66.71%            59.64%          ${(nbKcalAcc20 / nbN * 100).toFixed(2)}%`);
console.log(`NutriBench MAE kcal:     93.30             118.71          ${(nbMaeKcal / nbN).toFixed(2)}`);
console.log(`Flexen Hardset all-4:    72%               36-48%          ${(hsAll / hn * 100).toFixed(0)}%`);
console.log(`Flexen Hardset Acc@20%:  88%               64-84%          ${(hsKcalAcc20 / hn * 100).toFixed(0)}%`);

console.log("\n═══ GATE ═══");
const gateNB = (nbCarbAcc / nbN) >= 0.48;
const gateFX = (hsAll / hn) >= 0.40;
console.log(`NutriBench ≥48% Acc@7.5g: ${gateNB ? "✓ PASS" : "✗ FAIL"}  (${(nbCarbAcc / nbN * 100).toFixed(1)}%)`);
console.log(`Flexen all-4   ≥40%:      ${gateFX ? "✓ PASS" : "✗ FAIL"}  (${(hsAll / hn * 100).toFixed(0)}%)`);
console.log(gateNB && gateFX
  ? "\n→ Proceed with Llama 3.3 70B fine-tune. Expected +5-10 pts, stays serverless."
  : "\n→ KILL. Llama base too far behind Gemini. Stay with Gemini.");

fs.writeFileSync(`finetune/bench_llama_base_${Date.now()}.json`, JSON.stringify({
  model: MODEL,
  nutribench: { n: nbN, errors: nbErr, acc_7_5: nbCarbAcc / nbN, kcal_acc20: nbKcalAcc20 / nbN, mae_kcal: nbMaeKcal / nbN, mae_carbs: nbMaeCarbs / nbN },
  flexen_hardset: { n: hn, errors: hsErr, all_4: hsAll / hn, kcal_tol: hsKcal / hn, kcal_acc20: hsKcalAcc20 / hn, mae_kcal: hsMaeKcal / hn },
  gate: { nb: gateNB, fx: gateFX, pass: gateNB && gateFX },
}, null, 2));
console.log("\n→ Saved bench_llama_base_*.json");
