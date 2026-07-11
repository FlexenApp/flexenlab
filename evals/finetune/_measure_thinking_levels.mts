// Measure token usage + quality for each thinking_level on Lite
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

for (const line of fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2];
}
const google = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const LITE = "gemini-3.1-flash-lite-preview";

const CF_SRC = fs.readFileSync("C:/Users/Leonard/Documents/Business/Flexen/flexenapp/functions/index.js", "utf8");
const mSys = CF_SRC.match(/const FOOD_SYSTEM_INSTRUCTION = `([\s\S]*?)`;/);
if (!mSys) throw new Error("Could not extract prompt");
const SYSTEM = mSys[1];
const KEYS = `\nReturn JSON with EXACTLY these keys: name, kcal, carbsG, proteinG, fatG, servingSize, confidence, reasoning.`;

const queries = [
  { q: "medium banana", tgt: 105 },
  { q: "Wendy's Baconator", tgt: 920 },
  { q: "chicken tikka masala with basmati rice", tgt: 550 },
  { q: "2 tablespoons of peanut butter", tgt: 190 },
  { q: "a generous serving of chicken fried rice", tgt: 580 },
  { q: "shrimp pad thai from a restaurant", tgt: 480 },
  { q: "1 cup cooked black beans", tgt: 227 },
  { q: "leftover lasagna, about a quarter of the pan", tgt: 680 },
];

const levels = ["minimal", "low", "medium", "high"];
// Also test thinkingBudget=-1 for comparison
const configs: { name: string; config: any }[] = [
  ...levels.map(l => ({
    name: `level_${l}`,
    config: { thinkingConfig: { thinkingLevel: l } },
  })),
  { name: "budget_-1", config: { thinkingConfig: { thinkingBudget: -1 } } },
];

function extractJson(txt: string): any {
  if (!txt) return null;
  let t = String(txt).replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const f = t.indexOf("{"), l = t.lastIndexOf("}");
  if (f >= 0 && l > f) t = t.substring(f, l + 1);
  try { return JSON.parse(t); } catch { return null; }
}

console.log("config".padEnd(14) + " | " + "query".padEnd(50) + " | in    | out   | think | kcal  | tgt   | err%");
console.log("-".repeat(130));

const stats: Record<string, { think: number[]; errPct: number[]; cost: number[] }> = {};

for (const cfg of configs) {
  stats[cfg.name] = { think: [], errPct: [], cost: [] };
  for (const { q, tgt } of queries) {
    try {
      const prompt = `${SYSTEM}${KEYS}\n\nFood to estimate: <user_input>${q}</user_input>`;
      const res = await google.models.generateContent({
        model: LITE,
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          maxOutputTokens: 16384,
          ...cfg.config,
        },
      });
      const u = res.usageMetadata!;
      const think = u.thoughtsTokenCount ?? 0;
      const parsed = extractJson(res.text ?? "");
      const kcal = parsed?.kcal ?? NaN;
      const errPct = Math.abs(kcal - tgt) / tgt * 100;
      const cost = (0.25 * u.promptTokenCount! + 1.50 * (u.candidatesTokenCount! + think)) / 1e6;

      stats[cfg.name].think.push(think);
      stats[cfg.name].errPct.push(isNaN(errPct) ? 100 : errPct);
      stats[cfg.name].cost.push(cost);

      console.log(
        cfg.name.padEnd(14) + " | " +
        q.substring(0, 50).padEnd(50) + " | " +
        String(u.promptTokenCount).padStart(5) + " | " +
        String(u.candidatesTokenCount).padStart(5) + " | " +
        String(think).padStart(5) + " | " +
        String(Math.round(kcal)).padStart(5) + " | " +
        String(tgt).padStart(5) + " | " +
        (isNaN(errPct) ? "ERR" : errPct.toFixed(1) + "%")
      );
    } catch (e: any) {
      console.log(cfg.name.padEnd(14) + " | " + q.substring(0, 50).padEnd(50) + " | ERROR: " + String(e.message).substring(0, 60));
      stats[cfg.name].think.push(0);
      stats[cfg.name].errPct.push(100);
      stats[cfg.name].cost.push(0);
    }
  }
  console.log();
}

console.log("\n=== SUMMARY ===\n");
console.log("config".padEnd(14) + " | avg think | avg err% | avg $/call | total cost");
console.log("-".repeat(75));
for (const [name, s] of Object.entries(stats)) {
  const avgThink = s.think.reduce((a, b) => a + b, 0) / s.think.length;
  const avgErr = s.errPct.reduce((a, b) => a + b, 0) / s.errPct.length;
  const avgCost = s.cost.reduce((a, b) => a + b, 0) / s.cost.length;
  const totalCost = s.cost.reduce((a, b) => a + b, 0);
  console.log(
    name.padEnd(14) + " | " +
    avgThink.toFixed(0).padStart(9) + " | " +
    avgErr.toFixed(1).padStart(7) + "% | " +
    ("$" + avgCost.toFixed(5)).padStart(10) + " | " +
    ("$" + totalCost.toFixed(4)).padStart(10)
  );
}
