// Aggregate all baseline results into a comparison report.
import fs from "fs";

const RESULTS = "baselines/results";
const files = fs.readdirSync(RESULTS).filter(f => f.endsWith(".json"));

const data = {};
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(`${RESULTS}/${f}`, "utf8"));
  const key = `${d.model}_${d.variant}_${d.dataset}`;
  data[key] = d;
}

function get(model, variant, dataset, metric) {
  const d = data[`${model}_${variant}_${dataset}`];
  if (!d || d[metric] == null) return null;
  return d[metric];
}
function pct(x) {
  if (x == null) return "—   ";
  return (x * 100).toFixed(0).padStart(3) + "%";
}
function num(x, d = 0) {
  if (x == null) return "—  ";
  return x.toFixed(d).padStart(4);
}

const VARIANTS = [
  "baseline", "strict_confidence", "few_shot", "negative_examples",
  "lean_schema", "minimal_schema", "structured_reasoning",
  "self_consistency", "atwater_retry", "critic_loop",
];

console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("  FLEXEN FOOD-AI BASELINE MATRIX — 2026-04-09");
console.log("  NutriBench 50 balanced, flexen_hardset 25, e12/e13/e3 robustness");
console.log("═══════════════════════════════════════════════════════════════════════════\n");

console.log("─── NUTRIBENCH 50: Acc@7.5g (carbs within ±7.5g) ───");
console.log("Variant                     Gemini 3 Flash   GPT-OSS 120B   Delta");
for (const v of VARIANTS) {
  const g = get("gemini", v, "nutribench_50", "acc_7_5");
  const o = get("ollama", v, "nutribench_50", "acc_7_5");
  const delta = (g != null && o != null) ? ((g - o) * 100).toFixed(0) + " pts" : "—";
  console.log(`  ${v.padEnd(26)} ${pct(g).padEnd(16)} ${pct(o).padEnd(14)} ${delta}`);
}

console.log("\n─── NUTRIBENCH 50: kcal Acc@±20% (Cal-AI comparable) ───");
console.log("Variant                     Gemini 3 Flash   GPT-OSS 120B   Delta");
for (const v of VARIANTS) {
  const g = get("gemini", v, "nutribench_50", "kcal_acc_20");
  const o = get("ollama", v, "nutribench_50", "kcal_acc_20");
  const delta = (g != null && o != null) ? ((g - o) * 100).toFixed(0) + " pts" : "—";
  console.log(`  ${v.padEnd(26)} ${pct(g).padEnd(16)} ${pct(o).padEnd(14)} ${delta}`);
}

console.log("\n─── NUTRIBENCH 50: MAE kcal (lower = better) ───");
console.log("Variant                     Gemini 3 Flash   GPT-OSS 120B   Delta");
for (const v of VARIANTS) {
  const g = get("gemini", v, "nutribench_50", "mae_kcal");
  const o = get("ollama", v, "nutribench_50", "mae_kcal");
  const delta = (g != null && o != null) ? (o - g).toFixed(0) + " kcal" : "—";
  console.log(`  ${v.padEnd(26)} ${num(g).padEnd(16)} ${num(o).padEnd(14)} ${delta}`);
}

console.log("\n─── NUTRIBENCH 50: Error rate (out of 50) ───");
console.log("Variant                     Gemini 3 Flash   GPT-OSS 120B");
for (const v of VARIANTS) {
  const g = get("gemini", v, "nutribench_50", "errors");
  const o = get("ollama", v, "nutribench_50", "errors");
  console.log(`  ${v.padEnd(26)} ${String(g ?? "—").padStart(3).padEnd(16)} ${String(o ?? "—").padStart(3).padEnd(14)}`);
}

console.log("\n─── ROBUSTNESS DATASETS (baseline prompt only) ───");
console.log("\n  FLEXEN HARDSET 25 (brand-heavy)");
console.log("                              Gemini         GPT-OSS");
console.log(`    all-4-in-band:            ${pct(get("gemini","baseline","flexen_hardset","all_4_in_band"))}           ${pct(get("ollama","baseline","flexen_hardset","all_4_in_band"))}`);
console.log(`    kcal in tolerance:        ${pct(get("gemini","baseline","flexen_hardset","kcal_in_tolerance"))}           ${pct(get("ollama","baseline","flexen_hardset","kcal_in_tolerance"))}`);
console.log(`    kcal Acc@±20%:            ${pct(get("gemini","baseline","flexen_hardset","kcal_acc_20"))}           ${pct(get("ollama","baseline","flexen_hardset","kcal_acc_20"))}`);
console.log(`    MAE kcal:                 ${num(get("gemini","baseline","flexen_hardset","mae_kcal"))}           ${num(get("ollama","baseline","flexen_hardset","mae_kcal"))}`);

console.log("\n  E12 LONG MULTI-MEAL QUERIES (10 synthetic compound meals)");
console.log(`    within ±20% kcal:         ${pct(get("gemini","baseline","e12_long_queries","within_20pct"))}           ${pct(get("ollama","baseline","e12_long_queries","within_20pct"))}`);
console.log(`    MAE kcal:                 ${num(get("gemini","baseline","e12_long_queries","mae_kcal"))}           ${num(get("ollama","baseline","e12_long_queries","mae_kcal"))}`);

console.log("\n  E13 PROMPT INJECTION (10 adversarial attacks)");
console.log(`    robust rate:              ${pct(get("gemini","baseline","e13_injection","robust_rate"))}           ${pct(get("ollama","baseline","e13_injection","robust_rate"))}`);
console.log(`    vulnerable rate:          ${pct(get("gemini","baseline","e13_injection","vulnerable_rate"))}           ${pct(get("ollama","baseline","e13_injection","vulnerable_rate"))}`);
console.log(`    refused rate:             ${pct(get("gemini","baseline","e13_injection","refused_rate"))}           ${pct(get("ollama","baseline","e13_injection","refused_rate"))}`);

console.log("\n  E3 OUTPUT CONSISTENCY (10 queries × 4 phrasing variants)");
console.log(`    avg cross-variation drift: ${pct(get("gemini","baseline","e3_consistency","avg_drift_pct"))}          ${pct(get("ollama","baseline","e3_consistency","avg_drift_pct"))}`);
console.log("     (lower = more deterministic, same query → same kcal)");

console.log("\n═══════════════════════════════════════════════════════════════════════════");
console.log("  INTERPRETATION GUIDE");
console.log("═══════════════════════════════════════════════════════════════════════════");
console.log(`
• Positive Delta = Gemini ahead of GPT-OSS by that many points
• Negative Delta = GPT-OSS ahead of Gemini
• Error counts reflect provider rate-limits / content filtering / parse failures

• NutriBench 50 variance: ±3-5 pts (small sample, interpret cautiously)
• NutriBench 500 (full sweep earlier) is more statistically reliable: ±0.8 pts

• After fine-tune: re-run all Ollama rows with fine-tuned model name
  and replace "GPT-OSS 120B" column. Same infrastructure.
`);

// Save as markdown too
const md = [];
md.push("# Flexen Food-AI Baseline Matrix — 2026-04-09\n");
md.push("Complete comparison of Gemini 3 Flash Preview vs GPT-OSS 120B (Ollama Cloud) across 10 prompt variants + 4 robustness datasets. Baseline reference for future fine-tune evaluation.\n");
md.push("## NutriBench 50 — Prompt/Schema Variants\n");
md.push("| Variant | Gemini Acc@7.5 | GPT-OSS Acc@7.5 | Gemini kcalAcc20 | GPT-OSS kcalAcc20 | Gemini MAE | GPT-OSS MAE |");
md.push("|---|---|---|---|---|---|---|");
for (const v of VARIANTS) {
  md.push(`| ${v} | ${pct(get("gemini",v,"nutribench_50","acc_7_5")).trim()} | ${pct(get("ollama",v,"nutribench_50","acc_7_5")).trim()} | ${pct(get("gemini",v,"nutribench_50","kcal_acc_20")).trim()} | ${pct(get("ollama",v,"nutribench_50","kcal_acc_20")).trim()} | ${num(get("gemini",v,"nutribench_50","mae_kcal")).trim()} | ${num(get("ollama",v,"nutribench_50","mae_kcal")).trim()} |`);
}
md.push("\n## Robustness Datasets (baseline prompt)\n");
md.push("| Dataset | Metric | Gemini | GPT-OSS |");
md.push("|---|---|---|---|");
md.push(`| Flexen Hardset | all-4-in-band | ${pct(get("gemini","baseline","flexen_hardset","all_4_in_band")).trim()} | ${pct(get("ollama","baseline","flexen_hardset","all_4_in_band")).trim()} |`);
md.push(`| Flexen Hardset | kcal Acc@±20% | ${pct(get("gemini","baseline","flexen_hardset","kcal_acc_20")).trim()} | ${pct(get("ollama","baseline","flexen_hardset","kcal_acc_20")).trim()} |`);
md.push(`| Flexen Hardset | MAE kcal | ${num(get("gemini","baseline","flexen_hardset","mae_kcal")).trim()} | ${num(get("ollama","baseline","flexen_hardset","mae_kcal")).trim()} |`);
md.push(`| E12 Long Queries | within ±20% | ${pct(get("gemini","baseline","e12_long_queries","within_20pct")).trim()} | ${pct(get("ollama","baseline","e12_long_queries","within_20pct")).trim()} |`);
md.push(`| E12 Long Queries | MAE kcal | ${num(get("gemini","baseline","e12_long_queries","mae_kcal")).trim()} | ${num(get("ollama","baseline","e12_long_queries","mae_kcal")).trim()} |`);
md.push(`| E13 Injection | robust | ${pct(get("gemini","baseline","e13_injection","robust_rate")).trim()} | ${pct(get("ollama","baseline","e13_injection","robust_rate")).trim()} |`);
md.push(`| E13 Injection | vulnerable | ${pct(get("gemini","baseline","e13_injection","vulnerable_rate")).trim()} | ${pct(get("ollama","baseline","e13_injection","vulnerable_rate")).trim()} |`);
md.push(`| E13 Injection | refused | ${pct(get("gemini","baseline","e13_injection","refused_rate")).trim()} | ${pct(get("ollama","baseline","e13_injection","refused_rate")).trim()} |`);
md.push(`| E3 Consistency | cross-variation drift | ${pct(get("gemini","baseline","e3_consistency","avg_drift_pct")).trim()} | ${pct(get("ollama","baseline","e3_consistency","avg_drift_pct")).trim()} |`);

fs.writeFileSync("baselines/BASELINE_MATRIX.md", md.join("\n"));
console.log("\n→ Saved baselines/BASELINE_MATRIX.md");
