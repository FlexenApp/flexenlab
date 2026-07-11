#!/usr/bin/env bash
# Maximally-isolated sweep: each model runs via `cmd //c bash` which forces
# a new Windows process tree (kills all leaked sockets/handles from prior runs).
set -euo pipefail
cd "$(dirname "$0")"

MODE="${1:-full}"
if [[ "$MODE" == "smoke" ]]; then
  FILE="nutribench_smoke20.json"
  OLLAMA_FILE="$FILE"
else
  FILE="nutribench_sample_balanced.json"
  OLLAMA_FILE="nutribench_ollama200.json"
fi

echo "=== Win-isolated sweep: $MODE ==="

# Excluded due to rate-limiting in prior runs (instability polluted socket state):
#   gemini-3-pro-preview (349 errors / 500)
#   gemini-2.5-flash (346 errors / 500)
# Keep baseline gemini-3-flash-preview (already ran, 447/500 ok).

MODELS=(
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
  # Fresh Windows process tree via cmd //c; pass config through env
  PROVIDER="$provider" MODEL="$model" LABEL="$label" FILE="$file" MODE="$MODE" \
    cmd //c "bash run_one.sh" || echo "⚠ $label FAILED (continuing)"
  sleep 10
done

echo ""
echo "=== Sweep complete ==="
column -s, -t < sweep_results.csv 2>/dev/null || cat sweep_results.csv
