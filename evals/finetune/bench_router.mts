// End-to-end benchmark of the Smart Router:
//   Brand queries  → gemini-3-flash-preview
//   Generic queries → gemini-3.1-flash-lite-preview
//
// Validates that the routed system matches (or beats) the pure 3 FP baseline
// while paying ~60% less per call on average.

import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { FOOD_CASES } from "../dataset.js";

for (const line of fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2];
}

const google = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// NOTE: BRAND_KEYWORDS below is superseded at runtime by the live list
// extracted from functions/index.js (see ~L60). Keep this as a fallback only.
const _BRAND_KEYWORDS_FALLBACK = [
  "mcdonald", "burger king", "bk ", "wendy", "taco bell", "kfc", "chick-fil-a",
  "chickfila", "chick fil a", "subway ", "popeye", "arby", "five guys",
  "in-n-out", "in n out", "innout", "shake shack", "whataburger",
  "jack in the box", "carl's jr", "carls jr", "sonic ", "chipotle",
  "panda express", "raising cane", "jersey mike", "qdoba", "moe's southwest",
  "dairy queen", "little caesar", "domino", "pizza hut", "papa john",
  "papa murphy", "sam's club", "sams club", "sam's", "costco", "walmart",
  "starbucks", "dunkin", "peet", "tim horton", "dutch bros", "philz",
  "blue bottle",
  "panera", "sweetgreen", "cava ", "chopt", "olive garden", "applebee",
  "cheesecake factory", "texas roadhouse", "outback", "red lobster",
  "buffalo wild", "ihop", "denny's", "cracker barrel", "longhorn",
  "red robin", "tgi friday", "chili's",
  "ben & jerry", "ben and jerry", "haagen", "häagen", "baskin robbin",
  "cold stone",
  "trader joe", "whole foods", "kirkland", "kind ", "clif ", "rx bar",
  "perfect bar", "chobani", "fage", "siggi", "beyond ", "impossible ",
  "quaker ", "oreo", "oatly", "silk ",
  "big mac", "quarter pounder", "mcnugget", "mcflurry", "mcchicken",
  "mcmuffin", "mcgriddle", "whopper", "bellgrande", "doritos",
  " venti ", " grande ", " tall ",
  "double-double", "animal style", "frappuccino", "refresher",
];

// Load live CF source once
const CF_SRC = fs.readFileSync(
  "C:/Users/Leonard/Documents/Business/Flexen/flexenapp/functions/index.js",
  "utf8",
);
const _mSys = CF_SRC.match(/const FOOD_SYSTEM_INSTRUCTION = `([\s\S]*?)`;/);
if (!_mSys) throw new Error("Could not extract FOOD_SYSTEM_INSTRUCTION from functions/index.js");
const SYSTEM = _mSys[1];

// Extract the LIVE BRAND_KEYWORDS array from functions/index.js
function extractBrandKeywords(src: string): string[] {
  const mm = src.match(/const BRAND_KEYWORDS = \[([\s\S]*?)\];/);
  if (!mm) throw new Error("Could not extract BRAND_KEYWORDS from functions/index.js");
  const out: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"/g;
  let x;
  while ((x = re.exec(mm[1])) !== null) out.push(x[1]);
  return out;
}
const BRAND_KEYWORDS = extractBrandKeywords(CF_SRC);
console.log(`→ Loaded ${BRAND_KEYWORDS.length} brand keywords from CF, ${SYSTEM.length} char prompt`);

function hasBrand(text: string): boolean {
  const s = ` ${(text || "").toLowerCase()} `;
  return BRAND_KEYWORDS.some((k) => s.includes(k));
}

const PREMIUM = "gemini-3-flash-preview";
const LITE = "gemini-3.1-flash-lite-preview";
const FORCE_PURE = process.env.PURE === "1"; // bench pure 3 FP on same samples
const pickModel = (q: string) => FORCE_PURE ? PREMIUM : (hasBrand(q) ? PREMIUM : LITE);

const KEYS = `\n\nReturn JSON with EXACTLY these keys: name (string), kcal (number), carbsG (number), proteinG (number), fatG (number), servingSize (string), confidence ("HIGH"|"MEDIUM"|"LOW"), reasoning (string).`;

const buildPrompt = (input: string) =>
  `${SYSTEM}${KEYS}\n\nFood to estimate: <user_input>${input}</user_input>`;

function extractJson(txt: string): any {
  if (!txt) return null;
  let t = String(txt).replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const f = t.indexOf("{"), l = t.lastIndexOf("}");
  if (f >= 0 && l > f) t = t.substring(f, l + 1);
  try { return JSON.parse(t); } catch { return null; }
}

async function callModel(model: string, prompt: string): Promise<any> {
  const isLite = model === LITE;
  const res = await google.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: Number(process.env.TEMP ?? 0.1),
      responseMimeType: "application/json",
      maxOutputTokens: isLite ? 16384 : 4096,
      ...(isLite ? { thinkingConfig: process.env.THINK_LEVEL
        ? { thinkingLevel: process.env.THINK_LEVEL }
        : { thinkingBudget: -1 } } : {}),
    },
  });
  const parsed = extractJson(res.text ?? "{}");
  // Atwater Auto-Repair: mirror CF post-processing
  if (parsed && process.env.ATWATER_REPAIR !== "0") {
    const k = Number(parsed.kcal), p = Number(parsed.proteinG), c = Number(parsed.carbsG), f = Number(parsed.fatG);
    if ([k, p, c, f].every(Number.isFinite) && k > 0) {
      const atw = 4 * p + 4 * c + 9 * f;
      if (Math.abs(k - atw) / Math.max(k, 1) > 0.12) {
        parsed.kcal = Math.round(atw);
      }
    }
  }
  return parsed;
}

// Escalation Router v2: lite → premium retry on low confidence / atwater drift.
// Env ESCALATE=1 enables; set to 0 to measure vs v1.
const ENABLE_ESCALATE = process.env.ESCALATE !== "0";
function shouldEscalate(p: any): string | null {
  if (!p) return "parse_error";
  const k = Number(p.kcal), pr = Number(p.proteinG), c = Number(p.carbsG), f = Number(p.fatG);
  if (![k, pr, c, f].every(Number.isFinite)) return "missing_fields";
  if (k <= 0 || k > 5000) return "kcal_out_of_range";
  const atw = 4 * pr + 4 * c + 9 * f;
  const drift = Math.abs(k - atw) / Math.max(k, 1);
  if (drift > 0.15) return `atwater_${(drift * 100).toFixed(0)}pct`;
  // Confidence != HIGH is NOT a trigger: bench 2026-04-10 showed lite is
  // conservative (rarely HIGH), over-escalating dropped Flexen all-4 by 12pp
  // because premium overrode correct lite answers. Keep triggers narrow.
  const conf = String(p.confidence || "").toUpperCase();
  if (conf === "LOW") return "conf_LOW"; // only LOW escalates, MEDIUM stays
  return null;
}

async function routedCall(query: string): Promise<{ model: string; pred: any; escalated: boolean; reason: string | null }> {
  const initial = pickModel(query);
  const pred = await callModel(initial, buildPrompt(query));
  if (initial === PREMIUM || !ENABLE_ESCALATE) {
    return { model: initial, pred, escalated: false, reason: null };
  }
  const reason = shouldEscalate(pred);
  if (!reason) {
    return { model: initial, pred, escalated: false, reason: null };
  }
  const upgraded = await callModel(PREMIUM, buildPrompt(query));
  return { model: PREMIUM, pred: upgraded, escalated: true, reason };
}

function num(x: any): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") { const m = x.match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; }
  return NaN;
}
const inBand = (a: number, t: number, tol: number) =>
  Number.isFinite(a) && Math.abs(a - t) / Math.max(t, 1) <= tol;

async function runPool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (idx < items.length) { const i = idx++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// Pricing per 1M tokens — INCLUDES THINKING TOKENS (billed as output).
// Measured 2026-04-10: Lite generates ~1600 thinking + ~140 visible output per call.
// Premium generates ~760 thinking + ~130 visible output per call.
// Vertex AI pricing (production CF uses Vertex, not Developer API).
const PRICE = {
  [PREMIUM]: { in: 0.50, out: 3.00 },  // gemini-3-flash-preview Vertex
  [LITE]: { in: 0.25, out: 1.50 },      // gemini-3.1-flash-lite-preview Vertex
};
// Measured average tokens per food estimation call (input + visible output + thinking)
const AVG_TOK = {
  [PREMIUM]: { in: 2680, visOut: 130, think: 760 },  // total out = 890
  [LITE]: { in: 2680, visOut: 140, think: 1600 },     // total out = 1740
};
function costPerCall(m: string): number {
  const t = AVG_TOK[m] || AVG_TOK[LITE];
  const totalOut = t.visOut + t.think;
  return (PRICE[m].in * t.in + PRICE[m].out * totalOut) / 1e6;
}
// Premium with context cache: ~75% input cost reduction
const costPerCallCached = (m: string) => {
  const t = AVG_TOK[m] || AVG_TOK[LITE];
  const totalOut = t.visOut + t.think;
  const inCost = m === PREMIUM ? PRICE[m].in * t.in * 0.25 : PRICE[m].in * t.in; // cached = 75% off
  return (inCost + PRICE[m].out * totalOut) / 1e6;
};

const NB_N = Number(process.env.NB_N || 200);
console.log("\n═══ SMART ROUTER END-TO-END BENCHMARK ═══\n");

// ── 1. Flexen Hardset ──
console.log("─── Flexen Hardset 25 ───");
const hsTrace: { i: number; model: string; pred: any; err: string | null }[] = [];
const hsResults = await runPool(FOOD_CASES, 6, async (c, i) => {
  try {
    const r = await routedCall(c.input);
    return { i, model: r.model, pred: r.pred, escalated: r.escalated, reason: r.reason, err: null as string | null };
  } catch (e: any) {
    return { i, model: pickModel(c.input), pred: null, escalated: false, reason: null, err: String(e.message || e).substring(0, 80) };
  }
});

const hsCases: any[] = [];
let hsAll = 0, hsKcal = 0, hsKcalAcc20 = 0, hsMaeKcal = 0, hsErr = 0;
let hsPremium = 0, hsLite = 0, hsEscalated = 0, hsCost = 0;
for (const r of hsResults) {
  const c = FOOD_CASES[r.i];
  const tag = r.escalated ? "[E]" : (r.model === PREMIUM ? "[P]" : "[L]");
  if (r.model === PREMIUM) hsPremium++; else hsLite++;
  if (r.escalated) { hsEscalated++; hsCost += costPerCall(LITE); }
  hsCost += costPerCall(r.model);
  if (!r.pred) { console.log(`${tag} [${r.i + 1}] ${c.input.substring(0, 42).padEnd(42)} ERR ${r.err}`); hsErr++; continue; }
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
  hsCases.push({
    i: r.i, model: r.model, input: c.input,
    target: { kcal: c.targetKcal, protein: c.targetProtein, carbs: c.targetCarbs, fat: c.targetFat },
    pred: { kcal, protein: prot, carbs: carb, fat, confidence: r.pred.confidence },
    ok: { kcal: okK, protein: okP, carbs: okC, fat: okF, all },
  });
  const missFlags = [okK ? "" : "K", okP ? "" : "P", okC ? "" : "C", okF ? "" : "F"].filter(Boolean).join("");
  console.log(`${tag} [${r.i + 1}] ${c.input.substring(0, 42).padEnd(42)} ${all ? "✓    " : "✗" + missFlags.padEnd(4)} ${Math.round(kcal)}/${c.targetKcal}`);
}
const hn = FOOD_CASES.length;
console.log(`\nrouting:     premium=${hsPremium}  lite=${hsLite}  escalated=${hsEscalated}`);
console.log(`all-4:       ${hsAll}/${hn} (${(hsAll / hn * 100).toFixed(0)}%)`);
console.log(`kcal-tol:    ${hsKcal}/${hn} (${(hsKcal / hn * 100).toFixed(0)}%)`);
console.log(`Acc@±20%:    ${hsKcalAcc20}/${hn} (${(hsKcalAcc20 / hn * 100).toFixed(0)}%)`);
console.log(`MAE kcal:    ${(hsMaeKcal / hn).toFixed(1)}`);
console.log(`avg $/call:  $${(hsCost / hn).toFixed(5)}`);
console.log(`errors:      ${hsErr}`);

// ── 2. NutriBench ──
console.log(`\n─── NutriBench ${NB_N} ───`);
const SAMPLE = JSON.parse(fs.readFileSync("nutribench_sample_balanced.json", "utf8")).slice(0, NB_N);
const nbResults = await runPool(SAMPLE, 6, async (c: any) => {
  try {
    const r = await routedCall(c.meal_description);
    return { model: r.model, pred: r.pred, escalated: r.escalated, reason: r.reason, err: null as string | null };
  } catch (e: any) {
    return { model: pickModel(c.meal_description), pred: null, escalated: false, reason: null, err: String(e.message || e).substring(0, 80) };
  }
});

const nbCases: any[] = [];
let nbCarbAcc = 0, nbKcalAcc20 = 0, nbMaeKcal = 0, nbMaeCarbs = 0, nbN = 0, nbErr = 0;
let nbPremium = 0, nbLite = 0, nbEscalated = 0, nbCost = 0;
for (let i = 0; i < nbResults.length; i++) {
  const r = nbResults[i]; const c = SAMPLE[i];
  if (r.model === PREMIUM) nbPremium++; else nbLite++;
  if (r.escalated) { nbEscalated++; nbCost += costPerCall(LITE); }
  nbCost += costPerCall(r.model);
  if (!r.pred) { nbErr++; continue; }
  nbN++;
  const kcal = num(r.pred.kcal), carb = num(r.pred.carbsG);
  const errC = Math.abs(carb - c.carb);
  const errK = Math.abs(kcal - c.energy);
  if (errC <= 7.5) nbCarbAcc++;
  if (errK / Math.max(c.energy, 50) <= 0.2) nbKcalAcc20++;
  nbMaeKcal += errK;
  nbMaeCarbs += errC;
  nbCases.push({
    i, model: r.model, input: c.meal_description,
    target: { kcal: c.energy, carbs: c.carb },
    pred: { kcal, carbs: carb, confidence: r.pred.confidence },
    errC, errK,
    carbOk: errC <= 7.5, kcalOk: errK / Math.max(c.energy, 50) <= 0.2,
  });
}
console.log(`routing:      premium=${nbPremium}  lite=${nbLite}  escalated=${nbEscalated}`);
console.log(`Acc@7.5g:     ${nbCarbAcc}/${nbN} (${(nbCarbAcc / nbN * 100).toFixed(2)}%)`);
console.log(`kcal Acc20:   ${nbKcalAcc20}/${nbN} (${(nbKcalAcc20 / nbN * 100).toFixed(2)}%)`);
console.log(`MAE kcal:     ${(nbMaeKcal / nbN).toFixed(2)}`);
console.log(`MAE carbs:    ${(nbMaeCarbs / nbN).toFixed(2)}`);
console.log(`avg $/call:   $${(nbCost / SAMPLE.length).toFixed(5)}`);
console.log(`errors:       ${nbErr}/${SAMPLE.length}`);

// ── Summary vs pure 3 FP ──
console.log("\n\n═══ COMPARISON vs pure gemini-3-flash-preview ═══");
console.log("                         Pure 3 FP       ROUTED          Delta");
console.log(`NutriBench Acc@7.5g:     54.29%          ${(nbCarbAcc / nbN * 100).toFixed(2)}%         ${((nbCarbAcc / nbN - 0.5429) * 100).toFixed(1)} pts`);
console.log(`NutriBench kcal Acc20:   66.71%          ${(nbKcalAcc20 / nbN * 100).toFixed(2)}%         ${((nbKcalAcc20 / nbN - 0.6671) * 100).toFixed(1)} pts`);
console.log(`NutriBench MAE kcal:     93.30           ${(nbMaeKcal / nbN).toFixed(2)}          ${((nbMaeKcal / nbN) - 93.30).toFixed(1)}`);
console.log(`Flexen Hardset all-4:    72%             ${(hsAll / hn * 100).toFixed(0)}%             ${((hsAll / hn - 0.72) * 100).toFixed(1)} pts`);
console.log(`Flexen Hardset Acc@20%:  88%             ${(hsKcalAcc20 / hn * 100).toFixed(0)}%             ${((hsKcalAcc20 / hn - 0.88) * 100).toFixed(1)} pts`);

const avgCost = (hsCost + nbCost) / (hn + SAMPLE.length);
const pureCost = costPerCall(PREMIUM);
const pureCostCached = costPerCallCached(PREMIUM);
console.log(`\navg $/call (uncached):   $${pureCost.toFixed(5)}       $${avgCost.toFixed(5)}       ${((avgCost / pureCost - 1) * 100).toFixed(0)}%`);
console.log(`avg $/call (cached):     $${pureCostCached.toFixed(5)}       $${avgCost.toFixed(5)}       ${((avgCost / pureCostCached - 1) * 100).toFixed(0)}%`);
console.log(`@ 1M calls/mo (cached):  $${(pureCostCached * 1e6).toFixed(0)}          $${(avgCost * 1e6).toFixed(0)}           -$${((pureCostCached - avgCost) * 1e6).toFixed(0)}`);

fs.writeFileSync(`finetune/bench_router_${Date.now()}.json`, JSON.stringify({
  flexen: { n: hn, all_4: hsAll / hn, kcal_acc20: hsKcalAcc20 / hn, mae_kcal: hsMaeKcal / hn, premium: hsPremium, lite: hsLite },
  nutribench: { n: nbN, errors: nbErr, acc_7_5: nbCarbAcc / nbN, kcal_acc20: nbKcalAcc20 / nbN, mae_kcal: nbMaeKcal / nbN, premium: nbPremium, lite: nbLite },
  cost: { avg_per_call: avgCost, pure_premium: pureCost, monthly_1m: avgCost * 1e6, savings_vs_pure: (pureCost - avgCost) * 1e6 },
  hsCases,
  nbCases,
}, null, 2));
console.log("\n→ Saved bench_router_*.json");
