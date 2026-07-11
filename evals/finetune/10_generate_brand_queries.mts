// Generate diverse brand/restaurant food queries for distillation.
// Uses Gemini 3 Flash Preview to produce ~600 realistic US food-log queries
// across fast food, coffee, restaurants, grocery brands, and common generic foods.
//
// Output: finetune/brand_queries.json  (flat array of {query, category})

import fs from "fs";
import { GoogleGenAI } from "@google/genai";

for (const line of fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2];
}

const google = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CATEGORIES: { name: string; count: number; prompt: string }[] = [
  {
    name: "fast_food",
    count: 150,
    prompt: "US fast food chain items with specific sizes/modifiers. Chains: McDonald's, Burger King, Wendy's, Taco Bell, KFC, Chick-fil-A, Subway, Popeyes, Arby's, Five Guys, In-N-Out, Shake Shack, Whataburger, Jack in the Box, Carl's Jr, Dairy Queen, Sonic, Panda Express, Raising Cane's, Jersey Mike's.",
  },
  {
    name: "coffee",
    count: 100,
    prompt: "US coffee/drink chains with sizes and customizations (milk type, syrups, shots). Chains: Starbucks, Dunkin', Dutch Bros, Peet's, Tim Hortons, Philz, Blue Bottle. Include popular items: macchiato, cold brew, refresher, frappuccino, oat milk latte, iced shaken espresso.",
  },
  {
    name: "restaurant_chain",
    count: 120,
    prompt: "US casual/fast-casual restaurant chains with specific menu items. Chains: Chipotle, Sweetgreen, Cava, Chopt, Panera, Olive Garden, Applebee's, Cheesecake Factory, Texas Roadhouse, Red Lobster, Buffalo Wild Wings, Outback, Domino's, Pizza Hut, Papa John's, Little Caesars.",
  },
  {
    name: "grocery_brand",
    count: 100,
    prompt: "US grocery store branded products with specific portions. Brands: Trader Joe's, Whole Foods 365, Costco Kirkland, Ben & Jerry's, Haagen-Dazs, Oreo, Kind bars, Clif bar, RX Bar, Perfect Bar, Chobani, Fage, Siggi's, Beyond Meat, Impossible Foods, Silk, Oatly, Quaker.",
  },
  {
    name: "generic_common",
    count: 100,
    prompt: "Common generic foods with specific portions/counts/weights that US users type in food logs. Examples: '2 scrambled eggs', '150g chicken breast grilled', '1 cup oatmeal with banana', '6oz salmon baked'. Include varied portions, cooking methods, ambiguous phrasing.",
  },
  {
    name: "ethnic_us",
    count: 80,
    prompt: "Ethnic foods commonly eaten in the US with American-style portions. Mexican (burritos, tacos, enchiladas), Italian (pasta dishes, pizza slices), Asian (pad thai, pho, sushi rolls, bibimbap, ramen), Indian (curry, tikka masala, biryani), Mediterranean (hummus, falafel, gyro).",
  },
];

const SCHEMA = `Generate exactly {COUNT} realistic food-log queries. Each query is ONE line. No numbering. No explanations. Mix exact portions/weights with vague phrasings. Vary difficulty. Include modifiers when realistic (grilled vs fried, large vs small, with/without X).

Format: one query per line. {COUNT} lines total.`;

async function generate(cat: { name: string; count: number; prompt: string }): Promise<string[]> {
  console.log(`  generating ${cat.count} ${cat.name}...`);
  const res = await google.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${SCHEMA.replace(/\{COUNT\}/g, String(cat.count))}\n\nCategory: ${cat.prompt}`,
    config: {
      temperature: 0.9,
      maxOutputTokens: 8192,
    },
  });
  const text = res.text ?? "";
  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 3 && l.length < 200)
    .map(l => l.replace(/^[-•*\d.]+\s*/, "").replace(/^["']|["']$/g, "").trim())
    .filter(l => l.length > 3);
  console.log(`    → ${lines.length} lines`);
  return lines;
}

const all: { query: string; category: string }[] = [];
for (const cat of CATEGORIES) {
  try {
    const lines = await generate(cat);
    for (const q of lines) all.push({ query: q, category: cat.name });
  } catch (e: any) {
    console.error(`  ⚠ ${cat.name} failed: ${e.message}`);
  }
}

// Dedupe
const seen = new Set<string>();
const deduped = all.filter(x => {
  const k = x.query.toLowerCase().replace(/\s+/g, " ").trim();
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

console.log(`\nTotal: ${all.length}  after dedupe: ${deduped.length}`);
const byCat: Record<string, number> = {};
for (const x of deduped) byCat[x.category] = (byCat[x.category] ?? 0) + 1;
console.log("By category:", byCat);

fs.writeFileSync("finetune/brand_queries.json", JSON.stringify(deduped, null, 2));
console.log(`\n→ finetune/brand_queries.json (${deduped.length} queries)`);
