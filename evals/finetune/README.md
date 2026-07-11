# GPT-OSS 120B Fine-Tune Pipeline

End-to-end fine-tuning setup for Flexen's food estimation use case.

## Prerequisites

1. **Together AI account**: https://api.together.ai/ — free to create, needs credit card to upload credits
2. **API Key**: Settings → API Keys → create one. Add to `/c/Users/Leonard/.flexen/api_keys.env`:
   ```
   TOGETHER_API_KEY=<your-key>
   ```
3. **Credits**: Recommended minimum **$25** for first training run + evaluation

## Pipeline Steps

### Step 1 — Fetch NutriBench v2 full dataset
```bash
cd flexenlab/evals
node finetune/01_fetch_nutribench_full.mjs
```
Downloads all ~11,857 cases from HuggingFace. Writes `finetune/nutribench_full.json`.
Takes ~5-10 minutes.

### Step 2 — Build training data (Together JSONL format)
```bash
node finetune/02_build_training_data.mjs
```
Converts NutriBench → Together chat format. Stratified 90/10 split by country.
Uses the EXACT same prompt format as production `food_recognition_service.dart`.
Writes `finetune/train.jsonl` + `finetune/eval.jsonl`.

### Step 3 — Upload files + start fine-tune job
```bash
node finetune/03_upload_and_train.mjs
```
Uploads both files to Together, creates a LoRA fine-tune job on `openai/gpt-oss-120b`.
Hyperparameters (conservative first run):
- LoRA rank: 16
- Alpha: 32
- Dropout: 0.05
- Epochs: 3
- Learning rate: 1e-4
- Batch size: 4

Saves job ID to `finetune/last_job.json`.

**Estimated cost**: $15-30 for first run.

### Step 4 — Monitor training progress
```bash
node finetune/04_monitor_job.mjs
# Or with explicit job id:
node finetune/04_monitor_job.mjs ft-abc123
```
Polls every 30s until complete. Prints status updates.

**Estimated time**: 30-90 min on Together A100 cluster.

### Step 5 — Benchmark the fine-tuned model
```bash
MODEL_NAME="<model-id-from-step-4>" npx tsx finetune/05_bench_finetuned.mts
```
Runs fine-tuned model against:
- Full NutriBench 500-case balanced sample
- Full Flexen 25-case hand-curated hardset

Compares against Gemini 3 Flash Preview + GPT-OSS 120B untrained baselines.

## Success Criteria (Ship-worthy fine-tune)

The fine-tune should **at least match Gemini 3 Flash Preview**:

| Metric                    | Current Gemini | Ship Target | Stretch Goal |
|---------------------------|----------------|-------------|--------------|
| NutriBench Acc@7.5g       | 54.29%         | ≥54%        | ≥58%         |
| NutriBench kcal Acc@±20%  | 66.71%         | ≥66%        | ≥70%         |
| NutriBench MAE kcal       | 93.30          | ≤93         | ≤80          |
| Flexen Hardset all-4      | 72%            | ≥70%        | ≥76%         |
| Flexen Hardset kcal Acc20 | 88%            | ≥86%        | ≥92%         |

If fine-tune **matches or beats these**:
- Deploy via new Cloud Function `estimateFoodAIFineTune` (Together AI API)
- A/B against production Gemini 3 Flash for 1 week
- Ship if correction-rate stays flat or improves
- Projected savings: **~$3760/month at 1M calls** ($4680 Gemini → $920 Together)

If fine-tune **is 1-3 points below**:
- Iterate with more epochs (5-8) and higher LoRA rank (32-64)
- Add brand-scraped data (Starbucks, Chipotle, McDonald's nutrition PDFs)
- Second run typically closes most of the remaining gap

If fine-tune **is 5+ points below**:
- Likely data quality issue in NutriBench (~30% of cases have Atwater-inconsistent labels)
- Consider filtering training set to only Atwater-consistent cases
- Or skip fine-tune route, go with Smart Router B4.2 instead

## Cost Projection

| Phase                           | Cost   |
|---------------------------------|--------|
| First fine-tune run             | $15-30 |
| Full benchmark after training   | $1-3   |
| 5 iterations (hyperparam tuning)| $75-150|
| Total one-shot investment       | **~$100-200** |

**Monthly inference at 1M calls/month (target production)**:
- Gemini 3 Flash Preview: ~$4680
- Together gpt-oss-120b fine-tuned: ~$920 (same token usage)
- **Monthly savings**: ~$3760

Break-even: ~1 day of production traffic at 1M calls/month.

## Iteration Plan (if first run misses targets)

**If NutriBench Acc@7.5 is 1-3 pts below target (~52-53%):**
- Increase epochs 3 → 5
- Increase LoRA rank 16 → 32
- Expected gain: +2-4 pts

**If Flexen Hardset Acc@±20% is below 85%:**
- Add brand-scraped data (McDonald's, Starbucks, Chipotle, In-N-Out, Beyond Burger, Sweetgreen)
- Scrape ~3000 additional examples from official brand nutrition PDFs
- Expected gain: +5-10 pts on brand queries

**If kcal MAE is high (>110):**
- Filter training set to Atwater-consistent cases only (remove ~30% noisy data)
- Slightly higher LR (2e-4) to converge faster on cleaner data
- Expected gain: -15-25 MAE kcal

## Files

- `01_fetch_nutribench_full.mjs` — Download full NutriBench v2
- `02_build_training_data.mjs` — Convert to Together JSONL format
- `03_upload_and_train.mjs` — Upload + start fine-tune job
- `04_monitor_job.mjs` — Poll job status until completion
- `05_bench_finetuned.mts` — Benchmark against all baselines
- `last_job.json` — Latest job info (created by step 3)
- `completed_job.json` — Final job state (created by step 4)
- `bench_results_*.json` — Benchmark results per run
- `train.jsonl` / `eval.jsonl` — Training data (gitignored, 10-15 MB each)
- `nutribench_full.json` — Raw NutriBench (gitignored, ~30 MB)
