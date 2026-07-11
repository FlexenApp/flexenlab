#!/usr/bin/env bash
# Isolated sweep: every model runs in a completely fresh bash subshell
# + fresh node process → zero cross-contamination.
#
# The previous run_sweep.sh shared a parent process whose socket pool
# died after Gemini 3 Pro's 349 errors, killing all subsequent runs.
set -euo pipefail
cd "$(dirname "$0")"

MODE="${1:-full}"

if [[ "$MODE" == "smoke" ]]; then
  FILE="nutribench_smoke20.json"
  OLLAMA_FILE="$FILE"
else
  FILE="nutribench_sample_balanced.json"
  OLLAMA_FILE="nutribench_ollama200.json"
  if [[ ! -f "$OLLAMA_FILE" ]]; then
    node -e "const d=JSON.parse(require('fs').readFileSync('$FILE','utf8')); require('fs').writeFileSync('$OLLAMA_FILE', JSON.stringify(d.slice(0,200),null,2));"
  fi
fi

echo "=== Isolated sweep: $MODE  |  file: $FILE ==="
chmod +x run_one.sh

# MODELS: provider|model|label|file
MODELS=(
  "google|gemini-2.5-flash|Gemini 2.5 Flash|$FILE"
  "google|gemini-2.5-flash-lite|Gemini 2.5 Flash Lite|$FILE"
  "openai|gpt-4.1|GPT-4.1|$FILE"
  "openai|gpt-4.1-mini|GPT-4.1 Mini|$FILE"
  "openai|gpt-4.1-nano|GPT-4.1 Nano|$FILE"
  "anthropic|claude-haiku-4-5-20251001|Claude Haiku 4.5|$FILE"
  "anthropic|claude-sonnet-4-5-20250929|Claude Sonnet 4.5|$FILE"
  "anthropic|claude-sonnet-4-6|Claude Sonnet 4.6|$FILE"
  "ollama|gpt-oss:120b|GPT-OSS 120B|$OLLAMA_FILE"
  "ollama|gemma3:27b|Gemma 3 27B|$OLLAMA_FILE"
)

for entry in "${MODELS[@]}"; do
  IFS='|' read -r provider model label file <<< "$entry"
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "▶ $label  ($provider / $model)"
  echo "════════════════════════════════════════════════════════"
  # Run in a completely fresh subshell — parent's socket state cannot leak in
  bash run_one.sh "$provider" "$model" "$label" "$file" "$MODE" || echo "⚠ $label FAILED (continuing)"
  sleep 5
done

echo ""
echo "=== Sweep complete ==="
column -s, -t < sweep_results.csv 2>/dev/null || cat sweep_results.csv
