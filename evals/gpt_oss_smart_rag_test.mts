// Smart RAG: only inject FatSecret context when the query contains a brand
// token AND FatSecret returns a brand-named match (not user-generated noise).
// Fallback to no-RAG for generic queries where RAG hurts more than helps.

import fs from "fs";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { FOOD_CASES } from "./dataset.js";
import { getRagContext } from "./fatsecret.js";

for (const line of fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2];
}

const google = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const ollama = new OpenAI({ apiKey: process.env.OLLAMA_API_KEY!, baseURL: "https://ollama.com/v1", timeout: 300_000 });

// Brand tokens — if any of these appears in the query (case-insensitive),
// we consider it a "brand query" worthy of RAG lookup.
const BRAND_TOKENS = [
  "starbucks", "macchiato", "latte", "frappuccino", "espresso",
  "mcdonald", "big mac", "mcflurry", "quarter pounder",
  "chipotle", "burrito bowl",
  "in n out", "in-n-out", "double-double", "animal style",
  "subway", "footlong",
  "taco bell", "crunchwrap",
  "kfc", "popeyes",
  "chick-fil-a", "chick fil a",
  "wendy", "baconator",
  "five guys",
  "panera", "sweetgreen", "cava", "chopt",
  "beyond burger", "beyond meat", "impossible burger",
  "ben & jerry", "ben and jerry", "haagen-dazs",
  "trader joe",
  "sam's club", "sams club", "costco",
  "whole foods", "365",
  "pepsi", "coca-cola", "coke", "dr pepper", "mountain dew",
  "red bull", "monster",
  "domino", "pizza hut", "papa john",
  "dunkin", "krispy kreme",
  "oreo", "doritos", "cheetos", "lay's", "lays", "pringles",
  "kellogg", "cheerios", "lucky charms",
  "kraft", "heinz",
];

function hasBrandToken(query: string): boolean {
  const lower = query.toLowerCase();
  return BRAND_TOKENS.some(b => lower.includes(b));
}

// Verify RAG hit quality: require that at least one returned line contains
// a brand-ish name AND the serving info looks parseable
function isRagTrustworthy(rag: string, query: string): boolean {
  if (!rag) return false;
  const lower = query.toLowerCase();
  const ragLower = rag.toLowerCase();
  // Find which brand token triggered the query
  const brandMatch = BRAND_TOKENS.find(b => lower.includes(b));
  if (!brandMatch) return false;
  // Check if the same brand token appears in the RAG result
  return ragLower.includes(brandMatch);
}

const COT_SHORT = `ESTIMATION PROCESS (mandatory steps):
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

function buildPrompt(input: string, rag: string | null): string {
  const ragBlock = rag ? `\n\nDATABASE MATCHES (use these as reference for brand-published nutrition):\n${rag}\n` : "";
  return `You are a certified nutritionist. Estimate the nutritional content of the described food.

CONTEXT:
- Region: United States
${ragBlock}
${COT_SHORT}

Food to estimate: <user_input>${input}</user_input>`;
}

function extractJson(txt: string): any {
  if (!txt) return null;
  let t = String(txt).replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const f = t.indexOf("{"), l = t.lastIndexOf("}");
  if (f >= 0 && l > f) t = t.substring(f, l + 1);
  try { return JSON.parse(t); } catch { return null; }
}

async function callGemini(prompt: string) {
  const res = await google.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { temperature: 0.1, responseMimeType: "application/json", maxOutputTokens: 4096 } as any,
  });
  return extractJson(res.text ?? "{}");
}

async function callOllama(prompt: string) {
  const res = await ollama.chat.completions.create({
    model: "gpt-oss:120b",
    temperature: 0.1,
    max_tokens: 4096,
    messages: [
      { role: "system", content: "Respond with a single valid JSON object only. No prose outside the JSON." },
      { role: "user", content: prompt },
    ],
  });
  const msg: any = res.choices[0]?.message ?? {};
  const txt = (msg.content && msg.content.trim()) ? msg.content : (msg.reasoning ?? "{}");
  return extractJson(txt);
}

function inBand(actual: number, target: number, tol: number): boolean {
  if (!Number.isFinite(actual)) return false;
  return Math.abs(actual - target) / Math.max(target, 1) <= tol;
}

function scoreCase(pred: any, c: any) {
  if (!pred) return { kcal: 0, protein: 0, carbs: 0, fat: 0, all: 0, kcal_acc20: 0, errKcal: 9999 };
  const k = inBand(pred.kcal, c.targetKcal, c.tolKcal) ? 1 : 0;
  const p = inBand(pred.proteinG, c.targetProtein, c.tolProtein) ? 1 : 0;
  const cb = inBand(pred.carbsG, c.targetCarbs, c.tolCarbs) ? 1 : 0;
  const f = inBand(pred.fatG, c.targetFat, c.tolFat) ? 1 : 0;
  const errK = Math.abs((pred.kcal ?? 0) - c.targetKcal);
  return {
    kcal: k, protein: p, carbs: cb, fat: f,
    all: (k && p && cb && f) ? 1 : 0,
    kcal_acc20: errK / Math.max(c.targetKcal, 50) <= 0.2 ? 1 : 0,
    errKcal: errK,
  };
}

const results: any[] = [];
console.log(`Running ${FOOD_CASES.length} cases × 4 configs (Gemini, GPT-OSS, GPT-OSS+RAW RAG, GPT-OSS+SMART RAG)\n`);

for (let i = 0; i < FOOD_CASES.length; i++) {
  const c = FOOD_CASES[i];
  const isBrand = hasBrandToken(c.input);
  process.stdout.write(`[${i+1}/${FOOD_CASES.length}]${isBrand ? "🏷️" : "  "} ${c.input.substring(0, 46).padEnd(46)} `);

  // RAG lookup
  let rag: string | null = null;
  try {
    rag = await getRagContext(c.input, 3);
    if (!rag || rag.trim() === "") rag = null;
  } catch (e) {
    process.stdout.write(`[RAG!err] `);
  }
  const smartRag: string | null = (isBrand && rag && isRagTrustworthy(rag, c.input)) ? rag : null;

  let gem: any = null, oss: any = null, ossRaw: any = null, ossSmart: any = null;
  try { gem = await callGemini(buildPrompt(c.input, null)); } catch (e: any) { process.stdout.write(`[G!err] `); }
  try { oss = await callOllama(buildPrompt(c.input, null)); } catch (e: any) { process.stdout.write(`[O!err] `); }
  try { ossRaw = await callOllama(buildPrompt(c.input, rag)); } catch (e: any) { process.stdout.write(`[OR!err] `); }
  try { ossSmart = await callOllama(buildPrompt(c.input, smartRag)); } catch (e: any) { process.stdout.write(`[OS!err] `); }

  const gs = scoreCase(gem, c);
  const os = scoreCase(oss, c);
  const ors = scoreCase(ossRaw, c);
  const oss_ = scoreCase(ossSmart, c);
  const ragLabel = smartRag ? "SMART✓" : (rag ? "raw" : "no-rag");
  console.log(`G:${gs.all ? "✓" : "✗"}  O:${os.all ? "✓" : "✗"}  OR:${ors.all ? "✓" : "✗"}  OS:${oss_.all ? "✓" : "✗"} [${ragLabel}]`);
  results.push({
    idx: i, input: c.input, targetKcal: c.targetKcal, brand: isBrand,
    rag_hit: !!rag, smart_rag_used: !!smartRag,
    gemini: { pred: gem, score: gs },
    ollama: { pred: oss, score: os },
    ollama_raw_rag: { pred: ossRaw, score: ors },
    ollama_smart_rag: { pred: ossSmart, score: oss_ },
  });
}

// ── Aggregate ──
const n = results.length;
const agg = (m: string, k: string) => results.reduce((a, r) => a + r[m].score[k], 0);
const avg = (m: string, k: string) => results.reduce((a, r) => a + r[m].score[k], 0) / n;

const pct = (x: number) => (x / n * 100).toFixed(0).padStart(2) + "%";
console.log("\n\n═════ SMART RAG EXPERIMENT — Flexen 25-Case Hardset ═════");
console.log(`                            Gemini   GPT-OSS   +Raw-RAG  +Smart-RAG`);
console.log(`all-4-macros-in-band:        ${pct(agg("gemini","all"))}     ${pct(agg("ollama","all"))}       ${pct(agg("ollama_raw_rag","all"))}       ${pct(agg("ollama_smart_rag","all"))}`);
console.log(`kcal-in-tolerance:           ${pct(agg("gemini","kcal"))}     ${pct(agg("ollama","kcal"))}       ${pct(agg("ollama_raw_rag","kcal"))}       ${pct(agg("ollama_smart_rag","kcal"))}`);
console.log(`kcal Acc@±20%:               ${pct(agg("gemini","kcal_acc20"))}     ${pct(agg("ollama","kcal_acc20"))}       ${pct(agg("ollama_raw_rag","kcal_acc20"))}       ${pct(agg("ollama_smart_rag","kcal_acc20"))}`);
console.log(`MAE kcal:                    ${avg("gemini","errKcal").toFixed(0).padStart(3)}      ${avg("ollama","errKcal").toFixed(0).padStart(3)}        ${avg("ollama_raw_rag","errKcal").toFixed(0).padStart(3)}        ${avg("ollama_smart_rag","errKcal").toFixed(0).padStart(3)}`);

const smartUsed = results.filter(r => r.smart_rag_used).length;
const brandCases = results.filter(r => r.brand).length;
console.log(`\nBrand queries detected: ${brandCases}/${n}`);
console.log(`Smart RAG activated:    ${smartUsed}/${n} (only when brand detected + FatSecret returned matching brand)`);

console.log("\n─── Per-case breakdown: brand queries only ───");
const brandQueries = results.filter(r => r.brand);
console.log("                                          Gemini  GPT-OSS  +Raw  +Smart");
for (const r of brandQueries) {
  console.log(`${r.input.substring(0, 42).padEnd(42)}  ${r.gemini.score.all ? "✓" : "✗"}      ${r.ollama.score.all ? "✓" : "✗"}       ${r.ollama_raw_rag.score.all ? "✓" : "✗"}    ${r.ollama_smart_rag.score.all ? "✓" : "✗"}`);
}

console.log("\n─── Changes from baseline (no-RAG) to Smart-RAG ───");
const improved = results.filter(r => r.ollama_smart_rag.score.all > r.ollama.score.all);
const worsened = results.filter(r => r.ollama_smart_rag.score.all < r.ollama.score.all);
console.log(`Improved by Smart RAG: ${improved.length}`);
improved.forEach(r => console.log(`  ✓ ${r.input}`));
console.log(`Worsened by Smart RAG: ${worsened.length}`);
worsened.forEach(r => console.log(`  ✗ ${r.input}`));

fs.writeFileSync("gpt_oss_smart_rag_results.json", JSON.stringify(results, null, 2));
console.log("\nSaved: gpt_oss_smart_rag_results.json");
