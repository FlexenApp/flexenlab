#!/usr/bin/env bash
# Image sweep on Nutrition5k — vision-capable + cost-viable models only.
set -euo pipefail
cd "$(dirname "$0")"

FILE="${IMAGE_DATASET:-nutrition5k_sample.json}"
echo "=== Image sweep on $FILE ==="

MODELS=(
  "google|gemini-3-flash-preview|Gemini 3 Flash Preview"
  "google|gemini-3-pro-preview|Gemini 3 Pro Preview"
  "google|gemini-2.5-flash|Gemini 2.5 Flash"
  "google|gemini-2.5-flash-lite|Gemini 2.5 Flash Lite"
  "openai|gpt-4.1|GPT-4.1"
  "openai|gpt-4.1-mini|GPT-4.1 Mini"
  "anthropic|claude-haiku-4-5-20251001|Claude Haiku 4.5"
  "anthropic|claude-sonnet-4-5-20250929|Claude Sonnet 4.5"
)

for entry in "${MODELS[@]}"; do
  IFS='|' read -r provider model label <<< "$entry"
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "▶ $label  ($provider / $model)"
  echo "════════════════════════════════════════════════════════"
  PROVIDER="$provider" MODEL="$model" LABEL="$label" FILE="$FILE" MODE="image" \
    cmd //c "bash run_image_one.sh" || echo "⚠ $label FAILED (continuing)"
  sleep 5
done

echo ""
echo "=== Image sweep complete ==="
column -s, -t < image_sweep_results.csv 2>/dev/null || cat image_sweep_results.csv
