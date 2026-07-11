// 3-seed benchmark runner: runs bench_router.mts 3 times, reports mean ± std.
// Usage: NB_N=100 npx tsx finetune/bench_3seed.mts

import { execSync } from "child_process";
import fs from "fs";

const SEEDS = 3;
const env = { ...process.env, ESCALATE: "0" };

const results: any[] = [];
for (let s = 1; s <= SEEDS; s++) {
  console.log(`\n${"═".repeat(60)}\n  SEED ${s}/${SEEDS}\n${"═".repeat(60)}\n`);
  execSync("npx tsx finetune/bench_router.mts", { env, stdio: "inherit", timeout: 600_000 });
  // Find the latest result file
  const files = fs.readdirSync("finetune")
    .filter(f => f.startsWith("bench_router_") && f.endsWith(".json"))
    .sort().reverse();
  if (!files.length) { console.error("No result file found!"); process.exit(1); }
  results.push(JSON.parse(fs.readFileSync(`finetune/${files[0]}`, "utf8")));
}

function stat(arr: number[]): { mean: number; std: number } {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  return { mean, std };
}

console.log(`\n${"═".repeat(60)}\n  AGGREGATED (${SEEDS} seeds)\n${"═".repeat(60)}\n`);

const hsAll4 = stat(results.map(r => r.flexen.all_4 * 100));
const hsKcal20 = stat(results.map(r => r.flexen.kcal_acc20 * 100));
const hsMae = stat(results.map(r => r.flexen.mae_kcal));
const nbAcc = stat(results.map(r => r.nutribench.acc_7_5 * 100));
const nbKcal20 = stat(results.map(r => r.nutribench.kcal_acc20 * 100));
const nbMae = stat(results.map(r => r.nutribench.mae_kcal));
const cost = stat(results.map(r => r.cost.avg_per_call));

const fmt = (s: { mean: number; std: number }, d = 1) =>
  `${s.mean.toFixed(d)} ± ${s.std.toFixed(d)}`;

console.log(`Flexen all-4:      ${fmt(hsAll4)}%`);
console.log(`Flexen Acc@20%:    ${fmt(hsKcal20)}%`);
console.log(`Flexen MAE kcal:   ${fmt(hsMae)}`);
console.log(`NB Acc@7.5g:       ${fmt(nbAcc)}%`);
console.log(`NB kcal Acc@20%:   ${fmt(nbKcal20)}%`);
console.log(`NB MAE kcal:       ${fmt(nbMae)}`);
console.log(`avg $/call:        $${fmt(cost, 5)}`);

// Save aggregate
fs.writeFileSync(`finetune/bench_3seed_${Date.now()}.json`, JSON.stringify({
  seeds: SEEDS,
  flexen: { all_4: hsAll4, kcal_acc20: hsKcal20, mae_kcal: hsMae },
  nutribench: { acc_7_5: nbAcc, kcal_acc20: nbKcal20, mae_kcal: nbMae },
  cost: { avg_per_call: cost },
  raw: results,
}, null, 2));
console.log("\n→ Saved bench_3seed_*.json");
