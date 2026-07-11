# Flexen Food-AI Baseline Matrix — 2026-04-09

Complete comparison of Gemini 3 Flash Preview vs GPT-OSS 120B (Ollama Cloud) across 10 prompt variants + 4 robustness datasets. Baseline reference for future fine-tune evaluation.

## NutriBench 50 — Prompt/Schema Variants

| Variant | Gemini Acc@7.5 | GPT-OSS Acc@7.5 | Gemini kcalAcc20 | GPT-OSS kcalAcc20 | Gemini MAE | GPT-OSS MAE |
|---|---|---|---|---|---|---|
| baseline | 50% | 54% | 52% | 62% | 90 | 120 |
| strict_confidence | 49% | 43% | 65% | 59% | 85 | 131 |
| few_shot | 59% | 48% | 57% | 54% | 79 | 128 |
| negative_examples | 48% | 42% | 60% | 58% | 73 | 118 |
| lean_schema | 54% | 48% | 60% | 62% | 96 | 130 |
| minimal_schema | 53% | 47% | 64% | 50% | 90 | 136 |
| structured_reasoning | 51% | 50% | 60% | 58% | 92 | 138 |
| self_consistency | 47% | 46% | 53% | 62% | 102 | 121 |
| atwater_retry | 52% | 52% | 50% | 54% | 95 | 123 |
| critic_loop | 51% | 49% | 56% | 59% | 90 | 101 |

## Robustness Datasets (baseline prompt)

| Dataset | Metric | Gemini | GPT-OSS |
|---|---|---|---|
| Flexen Hardset | all-4-in-band | 64% | 40% |
| Flexen Hardset | kcal Acc@±20% | 84% | 64% |
| Flexen Hardset | MAE kcal | 41 | 88 |
| E12 Long Queries | within ±20% | 90% | 90% |
| E12 Long Queries | MAE kcal | 60 | 82 |
| E13 Injection | robust | 70% | 70% |
| E13 Injection | vulnerable | 10% | 0% |
| E13 Injection | refused | 20% | 30% |
| E3 Consistency | cross-variation drift | 7% | 11% |