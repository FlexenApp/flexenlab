#!/usr/bin/env bash
# Variance + long-prompt pipeline
# 1-3: Gemini 3 Flash Preview on full 500-case NutriBench (measure run-to-run variance)
# 4:   Same with LONG_PROMPT=1 variant (calibration examples + edge cases + negatives)
# Per-case details are logged to JSON for post-hoc error analysis.
set -euo pipefail
cd "$(dirname "$0")"
set -a; source /c/Users/Leonard/.flexen/api_keys.env; set +a

FILE="nutribench_sample_balanced.json"
rm -f variance_*.jsonl variance_*.csv

run() {
  local label="$1" detail="$2" long="$3"
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "▶ $label"
  echo "════════════════════════════════════════════════════════"
  MODEL_PROVIDER=google \
  MODEL_NAME=gemini-3-flash-preview \
  NUTRIBENCH_FILE="$FILE" \
  EVAL_NAME="Variance — $label" \
  DETAIL_LOG="$detail" \
  LONG_PROMPT="$long" \
  MAX_CONCURRENCY=3 \
    timeout 3600 npx braintrust eval nutribench_multi.eval.ts \
    || echo "⚠ $label FAILED (continuing)"
  sleep 10
}

run "run-1 short prompt" "variance_run1.jsonl" "0"
run "run-2 short prompt" "variance_run2.jsonl" "0"
run "run-3 short prompt" "variance_run3.jsonl" "0"
run "run-4 LONG prompt" "variance_long.jsonl" "1"

echo ""
echo "=== Variance sweep complete ==="
echo "--- Sweep CSV ---"
tail -20 sweep_results.csv
echo ""
echo "--- Detail files ---"
ls -la variance_*.jsonl 2>/dev/null
