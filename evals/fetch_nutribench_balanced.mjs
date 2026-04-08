// Pulls ~500 NutriBench v2 cases BALANCED across all countries.
// Strategy: stream the full 15617 rows, bucket by country, then random-sample
// N per country so no country dominates.
//
// Output: nutribench_sample_balanced.json

import fs from "fs";

const TOTAL = 15617;
const PAGE = 100;
const PER_COUNTRY = 25; // 24 countries × 25 = ~600, downsampled later

// Pass 1: fetch all rows, group by country
const byCountry = new Map();
for (let offset = 0; offset < TOTAL; offset += PAGE) {
  process.stdout.write(`page ${offset}/${TOTAL}\r`);
  const url = `https://datasets-server.huggingface.co/rows?dataset=dongx1997%2FNutriBench&config=v2&split=train&offset=${offset}&length=${PAGE}`;
  const r = await fetch(url);
  if (!r.ok) { console.log(`\npage ${offset} failed: ${r.status}`); continue; }
  const body = await r.json();
  for (const row of body.rows ?? []) {
    const c = row.row?.country;
    if (!c) continue;
    if (!byCountry.has(c)) byCountry.set(c, []);
    byCountry.get(c).push(row.row);
  }
}

console.log(`\nFetched all rows. Countries found:`);
const stats = [...byCountry.entries()].map(([c, rows]) => [c, rows.length]).sort((a, b) => b[1] - a[1]);
for (const [c, n] of stats) console.log(`  ${c}: ${n}`);

// Stratified sample: PER_COUNTRY random from each (or all if fewer available)
const sample = [];
for (const [, rows] of byCountry) {
  const shuffled = [...rows].sort(() => Math.random() - 0.5);
  sample.push(...shuffled.slice(0, PER_COUNTRY));
}

// Filter implausible rows
const filtered = sample.filter(r =>
  typeof r.energy === "number" &&
  r.energy >= 30 && r.energy <= 2500 &&
  typeof r.carb === "number" && typeof r.protein === "number" && typeof r.fat === "number"
);

// Cap at 500 if over
const final = filtered.length > 500 ? filtered.sort(() => Math.random() - 0.5).slice(0, 500) : filtered;

// Rename fields to match what nutribench.eval.ts expects (same structure as before)
const out = final.map(r => ({
  meal_description: r.meal_description,
  carb: r.carb,
  fat: r.fat,
  energy: r.energy,
  protein: r.protein,
  country: r.country,
  serving_type: r.serving_type,
}));

fs.writeFileSync("nutribench_sample_balanced.json", JSON.stringify(out, null, 2));

// Stats of final sample
const finalStats = {};
for (const r of out) finalStats[r.country] = (finalStats[r.country] || 0) + 1;
console.log(`\nFinal sample: ${out.length} cases across ${Object.keys(finalStats).length} countries`);
for (const [c, n] of Object.entries(finalStats).sort((a, b) => b[1] - a[1])) console.log(`  ${c}: ${n}`);
console.log(`\n→ nutribench_sample_balanced.json`);
