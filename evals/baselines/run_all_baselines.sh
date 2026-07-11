#!/usr/bin/env bash
# Full baseline matrix: runs every (model, variant, dataset) combination
# we want BEFORE starting the fine-tune, so we have a complete comparison grid.
set -euo pipefail
cd "$(dirname "$0")/.."

# Small dataset for prompt-variant testing (faster + cheaper)
SMALL_DATASET="nutribench_100"
# Robustness datasets (always small)
# flexen_hardset (25), e12 (10), e13 (10), e3 (40 queries in 10 groups)

MODELS=("gemini" "ollama")
# Variants tested on NutriBench 100 (prompt/schema variations)
NUTRI_VARIANTS=(
  "baseline"
  "strict_confidence"
  "few_shot"
  "negative_examples"
  "lean_schema"
  "minimal_schema"
  "structured_reasoning"
  "self_consistency"
  "atwater_retry"
  "critic_loop"
)
# Robustness variants on smaller datasets (baseline prompt only)
ROBUSTNESS_DATASETS=("flexen_hardset" "e12" "e13" "e3")

run_one() {
  local model="$1" variant="$2" dataset="$3"
  local label="$model/$variant/$dataset"
  local out_file="baselines/results/${model}_${variant}_${dataset}.json"
  if [[ -f "$out_file" ]]; then
    echo "  ⏭  $label  (cached, skip)"
    return
  fi
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶ $label"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  PROVIDER=$model MODEL=$model VARIANT=$variant DATASET=$dataset \
    timeout 1800 npx tsx baselines/baseline_runner.mts \
    || echo "  ⚠ FAILED"
  sleep 5
}

# ── Phase 1: Prompt/schema variants on NutriBench 100 ──
echo "═══ Phase 1: Prompt variants on $SMALL_DATASET ═══"
for model in "${MODELS[@]}"; do
  for variant in "${NUTRI_VARIANTS[@]}"; do
    run_one "$model" "$variant" "$SMALL_DATASET"
  done
done

# ── Phase 2: Baseline across robustness datasets ──
echo ""
echo "═══ Phase 2: Baseline on robustness datasets ═══"
for model in "${MODELS[@]}"; do
  for dataset in "${ROBUSTNESS_DATASETS[@]}"; do
    run_one "$model" "baseline" "$dataset"
  done
done

echo ""
echo "═══ ALL BASELINES COMPLETE ═══"
ls -la baselines/results/
