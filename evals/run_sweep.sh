#!/usr/bin/env bash
# Final NutriBench sweep — clean models only (GPT-5.x excluded due to reasoning/parse issues).
set -euo pipefail
cd "$(dirname "$0")"

MODE="${1:-smoke}"

if [[ "$MODE" == "smoke" ]]; then
  FILE="nutribench_smoke20.json"
  OLLAMA_FILE="$FILE"
elif [[ "$MODE" == "full" ]]; then
  FILE="nutribench_sample_balanced.json"
  OLLAMA_FILE="nutribench_ollama200.json"
  if [[ ! -f "$OLLAMA_FILE" ]]; then
    node -e "const d=JSON.parse(require('fs').readFileSync('$FILE','utf8')); require('fs').writeFileSync('$OLLAMA_FILE', JSON.stringify(d.slice(0,200),null,2));"
  fi
else
  echo "Usage: $0 [smoke|full]"; exit 1
fi

echo "=== Sweep mode: $MODE  |  file: $FILE ==="

run() {
  local provider="$1" model="$2" label="$3" file="$4"
  echo ""
  echo "────────────────────────────────────────────────────────"
  echo "▶ $label  ($provider / $model)  — $file"
  echo "────────────────────────────────────────────────────────"
  MODEL_PROVIDER="$provider" MODEL_NAME="$model" \
    EVAL_NAME="NutriBench $MODE — $label" \
    NUTRIBENCH_FILE="$file" \
    timeout 1800 npx braintrust eval nutribench_multi.eval.ts || echo "⚠ $label FAILED (continuing)"
  sleep 3
}

# ── Google Gemini (all tiers) ──
run google    "gemini-3-flash-preview"      "Gemini 3 Flash Preview"   "$FILE"
run google    "gemini-3-pro-preview"        "Gemini 3 Pro Preview"     "$FILE"
run google    "gemini-2.5-flash"            "Gemini 2.5 Flash"         "$FILE"
run google    "gemini-2.5-flash-lite"       "Gemini 2.5 Flash Lite"    "$FILE"

# ── OpenAI (non-reasoning only — GPT-4.1 family) ──
run openai    "gpt-4.1"                     "GPT-4.1"                  "$FILE"
run openai    "gpt-4.1-mini"                "GPT-4.1 Mini"             "$FILE"
run openai    "gpt-4.1-nano"                "GPT-4.1 Nano"             "$FILE"

# ── Anthropic Claude 4.5 / 4.6 ──
run anthropic "claude-haiku-4-5-20251001"   "Claude Haiku 4.5"         "$FILE"
run anthropic "claude-sonnet-4-5-20250929"  "Claude Sonnet 4.5"        "$FILE"
run anthropic "claude-sonnet-4-6"           "Claude Sonnet 4.6"        "$FILE"

# ── Ollama Cloud (clean ones only) ──
run ollama    "gpt-oss:120b"                "GPT-OSS 120B"             "$OLLAMA_FILE"
run ollama    "gemma3:27b"                  "Gemma 3 27B"              "$OLLAMA_FILE"

echo ""
echo "=== Sweep complete ==="
echo "Results: sweep_results.csv"
column -s, -t < sweep_results.csv 2>/dev/null || cat sweep_results.csv
