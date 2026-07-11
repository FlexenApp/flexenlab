import fs from "fs";
const full = JSON.parse(fs.readFileSync("nutribench_sample_balanced.json", "utf8"));
const sub = full.filter((_, i) => i % 10 === 0); // 500 → 50
fs.writeFileSync("baselines/nutribench_50.json", JSON.stringify(sub, null, 2));
console.log(`Wrote ${sub.length} cases`);
