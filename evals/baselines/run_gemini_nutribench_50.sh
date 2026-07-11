#!/usr/bin/env bash
# Gemini re-run all variants on nutribench_50 (matched dataset to Ollama).
set -euo pipefail
cd "$(dirname "$0")/.."

run_bg() {
  local variant="$1" dataset="$2"
  local out_file="baselines/results/gemini_${variant}_${dataset}.json"
  if [[ -f "$out_file" ]]; then echo "⏭  gemini/$variant/$dataset"; return; fi
  echo "▶ gemini/$variant/$dataset"
  (MODEL=gemini VARIANT=$variant DATASET=$dataset \
    timeout 1800 npx tsx baselines/baseline_runner.mts > "baselines/results/_log_gemini_${variant}_${dataset}.log" 2>&1 \
    && echo "✓ gemini/$variant/$dataset" \
    || echo "⚠ gemini/$variant/$dataset FAILED") &
}

for variant in baseline strict_confidence few_shot negative_examples lean_schema minimal_schema structured_reasoning self_consistency atwater_retry critic_loop; do
  run_bg "$variant" "nutribench_50"
  while [[ $(jobs -r | wc -l) -ge 4 ]]; do sleep 5; done
done

wait
echo "═══ Gemini nutribench_50 batch complete ═══"
