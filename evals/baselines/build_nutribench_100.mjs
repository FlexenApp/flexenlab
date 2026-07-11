// Build a 100-case balanced subset of nutribench_sample_balanced.json
import fs from "fs";
const full = JSON.parse(fs.readFileSync("nutribench_sample_balanced.json", "utf8"));
// Take every 5th item for stratified subset (500 → 100)
const sub = full.filter((_, i) => i % 5 === 0);
fs.writeFileSync("baselines/nutribench_100.json", JSON.stringify(sub, null, 2));
console.log(`Wrote ${sub.length} cases → baselines/nutribench_100.json`);
