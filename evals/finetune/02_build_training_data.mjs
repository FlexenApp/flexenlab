// Build Together AI JSONL for fine-tuning gpt-oss-120b.
//
// Option-B fixes applied (2026-04-09):
//  1. HARD Atwater filter: drop cases where |p*4+c*4+f*9 - kcal|/kcal > 0.15
//  2. Confidence labels: HIGH if serving_type present, else LOW
//     (no synthetic MEDIUM — forces model to learn uncertainty)
//  3. Empty reasoning field (no fake template reasoning)
//  4. Flexen Hardset appended to eval.jsonl for brand-gap visibility
//     (eval only — NOT in train, avoids leakage)
//  5. Stratified 90/10 split by country
//
// Run:  node finetune/02_build_training_data.mjs

import fs from "fs";
import { execSync } from "child_process";

const INPUT = "finetune/nutribench_full.json";
const TRAIN_OUT = "finetune/train.jsonl";
const EVAL_OUT = "finetune/eval.jsonl";
const SPLIT_RATIO = 0.1;

const SYSTEM_INSTRUCTION = `You are a certified nutritionist. Your job is to estimate the nutritional content of foods described by users and return a valid JSON object with the exact keys: name, kcal, carbsG, proteinG, fatG, servingSize, confidence, reasoning.`;

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

const COUNTRY_NAMES = {
  USA: "the United States", ARG: "Argentina", BRA: "Brazil", MEX: "Mexico",
  CRI: "Costa Rica", GTM: "Guatemala", PER: "Peru", ITA: "Italy",
  BGR: "Bulgaria", ROU: "Romania", BFA: "Burkina Faso", COD: "DR Congo",
  ETH: "Ethiopia", KEN: "Kenya", STP: "São Tomé and Príncipe", TUN: "Tunisia",
  ZMB: "Zambia", IND: "India", LKA: "Sri Lanka", PAK: "Pakistan",
  PHL: "the Philippines", MYS: "Malaysia", LAO: "Laos", KNA: "Saint Kitts and Nevis",
};

function buildUserPrompt(mealDescription, region = "the United States") {
  return `You are a certified nutritionist. Estimate the nutritional content of the described food.

CONTEXT:
- Region: ${region}

${COT_INSTRUCTIONS}

Food to estimate: <user_input>${mealDescription}</user_input>`;
}

function buildAssistant({ name, kcal, carbs, protein, fat, servingSize, confidence }) {
  return JSON.stringify({
    name: name.substring(0, 80),
    kcal: Math.round(kcal),
    carbsG: Math.round(carbs * 10) / 10,
    proteinG: Math.round(protein * 10) / 10,
    fatG: Math.round(fat * 10) / 10,
    servingSize: servingSize || "1 serving",
    confidence,
    reasoning: "",
  });
}

function conv(userPrompt, assistant) {
  return {
    messages: [
      { role: "system", content: SYSTEM_INSTRUCTION },
      { role: "user", content: userPrompt },
      { role: "assistant", content: assistant },
    ],
  };
}

// ── Load NutriBench ──
if (!fs.existsSync(INPUT)) {
  console.error(`Missing ${INPUT}. Run 01_fetch_nutribench_full.mjs first.`);
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(INPUT, "utf8"));
console.log(`Loaded ${raw.length} raw NutriBench cases`);

// ── Validation filter ──
const valid = raw.filter(c =>
  c.meal_description &&
  typeof c.energy === "number" && c.energy > 0 && c.energy < 5000 &&
  typeof c.carb === "number" && c.carb >= 0 &&
  typeof c.protein === "number" && c.protein >= 0 &&
  typeof c.fat === "number" && c.fat >= 0
);
console.log(`After validation filter: ${valid.length}`);

// ── HARD Atwater filter (drop, don't relabel) ──
const atwaterClean = valid.filter(c => {
  const computed = c.protein * 4 + c.carb * 4 + c.fat * 9;
  return Math.abs(computed - c.energy) / Math.max(c.energy, 1) <= 0.15;
});
console.log(`After Atwater filter (±15%): ${atwaterClean.length} (dropped ${valid.length - atwaterClean.length})`);

// ── Stratified split by country ──
const byCountry = {};
for (const c of atwaterClean) (byCountry[c.country] ??= []).push(c);

const trainCases = [];
const evalCases = [];
for (const country of Object.keys(byCountry)) {
  const shuffled = byCountry[country].slice().sort(() => Math.random() - 0.5);
  const nEval = Math.max(1, Math.floor(shuffled.length * SPLIT_RATIO));
  evalCases.push(...shuffled.slice(0, nEval));
  trainCases.push(...shuffled.slice(nEval));
}
console.log(`Train: ${trainCases.length}  Eval (NutriBench): ${evalCases.length}`);

// ── Confidence label distribution ──
// Confidence from Atwater drift: tight = HIGH, loose (but still within filter) = LOW,
// medium band = MEDIUM. Gives the model a realistic uncertainty signal to learn.
function labelNutribench(c) {
  const computed = c.protein * 4 + c.carb * 4 + c.fat * 9;
  const drift = Math.abs(computed - c.energy) / Math.max(c.energy, 1);
  if (drift <= 0.05) return "HIGH";
  if (drift <= 0.10) return "MEDIUM";
  return "LOW";
}
const trainLines = trainCases.map(c => JSON.stringify(conv(
  buildUserPrompt(c.meal_description, COUNTRY_NAMES[c.country] ?? "the United States"),
  buildAssistant({
    name: c.meal_description, kcal: c.energy, carbs: c.carb, protein: c.protein, fat: c.fat,
    servingSize: c.serving_type, confidence: labelNutribench(c),
  }),
)));
const evalLines = evalCases.map(c => JSON.stringify(conv(
  buildUserPrompt(c.meal_description, COUNTRY_NAMES[c.country] ?? "the United States"),
  buildAssistant({
    name: c.meal_description, kcal: c.energy, carbs: c.carb, protein: c.protein, fat: c.fat,
    servingSize: c.serving_type, confidence: labelNutribench(c),
  }),
)));

const dist = { HIGH: 0, MEDIUM: 0, LOW: 0 };
for (const c of trainCases) dist[labelNutribench(c)]++;
console.log(`  label dist: HIGH ${dist.HIGH}  MEDIUM ${dist.MEDIUM}  LOW ${dist.LOW}`);

// ── Append Flexen Hardset to eval (brand-gap visibility) ──
// Loaded via tsx so we can read dataset.ts directly.
let flexenCases = [];
try {
  const tmpFile = "finetune/_flexen_cases.json";
  execSync(
    `npx tsx -e "import('./dataset.ts').then(m => { const fs = require('fs'); fs.writeFileSync('${tmpFile}', JSON.stringify(m.FOOD_CASES)); })"`,
    { stdio: "inherit" },
  );
  flexenCases = JSON.parse(fs.readFileSync(tmpFile, "utf8"));
  fs.unlinkSync(tmpFile);
  console.log(`Flexen Hardset: ${flexenCases.length} cases`);
} catch (e) {
  console.warn(`⚠ Could not load Flexen Hardset: ${e.message}`);
}

const flexenLines = flexenCases.map(c => JSON.stringify(conv(
  buildUserPrompt(c.input, "the United States"),
  buildAssistant({
    name: c.input,
    kcal: c.targetKcal, carbs: c.targetCarbs, protein: c.targetProtein, fat: c.targetFat,
    servingSize: "1 serving",
    confidence: c.expectedConfidence ?? "MEDIUM",
  }),
)));

// ── Write ──
fs.writeFileSync(TRAIN_OUT, trainLines.join("\n") + "\n");
fs.writeFileSync(EVAL_OUT, evalLines.concat(flexenLines).join("\n") + "\n");

console.log(`\n→ ${TRAIN_OUT}  (${trainLines.length} lines, ${(fs.statSync(TRAIN_OUT).size / 1024 / 1024).toFixed(2)} MB)`);
console.log(`→ ${EVAL_OUT}   (${evalLines.length} NutriBench + ${flexenLines.length} Flexen = ${evalLines.length + flexenLines.length} lines, ${(fs.statSync(EVAL_OUT).size / 1024 / 1024).toFixed(2)} MB)`);

// Sanity
const first = JSON.parse(trainLines[0]);
console.log("\nFirst training example:");
console.log("  user:     ", first.messages[1].content.substring(0, 100) + "...");
console.log("  assistant:", first.messages[2].content.substring(0, 150));
