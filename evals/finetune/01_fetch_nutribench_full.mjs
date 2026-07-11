// Fetches the FULL NutriBench v2 dataset (all ~11857 cases, all countries).
// Writes to finetune/nutribench_full.json for fine-tune training.
// Run once:  node finetune/01_fetch_nutribench_full.mjs

import fs from "fs";

const out = [];
const PAGE = 100;
const TOTAL = 11857;

for (let offset = 0; offset < TOTAL; offset += PAGE) {
  const url = `https://datasets-server.huggingface.co/rows?dataset=dongx1997%2FNutriBench&config=v2&split=train&offset=${offset}&length=${PAGE}`;
  process.stdout.write(`offset=${offset} have=${out.length}/${TOTAL}\r`);
  const r = await fetch(url);
  if (!r.ok) {
    console.log(`\nFailed at offset=${offset}: ${r.status}`);
    break;
  }
  const body = await r.json();
  for (const row of body.rows ?? []) {
    if (row.row) out.push(row.row);
  }
}
console.log(`\nCollected ${out.length} total cases.`);

// Country distribution
const byCountry = {};
for (const c of out) byCountry[c.country] = (byCountry[c.country] || 0) + 1;
console.log("Country distribution:");
Object.entries(byCountry).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

fs.mkdirSync("finetune", { recursive: true });
fs.writeFileSync("finetune/nutribench_full.json", JSON.stringify(out, null, 2));
console.log("→ finetune/nutribench_full.json");
