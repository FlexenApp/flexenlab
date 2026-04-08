// Pulls 500 NutriBench v2 cases stratified across countries via random offsets.
// Run once → writes nutribench_sample_500.json.

import fs from "fs";

const TOTAL_DATASET = 15617; // v2 size
const TARGET = 500;
const PAGE = 50;

const seen = new Set();
const out = [];

// Random non-overlapping offsets
const offsets = new Set();
while (offsets.size < Math.ceil(TARGET / PAGE) * 2) {
  offsets.add(Math.floor(Math.random() * (TOTAL_DATASET - PAGE)));
}

for (const off of offsets) {
  if (out.length >= TARGET) break;
  process.stdout.write(`offset=${off} have=${out.length}/${TARGET}\r`);
  const url = `https://datasets-server.huggingface.co/rows?dataset=dongx1997%2FNutriBench&config=v2&split=train&offset=${off}&length=${PAGE}`;
  const r = await fetch(url);
  if (!r.ok) continue;
  const body = await r.json();
  for (const row of body.rows ?? []) {
    if (out.length >= TARGET) break;
    const desc = row.row?.meal_description;
    if (!desc || seen.has(desc)) continue;
    seen.add(desc);
    out.push(row.row);
  }
}

// Country stats
const byCountry = {};
for (const r of out) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
const sorted = Object.entries(byCountry).sort((a, b) => b[1] - a[1]);

console.log(`\nCollected ${out.length} cases across ${sorted.length} countries:`);
for (const [c, n] of sorted) console.log(`  ${c}: ${n}`);

fs.writeFileSync("nutribench_sample_500.json", JSON.stringify(out, null, 2));
console.log("→ nutribench_sample_500.json");
