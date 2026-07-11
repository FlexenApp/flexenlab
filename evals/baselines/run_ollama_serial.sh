#!/usr/bin/env bash
# Ollama runs must be serial (Ollama Cloud: 1 concurrent request per account).
# Uses nutribench_50 (instead of 100) since each call is 15-30s and timeout is 30min.
set -euo pipefail
cd "$(dirname "$0")/.."

DATASET="${1:-nutribench_50}"
TIMEOUT=3600  # 60 min per run

run_one() {
  local variant="$1" dataset="$2"
  local out_file="baselines/results/ollama_${variant}_${dataset}.json"
  if [[ -f "$out_file" ]]; then
    echo "⏭  ollama/$variant/$dataset (cached)"
    return
  fi
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶ ollama/$variant/$dataset"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  MODEL=ollama VARIANT=$variant DATASET=$dataset \
    timeout $TIMEOUT npx tsx baselines/baseline_runner.mts \
    || echo "  ⚠ FAILED"
  sleep 3
}

# Phase 1 — variants on smaller nutribench dataset
for variant in baseline strict_confidence few_shot negative_examples lean_schema minimal_schema structured_reasoning self_consistency atwater_retry critic_loop; do
  run_one "$variant" "$DATASET"
done

# Phase 2 — robustness datasets (these are already small)
for dataset in flexen_hardset e12 e13 e3; do
  run_one "baseline" "$dataset"
done

echo ""
echo "═══ Ollama serial batch complete ═══"
ls -la baselines/results/ollama_*.json 2>/dev/null | tail -30
