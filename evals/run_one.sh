#!/usr/bin/env bash
# Run ONE model via env-var config (safer than positional args across cmd.exe boundary).
# Required: PROVIDER, MODEL, LABEL, FILE, MODE
set -euo pipefail
cd "$(dirname "$0")"

set -a
source /c/Users/Leonard/.flexen/api_keys.env
set +a

MODEL_PROVIDER="${PROVIDER}" \
MODEL_NAME="${MODEL}" \
EVAL_NAME="NutriBench ${MODE:-full} — ${LABEL}" \
NUTRIBENCH_FILE="${FILE}" \
  timeout 1800 npx braintrust eval nutribench_multi.eval.ts
