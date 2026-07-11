// Compare Gemini 3 Flash Preview vs GPT-OSS 120B on the Flexen hand-curated
// 25-case hard dataset (dataset.ts -> FOOD_CASES). Brand-heavy, US-focused,
// ground truth from Starbucks/Chipotle/USDA published pages.
//
// Side-by-side scoring so you can see which cases each model wins/loses.
import fs from "fs";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

// Load keys
const KEYS = fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8")
  .split("\n").filter(Boolean).reduce((a, l) => { const [k, ...v] = l.split("="); a[k] = v.join("="); return a; }, {});

// Load FOOD_CASES — we can't import .ts from .mjs directly, so use tsx to compile inline
const { FOOD_CASES } = await import("./dataset.ts");
console.log(`Loaded ${FOOD_CASES.length} cases from dataset.ts`);

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

Return ONLY a JSON object with these exact keys:
  name (string), kcal (number), carbsG (number), proteinG (number),
  fatG (number), servingSize (string), confidence ("HIGH"|"MEDIUM"|"LOW"),
  reasoning (string).`;

function buildPrompt(input) {
  return `You are a certified nutritionist. Estimate the nutritional content of the described food.

CONTEXT:
- Region: United States

${COT_INSTRUCTIONS}

Food to estimate: <user_input>${input}</user_input>`;
}

// ── Clients ──
const google = new GoogleGenAI({ apiKey: KEYS.GEMINI_API_KEY });
const ollama = new OpenAI({ apiKey: KEYS.OLLAMA_API_KEY, baseURL: "https://ollama.com/v1", timeout: 300_000 });

function extractJson(txt) {
  if (!txt) return null;
  let t = String(txt).replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.substring(first, last + 1);
  try { return JSON.parse(t); } catch { return null; }
}

async function callGemini(prompt) {
  const res = await google.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
    },
  });
  return extractJson(res.text ?? "{}");
}

async function callOllama(prompt) {
  const res = await ollama.chat.completions.create({
    model: "gpt-oss:120b",
    temperature: 0.1,
    max_tokens: 4096,
    messages: [
      { role: "system", content: "Respond with a single valid JSON object only. No prose outside the JSON." },
      { role: "user", content: prompt },
    ],
  });
  const msg = res.choices[0]?.message ?? {};
  const txt = (msg.content && msg.content.trim()) ? msg.content : (msg.reasoning ?? "{}");
  return extractJson(txt);
}

function inBand(actual, target, tol) {
  if (!Number.isFinite(actual)) return false;
  return Math.abs(actual - target) / Math.max(target, 1) <= tol;
}

function scoreCase(pred, c) {
  if (!pred) return { kcal: 0, protein: 0, carbs: 0, fat: 0, all: 0, kcal_acc20: false };
  const kcalOk = inBand(pred.kcal, c.targetKcal, c.tolKcal);
  const pOk = inBand(pred.proteinG, c.targetProtein, c.tolProtein);
  const cOk = inBand(pred.carbsG, c.targetCarbs, c.tolCarbs);
  const fOk = inBand(pred.fatG, c.targetFat, c.tolFat);
  return {
    kcal: kcalOk ? 1 : 0,
    protein: pOk ? 1 : 0,
    carbs: cOk ? 1 : 0,
    fat: fOk ? 1 : 0,
    all: (kcalOk && pOk && cOk && fOk) ? 1 : 0,
    kcal_acc20: Math.abs((pred.kcal ?? 0) - c.targetKcal) / Math.max(c.targetKcal, 50) <= 0.2,
    errKcal: Math.abs((pred.kcal ?? 0) - c.targetKcal),
  };
}

const results = [];
for (let i = 0; i < FOOD_CASES.length; i++) {
  const c = FOOD_CASES[i];
  process.stdout.write(`[${i+1}/${FOOD_CASES.length}] ${c.input.substring(0, 50).padEnd(50)} `);
  let geminiRes = null, ollamaRes = null;
  try { geminiRes = await callGemini(buildPrompt(c.input)); }
  catch (e) { process.stdout.write(`[G!err:${String(e.message||e).substring(0,60)}] `); }
  try { ollamaRes = await callOllama(buildPrompt(c.input)); }
  catch (e) { process.stdout.write(`[O!err:${String(e.message||e).substring(0,30)}] `); }

  const gScore = scoreCase(geminiRes, c);
  const oScore = scoreCase(ollamaRes, c);
  console.log(`G:${gScore.all ? "✓" : "✗"}(${geminiRes?.kcal ?? "?"}/${c.targetKcal})  O:${oScore.all ? "✓" : "✗"}(${ollamaRes?.kcal ?? "?"}/${c.targetKcal})`);
  results.push({
    idx: i, input: c.input, targetKcal: c.targetKcal,
    gemini: { pred: geminiRes, score: gScore },
    ollama: { pred: ollamaRes, score: oScore },
  });
}

// ── Aggregate ──
const n = results.length;
const sum = (key) => (model) => results.reduce((a, r) => a + r[model].score[key], 0);
const gAll = sum("all")("gemini"), oAll = sum("all")("ollama");
const gKcal = sum("kcal")("gemini"), oKcal = sum("kcal")("ollama");
const gKcalAcc20 = results.filter(r => r.gemini.score.kcal_acc20).length;
const oKcalAcc20 = results.filter(r => r.ollama.score.kcal_acc20).length;
const gMaeKcal = results.reduce((a, r) => a + r.gemini.score.errKcal, 0) / n;
const oMaeKcal = results.reduce((a, r) => a + r.ollama.score.errKcal, 0) / n;

console.log("\n\n═══════════════ FLEXEN 25-CASE HARD SET RESULTS ═══════════════");
console.log(`                           Gemini 3 Flash    GPT-OSS 120B`);
console.log(`all-4-macros-in-band:      ${gAll}/${n} (${(gAll/n*100).toFixed(0)}%)${" ".repeat(9)}${oAll}/${n} (${(oAll/n*100).toFixed(0)}%)`);
console.log(`kcal-in-tolerance:         ${gKcal}/${n} (${(gKcal/n*100).toFixed(0)}%)${" ".repeat(9)}${oKcal}/${n} (${(oKcal/n*100).toFixed(0)}%)`);
console.log(`kcal Acc@±20%:             ${gKcalAcc20}/${n} (${(gKcalAcc20/n*100).toFixed(0)}%)${" ".repeat(9)}${oKcalAcc20}/${n} (${(oKcalAcc20/n*100).toFixed(0)}%)`);
console.log(`MAE kcal:                  ${gMaeKcal.toFixed(1)}${" ".repeat(15)}${oMaeKcal.toFixed(1)}`);

console.log(`\n─── Wins (who's better on which case) ───`);
const gWins = results.filter(r => r.gemini.score.all > r.ollama.score.all);
const oWins = results.filter(r => r.ollama.score.all > r.gemini.score.all);
const ties = results.filter(r => r.gemini.score.all === r.ollama.score.all);
console.log(`Gemini wins: ${gWins.length}, GPT-OSS wins: ${oWins.length}, Ties: ${ties.length}`);
if (gWins.length) console.log("\n  Gemini-only wins:"); gWins.forEach(r => console.log(`    • ${r.input}`));
if (oWins.length) console.log("\n  GPT-OSS-only wins:"); oWins.forEach(r => console.log(`    • ${r.input}`));

fs.writeFileSync("flexen_hardset_results.json", JSON.stringify(results, null, 2));
console.log("\nSaved: flexen_hardset_results.json");
