// E12: Long multi-meal queries test.
//
// Our main dataset has 25 short queries. Real users often describe whole
// days in one message ("breakfast was X, lunch was Y, dinner was Z").
// This test measures how Gemini 3 Flash handles long compound queries —
// does it sum all components or drop some?
//
// Self-contained — does not touch food_text.eval.ts.
// Run: npx tsx e12_long_queries_test.ts

import "dotenv/config";
import { GoogleGenAI, Type } from "@google/genai";

const MODEL = "gemini-3-flash-preview";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ── 10 synthetic long queries with known component breakdowns ──
// Targets are sums of USDA-anchored components.
const CASES: Array<{
  query: string;
  targetKcal: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  components: string;
}> = [
  {
    query: "Today for breakfast I had two scrambled eggs with butter and a slice of whole wheat toast with jam",
    targetKcal: 350, targetProtein: 16, targetCarbs: 28, targetFat: 18,
    components: "2 eggs (144/12/1/10) + 1 tbsp butter (102/0/0/11) + 1 slice wheat bread (69/4/12/1) + 1 tbsp jam (40/0/13/0)",
  },
  {
    query: "For lunch I had a grilled chicken salad with 150g chicken breast, mixed greens, half an avocado, cherry tomatoes, and 2 tbsp olive oil dressing",
    targetKcal: 620, targetProtein: 50, targetCarbs: 12, targetFat: 42,
    components: "150g chicken (248/46/0/5) + greens 80g (15/2/3/0) + 0.5 avocado (114/1/6/10) + tomatoes 80g (15/1/3/0) + 2 tbsp oil (238/0/0/27)",
  },
  {
    query: "My dinner was 200g salmon baked, 1 cup cooked brown rice, and a cup of steamed broccoli with butter",
    targetKcal: 690, targetProtein: 49, targetCarbs: 48, targetFat: 32,
    components: "200g salmon (412/46/0/25) + 1 cup brown rice (216/5/45/2) + 1 cup broccoli (55/4/11/0.5) + 1 tsp butter (34/0/0/4)",
  },
  {
    query: "Breakfast: bowl of oatmeal made with milk, topped with banana and honey. Lunch: turkey sandwich with cheese and mayo. Snack: an apple.",
    targetKcal: 1050, targetProtein: 45, targetCarbs: 145, targetFat: 34,
    components: "oatmeal+milk+banana+honey (420/12/75/9) + turkey sandwich (520/32/50/22) + 1 apple (95/0.5/25/0.3)",
  },
  {
    query: "I ate a McDonald's Big Mac meal with medium fries and a medium Coke, plus I added a McChicken on the side",
    targetKcal: 1570, targetProtein: 45, targetCarbs: 190, targetFat: 64,
    components: "Big Mac meal (1120/29/146/48) + McChicken (400/14/40/21)",
  },
  {
    query: "Two slices of pepperoni pizza, a garlic knot, and a Caesar salad on the side with dressing",
    targetKcal: 1020, targetProtein: 36, targetCarbs: 110, targetFat: 48,
    components: "2 slices pepperoni pizza (600/24/70/22) + garlic knot (130/4/20/4) + Caesar with dressing (290/8/20/22)",
  },
  {
    query: "Protein shake with whey, a banana, a handful of almonds, and a scoop of peanut butter for a post-workout meal",
    targetKcal: 560, targetProtein: 37, targetCarbs: 35, targetFat: 28,
    components: "whey scoop (120/24/3/1) + banana (105/1/27/0) + 1oz almonds (165/6/6/14) + 1 tbsp PB (95/4/3/8)",
  },
  {
    query: "For dinner I had a full Chipotle burrito bowl with chicken, white rice, pinto beans, mild salsa, cheese, and sour cream",
    targetKcal: 810, targetProtein: 48, targetCarbs: 85, targetFat: 30,
    components: "chicken (180/32/0/7) + white rice (210/4/40/4) + pinto beans (130/8/22/2) + salsa (25/1/5/0) + cheese (110/6/1/9) + sour cream (110/2/2/10)",
  },
  {
    query: "Breakfast was a bagel with cream cheese and smoked salmon, plus orange juice",
    targetKcal: 550, targetProtein: 24, targetCarbs: 72, targetFat: 18,
    components: "bagel (260/10/48/2) + cream cheese 2 tbsp (100/2/1/10) + lox 30g (35/6/0/1) + 1 cup OJ (110/2/26/0.5)",
  },
  {
    query: "Dinner: pan-fried ribeye steak about 250g, baked potato with butter and sour cream, side of asparagus",
    targetKcal: 950, targetProtein: 68, targetCarbs: 45, targetFat: 55,
    components: "250g ribeye (680/60/0/50) + baked potato (161/4/37/0.2) + 1 tbsp butter (102/0/0/11) + 2 tbsp sour cream (50/1/1/5) + asparagus (20/2/4/0)",
  },
];

const schema = {
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

async function estimate(query: string) {
  const prompt = `You are a certified nutritionist. Estimate the TOTAL nutritional content for this meal description. If multiple foods are listed, SUM their contributions into one combined total. Region: United States.

Food to estimate: "${query}"

Return JSON.`;
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { temperature: 0.1, responseMimeType: "application/json", responseSchema: schema },
  });
  return JSON.parse(res.text ?? "{}");
}

async function main() {
  console.log(`E12: Long Multi-Meal Query Test\n${"=".repeat(60)}`);
  console.log(`${CASES.length} compound queries with known component sums\n`);

  const results: Array<{ case: (typeof CASES)[number]; out: any; pctErr: number }> = [];
  let totalKcalErr = 0;
  let totalProteinErr = 0;
  let withinTol = 0;

  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    process.stdout.write(`[${i + 1}/${CASES.length}] ${c.query.slice(0, 60)}... `);
    const out = await estimate(c.query);
    const kcalErr = Math.abs(out.kcal - c.targetKcal);
    const kcalPctErr = kcalErr / c.targetKcal;
    const proteinErr = Math.abs(out.proteinG - c.targetProtein);
    totalKcalErr += kcalErr;
    totalProteinErr += proteinErr;
    if (kcalPctErr <= 0.2) withinTol++;
    results.push({ case: c, out, pctErr: kcalPctErr });
    console.log(`target=${c.targetKcal} got=${out.kcal} err=${(kcalPctErr * 100).toFixed(0)}%`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));
  console.log(`Cases within ±20% kcal:  ${withinTol}/${CASES.length} (${((withinTol / CASES.length) * 100).toFixed(0)}%)`);
  console.log(`Avg MAE kcal:            ${(totalKcalErr / CASES.length).toFixed(0)} kcal`);
  console.log(`Avg MAE protein:         ${(totalProteinErr / CASES.length).toFixed(1)} g`);

  // Reference: our 25-case short-query dataset got ~81% kcal Acc@±20% on NutriBench USA
  console.log(`\nComparison to short-query baseline (~92% macro_aggregate on curated):`);
  console.log(`  Long-query kcal Acc@±20%: ${((withinTol / CASES.length) * 100).toFixed(0)}%`);
  console.log(`  → Delta: ${(((withinTol / CASES.length) - 0.81) * 100).toFixed(0)} pts vs NutriBench USA baseline`);

  // Identify the worst cases
  console.log("\nWorst 3 cases (largest kcal error):");
  const sorted = [...results].sort((a, b) => b.pctErr - a.pctErr);
  for (const r of sorted.slice(0, 3)) {
    console.log(`  [${(r.pctErr * 100).toFixed(0)}% off] target=${r.case.targetKcal} got=${r.out.kcal}`);
    console.log(`    query: "${r.case.query.slice(0, 80)}"`);
    console.log(`    components: ${r.case.components}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
