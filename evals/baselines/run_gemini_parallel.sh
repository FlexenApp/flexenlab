#!/usr/bin/env bash
# Gemini runs in parallel (up to 4 concurrent), skipping anything already done.
set -euo pipefail
cd "$(dirname "$0")/.."

JOBS=()

run_bg() {
  local variant="$1" dataset="$2"
  local out_file="baselines/results/gemini_${variant}_${dataset}.json"
  if [[ -f "$out_file" ]]; then
    echo "⏭  gemini/$variant/$dataset (cached)"
    return
  fi
  echo "▶ gemini/$variant/$dataset"
  (MODEL=gemini VARIANT=$variant DATASET=$dataset \
    timeout 1800 npx tsx baselines/baseline_runner.mts > "baselines/results/_log_gemini_${variant}_${dataset}.log" 2>&1 \
    && echo "✓ gemini/$variant/$dataset" \
    || echo "⚠ gemini/$variant/$dataset FAILED") &
  JOBS+=($!)
}

# Phase 1 — prompt/schema variants on NutriBench 100 (parallelizable, all safe)
for variant in baseline strict_confidence few_shot negative_examples lean_schema minimal_schema structured_reasoning self_consistency atwater_retry critic_loop; do
  run_bg "$variant" "nutribench_100"
  # Throttle: max 4 concurrent
  while [[ $(jobs -r | wc -l) -ge 4 ]]; do sleep 5; done
done

# Phase 2 — baseline across robustness datasets
for dataset in flexen_hardset e12 e13 e3; do
  run_bg "baseline" "$dataset"
  while [[ $(jobs -r | wc -l) -ge 4 ]]; do sleep 5; done
done

# Wait for all
wait
echo ""
echo "═══ Gemini parallel batch complete ═══"
ls -la baselines/results/gemini_*.json 2>/dev/null | tail -30
