// Fetches a sample of NutriBench v2 USA cases via the HuggingFace datasets server.
// Writes to nutribench_sample.json. Run once.

import fs from "fs";

const TARGET_USA = 100;
const PAGE = 100;
const out = [];

// Iterate pages until we have enough USA cases (or run out of dataset).
for (let offset = 0; offset < 15617 && out.length < TARGET_USA; offset += PAGE) {
  const url = `https://datasets-server.huggingface.co/rows?dataset=dongx1997%2FNutriBench&config=v2&split=train&offset=${offset}&length=${PAGE}`;
  process.stdout.write(`offset=${offset} have=${out.length}/${TARGET_USA}\r`);
  const r = await fetch(url);
  if (!r.ok) {
    console.log(`\nfailed at offset=${offset}: ${r.status}`);
    break;
  }
  const body = await r.json();
  for (const row of body.rows ?? []) {
    if (row.row?.country === "USA") out.push(row.row);
    if (out.length >= TARGET_USA) break;
  }
}

console.log(`\nCollected ${out.length} USA cases.`);
fs.writeFileSync("nutribench_sample.json", JSON.stringify(out, null, 2));
console.log("→ nutribench_sample.json");
