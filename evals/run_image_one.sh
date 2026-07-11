#!/usr/bin/env bash
# Run ONE image eval model — fresh process tree via env-var config.
set -euo pipefail
cd "$(dirname "$0")"

set -a
source /c/Users/Leonard/.flexen/api_keys.env
set +a

MODEL_PROVIDER="${PROVIDER}" \
MODEL_NAME="${MODEL}" \
EVAL_NAME="Image ${MODE:-smoke} — ${LABEL}" \
IMAGE_DATASET="${FILE}" \
  timeout 1800 npx braintrust eval food_image_multi.eval.ts
