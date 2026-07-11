// Test if FatSecret RAG lookup fixes GPT-OSS 120B's brand-portion weakness.
// Runs ALL 25 Flexen hardset cases with 3 configs:
//   A) GPT-OSS 120B (baseline, no RAG)
//   B) GPT-OSS 120B + FatSecret RAG (top-3 context)
//   C) Gemini 3 Flash Preview (reference)
// Outputs side-by-side comparison.

import fs from "fs";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { FOOD_CASES } from "./dataset.js";
import { getRagContext } from "./fatsecret.js";

// env
for (const line of fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2];
}

const google = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const ollama = new OpenAI({ apiKey: process.env.OLLAMA_API_KEY!, baseURL: "https://ollama.com/v1", timeout: 300_000 });

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
  const ragBlock = rag ? `\n\nDATABASE MATCHES (use these exact per-100g values if the food matches):\n${rag}\n` : "";
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
console.log(`Running ${FOOD_CASES.length} cases × 3 configs (Gemini, GPT-OSS, GPT-OSS+RAG)\n`);

for (let i = 0; i < FOOD_CASES.length; i++) {
  const c = FOOD_CASES[i];
  process.stdout.write(`[${i+1}/${FOOD_CASES.length}] ${c.input.substring(0, 48).padEnd(48)} `);

  // 1. RAG lookup first
  let rag: string | null = null;
  try {
    rag = await getRagContext(c.input, 3);
    if (!rag || rag.trim() === "") rag = null;
  } catch (e) {
    process.stdout.write(`[RAG!err] `);
  }

  // 2. Call Gemini (no RAG — it's our reference, keep it identical to earlier test)
  let gem: any = null;
  try { gem = await callGemini(buildPrompt(c.input, null)); }
  catch (e: any) { process.stdout.write(`[G!err:${String(e.message||e).substring(0,30)}] `); }

  // 3. Call GPT-OSS without RAG
  let oss: any = null;
  try { oss = await callOllama(buildPrompt(c.input, null)); }
  catch (e: any) { process.stdout.write(`[O!err:${String(e.message||e).substring(0,30)}] `); }

  // 4. Call GPT-OSS WITH RAG
  let ossRag: any = null;
  try { ossRag = await callOllama(buildPrompt(c.input, rag)); }
  catch (e: any) { process.stdout.write(`[OR!err:${String(e.message||e).substring(0,30)}] `); }

  const gs = scoreCase(gem, c);
  const os = scoreCase(oss, c);
  const ors = scoreCase(ossRag, c);
  console.log(`G:${gs.all ? "✓" : "✗"}(${gem?.kcal ?? "?"})  O:${os.all ? "✓" : "✗"}(${oss?.kcal ?? "?"})  OR:${ors.all ? "✓" : "✗"}(${ossRag?.kcal ?? "?"}) /${c.targetKcal}${rag ? "" : "  [no-rag]"}`);
  results.push({
    idx: i, input: c.input, targetKcal: c.targetKcal,
    rag_hit: !!rag,
    rag_preview: rag ? rag.substring(0, 200) : null,
    gemini: { pred: gem, score: gs },
    ollama: { pred: oss, score: os },
    ollama_rag: { pred: ossRag, score: ors },
  });
}

// ── Aggregate ──
const n = results.length;
const agg = (m: string, k: string) => results.reduce((a, r) => a + r[m].score[k], 0);
const avg = (m: string, k: string) => results.reduce((a, r) => a + r[m].score[k], 0) / n;

console.log("\n\n═══════ GPT-OSS RAG EXPERIMENT — Flexen 25-Case Hardset ═══════");
console.log(`                           Gemini 3 Flash    GPT-OSS (no RAG)   GPT-OSS + RAG`);
console.log(`all-4-macros-in-band:      ${agg("gemini","all")}/${n} (${(agg("gemini","all")/n*100).toFixed(0)}%)${" ".repeat(10)}${agg("ollama","all")}/${n} (${(agg("ollama","all")/n*100).toFixed(0)}%)${" ".repeat(12)}${agg("ollama_rag","all")}/${n} (${(agg("ollama_rag","all")/n*100).toFixed(0)}%)`);
console.log(`kcal-in-tolerance:         ${agg("gemini","kcal")}/${n} (${(agg("gemini","kcal")/n*100).toFixed(0)}%)${" ".repeat(10)}${agg("ollama","kcal")}/${n} (${(agg("ollama","kcal")/n*100).toFixed(0)}%)${" ".repeat(12)}${agg("ollama_rag","kcal")}/${n} (${(agg("ollama_rag","kcal")/n*100).toFixed(0)}%)`);
console.log(`kcal Acc@±20%:             ${agg("gemini","kcal_acc20")}/${n} (${(agg("gemini","kcal_acc20")/n*100).toFixed(0)}%)${" ".repeat(10)}${agg("ollama","kcal_acc20")}/${n} (${(agg("ollama","kcal_acc20")/n*100).toFixed(0)}%)${" ".repeat(12)}${agg("ollama_rag","kcal_acc20")}/${n} (${(agg("ollama_rag","kcal_acc20")/n*100).toFixed(0)}%)`);
console.log(`MAE kcal:                  ${avg("gemini","errKcal").toFixed(1)}${" ".repeat(16)}${avg("ollama","errKcal").toFixed(1)}${" ".repeat(17)}${avg("ollama_rag","errKcal").toFixed(1)}`);

const ragHits = results.filter(r => r.rag_hit).length;
console.log(`\nRAG hits (FatSecret returned data): ${ragHits}/${n}`);

// Delta analysis
console.log("\n─── Cases where RAG changed the outcome ───");
const improved = results.filter(r => r.ollama_rag.score.all > r.ollama.score.all);
const worsened = results.filter(r => r.ollama_rag.score.all < r.ollama.score.all);
const unchanged = results.filter(r => r.ollama_rag.score.all === r.ollama.score.all);
console.log(`Improved by RAG: ${improved.length}, Worsened: ${worsened.length}, Unchanged: ${unchanged.length}`);
if (improved.length) {
  console.log("\n  RAG HELPED:");
  improved.forEach(r => console.log(`    • ${r.input}`));
}
if (worsened.length) {
  console.log("\n  RAG HURT:");
  worsened.forEach(r => console.log(`    • ${r.input}`));
}

fs.writeFileSync("gpt_oss_rag_results.json", JSON.stringify(results, null, 2));
console.log("\nSaved: gpt_oss_rag_results.json");
