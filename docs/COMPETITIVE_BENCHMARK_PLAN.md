# Competitive Benchmark Plan

**Goal:** Stop optimizing blind. Measure Flexen's food-AI quality against (a) the public industry standard (NutriBench v2) and (b) the actual competitors users compare us to (Cal AI, MyFitnessPal, Yazio, MacroFactor).

**Why now:** Before we ship Smart Router (B4.2) or invest in Fine-Tuning (E8), we need to know if we're optimizing the leader or chasing the pack. Current eval set (~150 hand-curated queries) tells us nothing about relative market position.

---

## Phase A — Public Benchmark (2 days, fully automated)

### A.1 NutriBench v2 Full Run
- Dataset already fetched: `nutribench_sample_balanced.json`, `nutribench_sample_500.json`
- Expand to full 11k if API budget allows, else 1k stratified sample (by meal type, cuisine, portion complexity)
- Metrics: MAE kcal, MAE macros (P/F/C), Accuracy@7.5g, Accuracy@15%, Judge score
- Ground truth: NutriBench expert labels (gold standard, used by Cal AI paper)

### A.2 Model Matrix
Run **every serious contender** against the same 1k sample:

| Model | Via | Cost/1k queries (est) |
|---|---|---|
| gemini-3-flash-preview | Vertex us-central1 | $0.85 |
| gemini-2.5-flash | Vertex eu-west1 | $0.28 |
| gemini-2.5-flash-lite | Vertex eu-west1 | $0.09 |
| gpt-5-mini | OpenAI API | $0.52 |
| gpt-4o-mini | OpenAI API | $0.34 |
| claude-sonnet-4.5 | Anthropic API | $3.40 |
| claude-haiku-4.5 | Anthropic API | $0.42 |

All use the same `FOOD_SYSTEM_INSTRUCTION` prompt (single source, fair fight).

### A.3 Deliverable
`flexenlab/evals/results/nutribench_model_matrix.md` — leaderboard table, cost-per-quality-point, pareto frontier chart. Decision: keep 3-flash, switch to gpt-5-mini, or introduce router.

---

## Phase B — Competitor Reality Check (3-5 days, semi-manual)

The hard question: *Are we better than Cal AI / MyFitnessPal / Yazio on the queries our actual users send?*

### B.1 Query Set
100 queries from real PostHog logs (once we have them) + 50 hand-picked "canonical" queries covering:
- Plain foods ("banana", "2 eggs")
- Branded ("Big Mac meal", "Chipotle chicken bowl")
- Restaurant dishes ("chicken tikka masala with rice")
- German/EU foods ("Leberkäse Semmel", "Döner mit allem")
- Ambiguous portions ("a handful of nuts", "small plate of pasta")
- Home recipes ("my grandma's lasagna, one slice")

### B.2 Competitor Data Collection

| App | Method | Effort |
|---|---|---|
| **Cal AI** | Manual: type each query into their app, screenshot, log kcal/P/F/C. 150 × ~30s = 75 min. | Low |
| **MyFitnessPal** | Database lookup via their public search API. Automated. | Low |
| **Yazio** | Manual (no public API). Shared account, type queries. | Medium |
| **MacroFactor** | Manual, premium app. | Medium |
| **Lose It!** | Database lookup, manual. | Medium |
| **Noom** | Skip — not primarily AI-estimation. | — |

### B.3 Ground Truth Strategy
For each of the 150 queries, establish ground truth by **consensus + manual review**:
1. Query NutriBench / USDA / FatSecret Platinum
2. For restaurant items: use published brand data (McDonald's, Chipotle, Starbucks nutrition PDFs)
3. For home recipes / ambiguous portions: use a dietitian-reviewed estimate range (±10% tolerance)
4. Store in `flexenlab/evals/competitor_ground_truth.json`

### B.4 Scoring
Same metrics as Phase A, plus:
- **Relative rank per query** (1-6 across Flexen + 5 competitors)
- **Win rate** (% of queries where Flexen is closest to ground truth)
- **Confidence calibration** (does our HIGH/MEDIUM/LOW match actual accuracy?)

### B.5 Deliverable
`flexenlab/evals/results/competitor_comparison.md` — honest leaderboard. This is the number we can actually put in marketing: *"Flexen is X% more accurate than Cal AI on branded fast food"* or equivalent.

---

## Phase C — Continuous Monitoring (ongoing, zero effort)

Once A + B are set up, run them **on every model/prompt change** in CI:

### C.1 Braintrust CI Integration
- `flexenlab/.github/workflows/eval-nightly.yml` — runs NutriBench 500 sample nightly against current production prompt + model, posts delta to Telegram via OpenClaw
- Flags regressions >1 Macro point automatically

### C.2 Weekly Competitive Refresh
- 20 new queries from PostHog logs per week, re-run against competitor set
- Track **drift**: if Cal AI ships a new model, we see it within a week

---

## Cost & Timeline

| Phase | Effort | API Cost | Unlocks |
|---|---|---|---|
| A — NutriBench model matrix | 2 days | ~$15 one-shot | Know which model to use |
| B — Competitor reality check | 3-5 days | ~$5 + manual time | Marketing numbers + true quality gap |
| C — CI + weekly refresh | 0.5 day setup, then ~$2/week | Regression safety |

**Total**: ~1 week work, <$50 API spend, permanent answer to "are we best in class?"

---

## Critical Decisions This Unblocks

1. **Is Gemini 3 actually the right model?** (Phase A answer)
2. **Should we invest in Smart Router B4.2?** (only if we're leading — otherwise close the gap first)
3. **Should we fine-tune 2.5-flash-lite on NutriBench?** (only if the gap to 3-flash is small in OUR problem domain)
4. **Can we credibly claim "most accurate AI calorie tracker"?** (Phase B answer)
5. **Where are we weakest?** (German foods? Ambiguous portions? Branded? → prioritize RAG/prompt work there)

---

## Open Questions / Risks

- **Cal AI API access**: Unknown if reverse-proxy works. Fallback: manual entry (slow but feasible for 150 queries).
- **Ground truth disputes**: For home recipes, there's no perfect answer. Use ±15% tolerance band instead of point estimate.
- **Prompt fairness**: Different models prefer different prompt styles. Risk of under-selling gpt-5-mini if we only test with Gemini-tuned prompt. Mitigation: run gpt-5-mini twice — once with our prompt, once with OpenAI-style prompt — report both.
- **Sample bias**: NutriBench is US-centric. German/EU foods underrepresented. Supplement with manual EU set in Phase B.

---

## Next Concrete Step

Start with Phase A.1 — it's pure automation, fastest feedback, and the model matrix alone may change our model choice before we even need competitor data.

```bash
cd flexenlab/evals
TARGET=nutribench MODELS=gemini-3-flash-preview,gemini-2.5-flash,gpt-5-mini,claude-sonnet-4-5 \
  npx braintrust eval nutribench.eval.ts
```
