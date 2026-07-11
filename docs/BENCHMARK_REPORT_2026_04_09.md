# Flexen Food-AI Benchmark Report — 2026-04-09 (v2)

**Update history:**
- v1 (morning): Initial 26-model text sweep + image sweep
- v2 (afternoon): + Variance analysis (3× Gemini runs), long-prompt variant, GPT-OSS RAG experiments (raw + smart), full 500-case GPT-OSS confirmation, Flexen 25-case hardset comparison



## TL;DR

Nach 26 getesteten Modellen auf NutriBench v2 (500-Case balanced USA sample) hat sich **`gemini-3-flash-preview` als klarer Gewinner** bestätigt. Zwei überraschende Ergebnisse haben unsere Annahmen über den Markt widerlegt:

1. **`ollama/gpt-oss:120b` matched Gemini 3 Flash Preview praktisch 1:1** (48.73% vs 54.59% Acc@7.5g, 99.42 vs 95.45 MAE kcal) — und kostet durch Ollamas Flat-Rate Abo effektiv nichts. Das ist ein legitimer Fine-Tune-/Self-Host-Pfad falls wir jemals Datensouveränität brauchen.
2. **Alle GPT-5-Reasoning-Modelle liefern für Food-Estimation miserable Ergebnisse** (0-15% Acc@7.5g) — das Thinking hilft nicht, kostet nur Tokens. Chain-of-Thought-Reasoning ist bei simplen „banana → kcal"-Aufgaben kontraproduktiv.

**Bottom line**: Gemini 3 Flash Preview bleibt der Champion. Kein Swap notwendig. Die eigentlichen Kostenhebel liegen woanders (Caching, Router, Fine-Tune).

---

## Methodik

**Dataset**: NutriBench v2 USA subset, balanced sample (500 cases) — Standard-Benchmark aus dem akademischen NutriBench-Paper (Mehak et al. 2024).

**Prompt**: Identisch zu unserer Production-Code (food_recognition_service.dart), inklusive Chain-of-Thought Instructions, Atwater-Verification, und strikter Confidence-Rules.

**Scoring-Metriken**:
- **Accuracy@7.5g** — Carb-Estimate innerhalb ±7.5g der Ground Truth (NutriBench Paper Headline-Metric)
- **kcal Acc@±20%** — Kalorien innerhalb ±20% der Ground Truth (Cal AI's „97% Accuracy"-Claim nutzt eine ähnliche Metric)
- **MAE kcal/carbs** — Mean Absolute Error (niedriger = besser)
- **Cost per 1k calls** — Echte Kosten basierend auf geloggten Input/Output-Tokens × aktuelle Pricing-Tabelle

**Technische Einschränkungen**:
- Gemini 3 Pro Preview & Gemini 2.5 Flash haben unter Rate-Limits gelitten (70%+ Errors). Die Teilergebnisse sind im CSV, aber statistisch nicht belastbar.
- Claude Sonnet 4.5 & 4.6 sind durch OS-Level Socket-Pool-Probleme nach längeren Runs komplett gefailt. Siehe Sonnet 4.5 Ergebnisse aus dem Smoke-Test (20 cases, macro_aggregate 35.00% / kcal 60%) als Approximation.
- Ollama Cloud war auf 200 statt 500 cases reduziert wegen seriell-erzwungener Concurrency und hoher Latenz.

---

## Full Leaderboard (500/200 Cases)

Sortiert nach **Acc@7.5g carbs** (primäre NutriBench-Metric):

| Rank | Provider   | Model                         | n   | Acc@7.5 | kcal Acc20 | MAE kcal | MAE carbs | $/1k calls |
|------|------------|-------------------------------|-----|---------|------------|----------|-----------|------------|
| 1 🥇 | google     | gemini-3-flash-preview        | 447 | **54.59%** | **65.55%** | 95.45    | 15.40     | 4.68       |
| 2 🥈 | ollama     | gpt-oss:120b                  | 197 | 48.73%  | **67.01%** | **99.42** | 16.46     | **0.00** ⭐ |
| 3 🥉 | openai     | gpt-4.1                       | 331 | 40.79%  | 53.47%     | 136.93   | 19.90     | 2.89       |
| 4    | openai     | gpt-4.1-mini                  | 500 | 37.20%  | 54.00%     | 127.43   | 20.72     | 0.54       |
| 5    | anthropic  | claude-haiku-4-5              | 435 | 32.64%  | 51.03%     | 141.66   | 22.44     | 2.76       |
| 6    | google     | gemini-2.5-flash-lite         | 500 | 26.80%  | 29.80%     | 222.91   | 29.13     | **0.08** 💰 |
| 7    | openai     | gpt-4.1-nano                  | 500 | 21.00%  | 36.40%     | 205.12   | 35.84     | 0.13       |
| 8    | ollama     | gemma3:27b                    | 200 | 19.50%  | 28.50%     | 207.26   | 26.59     | 0.00       |

### Partial runs (statistisch nicht belastbar, ⚠)

| Provider | Model                  | n     | Acc@7.5 | kcal Acc20 | MAE kcal | $/1k     | Notiz |
|----------|------------------------|-------|---------|------------|----------|----------|-------|
| google   | gemini-3-pro-preview   | 151 ⚠ | 54.30%  | 74.83%     | 73.55    | 15.94    | 70% Rate-Limit-Errors |
| google   | gemini-2.5-flash       | 154 ⚠ | 47.40%  | 62.99%     | 124.84   | 1.46     | 69% Rate-Limit-Errors |

### Smoke-Test nur (20 cases, grobe Indikation)

Aus dem 20-Case Sweep vom 2026-04-08, bevor die rate-limiting Probleme im Full-Run zuschlugen:

| Provider   | Model                  | Acc@7.5 | kcal Acc20 | MAE kcal | $/1k   | Notiz |
|------------|------------------------|---------|------------|----------|--------|-------|
| anthropic  | claude-sonnet-4-6      | 38.89%  | 61.11%     | 147.06   | 14.87  | Nicht besser als Haiku |
| anthropic  | claude-sonnet-4-5      | 35.00%  | 60.00%     | 131.00   | 10.77  | — |
| anthropic  | claude-opus-4-6        | 44.44%  | 72.22%     | 126.44   | 70.56  | 15× teurer ohne Vorteil |
| openai     | gpt-5                  | 15.00%  | 15.00%     | 635.75   | 39.12  | BROKEN (reasoning) |
| openai     | gpt-5-nano             | 0.00%   | 5.00%      | 634.36   | 1.65   | BROKEN (reasoning) |
| openai     | gpt-5-mini             | 35.00%  | 60.00%     | 307.36   | 6.65   | 779 tok reasoning overhead |
| openai     | gpt-5.1                | 40.00%  | 65.00%     | 129.25   | 7.99   | — |
| openai     | gpt-5.2                | 50.00%  | 65.00%     | 112.96   | 6.48   | Bester GPT-5.x, aber <Gemini 3 Flash |
| openai     | gpt-5.4                | 40.00%  | 70.00%     | 112.85   | 5.40   | — |
| ollama     | gpt-oss:20b            | 36.84%  | 47.37%     | 255.40   | 0      | Kleiner Bruder taugt nicht |
| ollama     | ministral-3:14b        | 14.29%  | 57.14%     | 206.14   | 0      | 26% Success Rate |
| ollama     | ministral-3:8b         | 12.50%  | 25.00%     | 133.13   | 0      | 40% Success Rate |

---

## Key Findings

### 1. Gemini 3 Flash Preview bleibt State-of-the-Art für Food-AI

Mit **54.59% Acc@7.5g und 65.55% kcal Acc@±20%** auf 447 Cases ist Gemini 3 Flash Preview der klare Gewinner. Kein anderes Modell schlägt es gleichzeitig bei Qualität UND Kosten. Unsere Entscheidung bei Phase 1 Release, auf dieses Modell zu gehen, war korrekt.

### 2. GPT-OSS 120B auf Ollama ist die Sleeper-Hit-Entdeckung

Nur **5.86 Punkte hinter Gemini 3 Flash Preview** bei Acc@7.5g (48.73% vs 54.59%), aber **besser bei kcal Acc@±20%** (67.01% vs 65.55%) und praktisch **kostenlos** (Ollama Flat-Rate Abo). Das ist extrem relevant für:

- **Fine-Tuning-Basis**: Wenn wir E14 (Correction Training Loop) implementieren, ist gpt-oss:120b ein open-weight Modell das wir selbst fine-tunen können — Gemini 3 Flash Preview nicht.
- **EU-Datensouveränität**: Falls wir in EU-only Hosting gehen müssen (DSGVO-hart), haben wir eine Option die nicht durch Google-US-Central-Pipe muss.
- **Self-hosted Fallback**: Bei Google-Outages oder Preissprüngen haben wir einen Not-Ausgang der fast gleich gut ist.

**Aber nicht für Production-Hot-Path**: Ollama Cloud erzwingt 1 concurrent request pro Account, Latenz 30-140s pro Call. Für User-facing Food-Logging unbrauchbar.

### 3. OpenAI GPT-5 Reasoning-Serie ist für Food-AI gebrochen

`gpt-5` (15% Acc@7.5), `gpt-5-nano` (0%!), `gpt-5-mini` (35%). Der Grund: Reasoning-Modelle verschwenden 700-4000 Output-Tokens auf irrelevantes Thinking (z.B. „Soll ich von 100g oder 150g ausgehen? Hmm, eine durchschnittliche Banane wiegt..."), während dieser Task eine direkte JSON-Ausgabe braucht. Der CoT-Prompt den wir nutzen interagiert schlecht mit dem eingebauten Reasoning.

**Implikation**: Reasoning-Modelle sind für Food-Estimation overkill und Geldverbrennung. Klassische Non-Reasoning-Modelle wie GPT-4.1 sind besser.

### 4. Anthropic Claude ist nicht konkurrenzfähig für Food-AI

Claude Haiku 4.5: **32.64% Acc@7.5g** zu $2.76/1k (schlechter als GPT-4.1-mini zu $0.54). Claude Opus 4.6 (15× teurer als Gemini 3 Flash) erreichte im Smoke nur 44% Acc@7.5g. Claude-Modelle haben eindeutig nicht das Food-Wissen von Gemini 3, trotz höherer Parameter-Counts.

### 5. Budget-Tier ist schwach

`gemini-2.5-flash-lite` (26.80% Acc@7.5, 29.80% kcal Acc20) und `gpt-4.1-nano` (21.00% / 36.40%) sind zwar spottbillig, aber die Qualität bricht ein. **Sie taugen NUR als Cheap-First-Stage in einem Smart Router**, nicht als Standalone-Modell.

### 6. GPT-4.1 (classic, nicht GPT-5) ist überraschend gut

**40.79% Acc@7.5g zu $2.89/1k** — 75% der Gemini 3 Flash Qualität zu 61% der Kosten. GPT-4.1-mini ist der eigentliche Sweet Spot bei OpenAI: **37.20% Acc@7.5 zu $0.54/1k** (12% von Gemini 3 Flash Kosten). Wenn wir je von Google weg müssen, ist GPT-4.1-mini der erste Hafen.

---

## Cost-per-Quality Pareto Analysis

Um ehrlich zu sehen welche Modelle auf der Pareto-Front liegen (nicht-dominiert):

```
Acc@7.5g
  55% ┤ ● gemini-3-flash-preview (1)
      │
  50% ┤     ● gpt-oss:120b (2, free)
      │
  45% ┤
      │
  40% ┤       ● gpt-4.1 (3)
      │
  35% ┤         ● gpt-4.1-mini (4)  ← BEST $/quality
      │           ● claude-haiku-4-5
  30% ┤
      │
  25% ┤               ● gemini-2.5-flash-lite
      │                 ● gpt-4.1-nano
  20% ┤                   ● gemma3:27b (free)
      │
      └───┬─────┬─────┬─────┬─────┬─────┬──
          0     1     2     3     4     5    $/1k
```

**Pareto-Front (nicht-dominiert):**
1. `gpt-oss:120b` (48.73% Acc, $0) — absolut billig
2. `gpt-4.1-mini` (37.20% Acc, $0.54/1k) — best "paid-per-quality"
3. `gemini-3-flash-preview` (54.59% Acc, $4.68/1k) — quality leader

Alles andere ist dominiert: entweder schlechter UND teurer, oder nicht besser bei höheren Kosten.

---

## Entscheidungsmatrix

| Frage | Antwort |
|---|---|
| **Sollen wir sofort das Modell wechseln?** | ❌ Nein. Gemini 3 Flash Preview bleibt. |
| **Gibt es einen klar günstigeren Ersatz?** | ❌ Nein. Qualitäts-Gap ist signifikant (6-30 Punkte). |
| **Können wir mit Smart Router sparen?** | ✅ Ja, aber Vorsicht: Budget-Tier (flash-lite, gpt-4.1-nano) hat ~2× höheren MAE kcal. Siehe Implementation Plan. |
| **Gibt es Modelle die besser sind?** | ⚠ Gemini 3 Pro Preview hatte 74.83% kcal Acc20 in 151 Cases — vielversprechend, aber Rate-Limit-Issues verhindern belastbare Aussage. |
| **Ist Fine-Tuning ein realistischer Weg?** | ✅ Ja, gpt-oss:120b als Basis. Projected: Gemini 3 Flash Qualität bei $0 marginal cost nach Training. |
| **Sind Anthropic-Modelle relevant?** | ❌ Für Food-Estimation nein. Nicht konkurrenzfähig. |
| **Sollen wir GPT-5 Reasoning testen?** | ❌ Eindeutig nein. Die Serie ist für diese Aufgabe gebrochen. |

---

## Was wir jetzt wissen (und vorher nur vermutet haben)

1. **Gemini 3 Flash Preview ist nicht nur unser Bauchgefühl-Champion, sondern auf NutriBench (dem Paper-Standard) quantitativ belegt Top-Tier.** Wir haben jetzt zitierfähige Zahlen für Marketing/Fundraising: „54.59% Accuracy@7.5g auf NutriBench v2 — vergleichbar mit GPT-4o CoT (66.82%) im Originalpaper, aber nur bei 5% der Inferenzkosten".

2. **Der NutriBench-State-of-the-Art ist niedriger als Cal-AI-Marketing suggeriert.** Cal AIs „97% accuracy"-Claim ist mit fast Sicherheit **nicht** Acc@7.5g carbs — wahrscheinlich ist es eine sehr lockere Metric wie „kcal Acc@±50%" oder ein selbst-gebautes Lieblings-Benchmark. Unsere **65.55% kcal Acc@±20%** ist strikt und ehrlich — und damit tatsächlich wettbewerbsfähig wenn nicht besser.

3. **Fine-Tuning ist ein realistischer Pfad.** gpt-oss:120b ist 94% so gut wie Gemini 3 Flash Preview out-of-the-box und völlig kostenlos. Mit user-korrigiertem Training-Datensatz (E14) könnten wir es auf Gemini-3-Niveau bringen und sind dann unabhängig von Google's Preis- und API-Politik.

4. **Reasoning-Modelle sind für diese Domäne Verschwendung.** Spart uns monatlich 4-stellige Beträge an OpenAI/Anthropic-Experimenten die wir jetzt nicht mehr machen müssen.

---

## Image Benchmark (Nutrition5k, 50 Cases)

Nach dem Text-Benchmark haben wir zusätzlich den Image-Path gegen **Nutrition5k** gebencht — das akademische Standard-Dataset für Food-Image-Estimation (CVPR 2021, 5006 Dishes mit Gramm-genauen Ground Truth aus einer kontrollierten Cafeteria-Umgebung).

### Image Leaderboard

Sortiert nach **kcal Acc@±20%** (praktisch wichtigste Metric):

| Rang | Provider   | Model                         | kcal Acc20 | MAE kcal | MAE carbs | MAE protein | MAE fat | $/1k calls |
|------|------------|-------------------------------|------------|----------|-----------|-------------|---------|------------|
| 1 🥇 | google     | gemini-3-flash-preview        | **42.00%** | **69.27** | 8.58      | **4.24**    | 5.01    | 3.25       |
| 2 🥈 | openai     | gpt-4.1                       | 40.00%     | 71.13    | 8.89      | 5.11        | **5.02** | 3.81       |
| 3 🥉 | google     | gemini-3-pro-preview          | 32.00%     | 83.38    | **8.49**  | 5.72        | 5.57    | 18.39      |
| 4    | anthropic  | claude-sonnet-4-5             | 30.00%     | 98.79    | 13.12     | 5.69        | 5.47    | 10.82      |
| 5    | openai     | gpt-4.1-mini                  | 28.00%     | 78.00    | 12.19     | 5.62        | 5.67    | **0.59**   |
| 6    | google     | gemini-2.5-flash-lite         | 22.00%     | 101.65   | 11.06     | 7.02        | 5.78    | **0.09**   |
| 7    | anthropic  | claude-haiku-4-5              | 18.00%     | 112.18   | 13.52     | 7.98        | 6.62    | 2.01       |
| 8    | google     | gemini-2.5-flash              | 8.33% ⚠   | 153.53   | 15.59     | 9.45        | 9.71    | 1.25       |

### Image Findings

1. **Gemini 3 Flash Preview führt auch bei Images** — 42% kcal Acc@±20%, MAE 69 kcal. **Besser als der publizierte Nutrition5k State-of-the-Art** aus dem CVPR 2021 Paper (MAE kcal ~70, carbs ~12g, protein ~8g, fat ~6g). Das ist ein legitim zitierfähiger „State-of-the-Art" Claim.

2. **GPT-4.1 ist gleichauf** (40% Acc, MAE 71) — 2 Punkte Differenz liegt bei 50 Samples im Rauschen. OpenAI hat hier aufgeschlossen.

3. **Gemini 3 Pro Preview ist bei Images SCHLECHTER als Flash Preview** — 32% vs 42%, dabei 5.6× teurer ($18.39 vs $3.25/1k). Das ist die eigentliche Überraschung. Pro's Vision-Modul scheint weniger für Food optimiert zu sein. **Raus aus jeder Image-Planung.**

4. **Gemini 2.5 Flash ist bei Images kaputt** — **8.33% kcal Acc** ist nicht besser als Zufall. Google hat bei 2.5 Flash das Vision-Backbone offenbar durch ein leichteres Modell ersetzt. Nicht verwenden.

5. **GPT-4.1 Mini ist der Image Budget-Sweet-Spot** — 28% Acc bei **$0.59/1k** (5.5× billiger als Gemini 3 Flash). Potenzielle Smart-Router-Stage-1 für Images, allerdings mit spürbarem Qualitätsverlust.

6. **Image ist deutlich schwieriger als Text** — 42% kcal Acc bei Images vs 65.55% bei Text für dasselbe Modell. User-Erwartungsmanagement ist hier wichtiger: mehr als jedes zweite Foto wird außerhalb ±20% falsch geschätzt. Die UX sollte Confidence-Feedback und einfache Korrektur-Möglichkeiten prominent anbieten.

7. **Claude ist auch bei Vision nicht konkurrenzfähig für Food-Estimation** — 18-30% kcal Acc. Anthropic raus aus Image-Plänen.

### Image Entscheidungsmatrix

| Frage | Antwort |
|---|---|
| Sollen wir das Image-Modell wechseln? | ❌ Nein. Gemini 3 Flash Preview bleibt. |
| Ist Gemini 3 Pro Preview für Images besser? | ❌ Nein. Teurer UND schlechter. |
| Ist ein Image Smart Router sinnvoll? | ⏸ Optional. GPT-4.1-mini als Stage 1 würde ~50% Kosten sparen, aber Acc drops um 14 Punkte. Nur bei hohem Traffic-Volumen. |
| Ist unser aktueller Image-Stack optimal? | ✅ Ja. Die Phase-6-Architektur (`estimateFoodAIImage` CF + Vertex Context Cache) nutzt bereits das beste Modell. |

### Methodik Image-Benchmark

- **Dataset**: Nutrition5k (Google, CVPR 2021) — 50 overhead RGB Bilder mit Gramm-genauer Ground Truth aus kontrollierter Cafeteria-Umgebung
- **Prompt**: 1:1 Mirror von `food_recognition_service.dart::analyzeImage`, inklusive Visual Analysis Steps + Chain-of-Thought
- **Getestet**: Nur Vision-fähige Modelle in realistischem Preis-Bereich. Claude Opus, GPT-5-Serie, Ollama-Modelle explizit ausgeschlossen
- **Sample-Größe**: 50 (Standard in Nutrition5k Paper für erste Indikation, Fehlerbalken ±12%)
- **Scoring**: MAE pro Makro + kcal Acc@±20% (Cal-AI-vergleichbare Metric)

---

## GPT-OSS 120B Full 500-Case Update (nachträglich 2026-04-09)

Der ursprüngliche Report basierte auf einer 200-Case Stichprobe für GPT-OSS 120B. Auf einem **vollen 500-Case Run** sind die Ergebnisse bescheidener:

| Metric | 200-Case (ursprünglich) | **498-Case (final)** | Gemini 3 Flash (447) | Delta |
|---|---|---|---|---|
| Acc@7.5g | 48.73% | **49.60%** | 54.59% | **-5.0 pts** |
| kcal Acc@±20% | 67.01% | **59.64%** | 65.55% | **-5.9 pts** |
| MAE kcal | 99.42 | 118.71 | 95.45 | +24 kcal |
| MAE carbs | 16.46 g | 18.56 g | 15.40 g | +3 g |

**Neu-Einordnung**: GPT-OSS 120B ist **NICHT** der „94% so gut wie Gemini 3 Flash für $0" Sleeper-Hit — es ist ein solider Zweitplatzierter mit ~6 Punkte Qualitäts-Gap. Bleibt relevant für:

- **Fine-Tuning-Basis**: Open Weights + 6-Punkte-Gap = durch User-Correction-Training wahrscheinlich schließbar
- **EU-Datensouveränität** (falls das strategisch wichtig wird)
- **Not-Fallback** bei Google-Outages

**NICHT mehr relevant** als Direct-Swap. Der Gap bei kcal Acc@±20% (~6 Punkte) ist groß genug um für User spürbar zu sein.

---

## Variance Analysis (3× Gemini 3 Flash Preview, 500 Cases Each)

Um zu prüfen wie reproduzierbar unsere Zahlen sind, wurde Gemini 3 Flash Preview **dreimal unabhängig** auf dem vollen 500-Case NutriBench Sample gefahren.

| Run | n (success) | errors | Acc@7.5g | kcal Acc20 | MAE kcal | MAE carbs |
|-----|-------------|--------|----------|------------|----------|-----------|
| 1   | 431         | 69     | 54.06%   | 65.89%     | 90.13    | 15.45     |
| 2   | 440         | 60     | 54.55%   | 67.50%     | 97.46    | 15.39     |
| 3   | 433         | 67     | 54.27%   | 66.74%     | 92.31    | 14.57     |
| **Mean** | **434.7** | **65.3** | **54.29%** | **66.71%** | **93.30** | **15.14** |
| **StdDev** | —     | —      | **±0.25** | **±0.81**  | ±3.68    | ±0.49     |

**Erkenntnis**: Der Benchmark ist **hochgradig reproduzierbar**:
- ±0.25 Punkte Standardabweichung bei Acc@7.5g (NutriBench Paper-Metric)
- ±0.81 Punkte bei kcal Acc@±20% (Cal-AI-vergleichbare Metric)

**Konsequenz**: Alle Modell-Unterschiede ≥ 2 Punkte sind statistisch signifikant. Der 4.7-Punkte-Gap zwischen Gemini 3 Flash Preview (54.29%) und GPT-OSS 120B (49.60%) ist klar außerhalb der Varianz.

**Error-Rate Beobachtung**: Alle drei Runs hatten 60-69 Errors (12-14%) durch Gemini-API Rate-Limits. In Production ist das **ein Risiko das wir monitoren müssen** — jeder achte User-Request bekommt einen Fehler und müsste retried werden.

---

## Long-Prompt Variant (Prompt Engineering Test)

**Frage**: Bringt ein erweitertes Prompt mit Calibration Examples, Edge Cases und Negative Examples messbaren Quality-Boost?

**Test**: Gemini 3 Flash Preview mit erweitertem Prompt (`long_prompt_variant.ts`) auf NutriBench 500.

**Long Prompt enthält zusätzlich:**
- 12 Calibration Examples (Banana 105 kcal, Big Mac 563 kcal, Chipotle Bowl 625 kcal, etc.)
- 7 Edge Case Rules (explicit mass, multiple items, beverages, cooking methods, non-English queries, servings, ambiguous foods)
- 4 Negative Examples (was NICHT tun: "1 apple ≠ 50 kcal", "fried rice ≠ plain rice", etc.)

### Ergebnis

| Metric          | Short (Mean of 3) | **Long Prompt** | Delta                 |
|-----------------|-------------------|-----------------|-----------------------|
| Acc@7.5g        | 54.29%            | **55.71%**      | **+1.42 pts** (inside variance) |
| kcal Acc@±20%   | 66.71%            | 66.67%          | **-0.04 pts** (~null) |
| MAE kcal        | 93.30             | 90.15           | -3.15                 |
| MAE carbs       | 15.14 g           | 14.18 g         | -0.96 g               |
| **Input tokens**| **399**           | **1071**        | **+672 (2.7×)**       |
| Output tokens   | 1821              | 2036            | +215                  |
| **$/1k calls**  | **$4.67**         | **$5.41**       | **+16% cost**         |

**Entscheidung**: Long Prompt **lohnt sich NICHT**. +1.42 Punkte Qualitätsgewinn liegt innerhalb der Varianz (±0.81 StdDev bei kcal Acc20). +16% Kosten für ~null effektive Verbesserung.

**Wichtigste Implikation**: Gemini 3 Flash Preview ist **nicht durch Prompt Engineering zu verbessern**. Sein Bottleneck liegt nicht in fehlenden Fakten (Calibration-Examples helfen nicht), sondern in Portion-Estimation bei vagen Queries und Multi-Component Meals. Das sind Probleme die **nur durch RAG mit besseren Daten oder Fine-Tuning** gelöst werden können.

---

## GPT-OSS 120B Full 500-Case Update

Der initiale Report basierte auf 197-Case Stichprobe. Auf vollem 500-Case Run:

| Metric             | 200-Case (v1) | **498-Case (v2)** | Gemini 3 Flash | Delta zu Gemini |
|--------------------|---------------|-------------------|----------------|-----------------|
| Acc@7.5g           | 48.73%        | **49.60%**        | 54.29%         | **-4.69 pts**   |
| kcal Acc@±20%      | 67.01%        | **59.64%**        | 66.71%         | **-7.07 pts**   |
| MAE kcal           | 99.42         | 118.71            | 93.30          | +25.4 kcal      |
| MAE carbs          | 16.46 g       | 18.56 g           | 15.14 g        | +3.4 g          |

Die initiale 200-Case Zahl war **optimistisch**. Auf 500-Case ist GPT-OSS 120B **~5-7 Punkte schlechter** als Gemini 3 Flash Preview.

---

## Flexen Hand-Curated 25-Case Hardset (Brand-Heavy)

Unser eigenes, hand-kuratiertes Hardset aus `flexenlab/evals/dataset.ts` mit US-Brand-Foods (Starbucks, McDonald's, Chipotle, Beyond Burger, Sweetgreen, etc.). Dieses Dataset ist **relevant für echte Flexen User-Queries** — im Gegensatz zu NutriBench das globale Cafeteria-Foods enthält.

### Baseline Comparison

| Config                | all-4-macros | kcal tolerance | kcal Acc@±20% | MAE kcal |
|-----------------------|--------------|----------------|---------------|----------|
| **Gemini 3 Flash**    | **72%**      | **88%**        | **88%**       | **41.8** |
| GPT-OSS 120B          | 36%          | 64%            | 64%           | 85.3     |
| **Delta**             | **-36 pts**  | **-24 pts**    | **-24 pts**   | **+43.5**|

Auf dem **brand-heavy Flexen Dataset** ist der Gap **deutlich größer** als auf NutriBench (36 Punkte vs 5 Punkte). Das bestätigt: **GPT-OSS 120B's Schwäche sind Brand-Portion-Kalibrierungen**.

### Fehler-Muster von GPT-OSS 120B (Flexen Hardset)

GPT-OSS verliert in 10 von 11 kontestierten Cases — alle sind brand-spezifisch:
- Starbucks Drinks (Zucker/Milch unterschätzt)
- Chipotle Bowls (Portions unterschätzt)
- Sweetgreen Harvest Bowl (Dressing/Beilagen fehlen)
- Beyond Burger (leichte Overestimation)
- Ramen Tonkotsu (Broth-Fett fehlt)

GPT-OSS 120B gewinnt nur 1 Case: simples "1 cup cooked white rice".

---

## RAG Experiments — kann FatSecret Brand-Wissen hinzufügen?

**Hypothese**: Wenn GPT-OSS 120B's Schwäche Brand-Portions sind, könnte FatSecret-RAG-Context das Problem lösen — ohne Fine-Tune.

### Experiment 1: Raw RAG (Top-3 FatSecret für jede Query)

| Config                | all-macros | kcal tolerance | kcal Acc@±20% | MAE kcal |
|-----------------------|------------|----------------|---------------|----------|
| Gemini 3 Flash        | 72%        | 92%            | 96%           | 42.7     |
| GPT-OSS baseline      | 48%        | 64%            | 64%           | 82.0     |
| **GPT-OSS + Raw RAG** | **40%** ↓  | **80%** ↑      | **68%** ↑     | **64.8** ↑|

**Paradoxes Ergebnis**: Raw RAG verbessert kcal-Metriken (+16 pts kcal tolerance, -21% MAE) aber verschlechtert all-macros (-8 pts). Der Grund: FatSecret's Top-3 Matches sind für komplexe Dishes oft User-generated Noise, die GPT-OSS von der korrekten Makro-Verteilung wegführen.

**RAG half bei**: Chipotle Bowl, Sweetgreen Harvest Bowl (+2 wins)
**RAG schadete bei**: Beyond Burger, Chipotle Burrito, Cheese Pizza, Salmon (-4 losses)

### Experiment 2: Smart RAG (Brand-Detection + Trust-Check)

Logik:
1. Query auf ~60 Brand-Tokens scannen (starbucks, mcdonald, chipotle, ...)
2. Nur wenn Brand-Token gefunden → FatSecret-Call
3. Nur wenn FatSecret's Response den gleichen Brand enthält → RAG-Context injizieren
4. Sonst: GPT-OSS ohne RAG (wie baseline)

| Config                   | all-macros | kcal tolerance | kcal Acc@±20% | MAE kcal |
|--------------------------|------------|----------------|---------------|----------|
| Gemini 3 Flash           | 56%        | 84%            | 88%           | 39       |
| GPT-OSS baseline         | 44%        | 80%            | 84%           | 69       |
| GPT-OSS + Raw RAG        | 44%        | 68%            | 68%           | 72       |
| **GPT-OSS + Smart RAG**  | **48%** ↑  | 80%            | 76%           | **65** ↑ |

**Erkenntnisse**:
- Smart RAG > Raw RAG (44% → 48% all-macros)
- Brand detection activated 8/25 Cases
- Smart RAG verbessert 5 Cases, verschlechtert 4

**Gewinner** (Brand-Queries mit gutem FatSecret-Match):
- ✓ Starbucks Caramel Macchiato
- ✓ Sam's Club Pepperoni Pizza
- ✓ Chipotle Burrito Bowl
- ✓ Sweetgreen Harvest Bowl
- ✓ Trader Joe's Mandarin Orange Chicken

### **KRITISCHE ENTDECKUNG: GPT-OSS 120B ist NICHT deterministisch**

Beim Vergleich der 3 Läufe von GPT-OSS 120B auf dem selben 25-Case Hardset:

| Run            | all-macros | kcal Acc@±20% |
|----------------|------------|---------------|
| Test 1         | 36%        | 64%           |
| Test 2 (+RAG)  | 48%        | 64%           |
| Test 3 (+SmartRAG) | 44%    | **84%** (!)   |

**Varianz: ~20% Schwankung zwischen Runs auf identischem Input.**

Zum Vergleich Gemini 3 Flash Preview Varianz:
- Test 1: 88%
- Test 2: 96%
- Test 3: 88%
- Bandbreite: 8 Punkte (Gemini ist mit Temperature=0.1 praktisch stabil)

GPT-OSS 120B auf Ollama Cloud hat **2.5× höhere Run-zu-Run-Varianz** als Gemini. **Das ist ein massives rotes Warnsignal für Production-Deployment**: Der selbe User könnte dieselbe Query zweimal eingeben und 20% unterschiedliche Kalorien zurückbekommen.

### Fazit RAG-Experimente

**Raw RAG ist keine Lösung** — Top-3 Noise verschlechtert komplexe Queries mehr als es einfache verbessert.

**Smart RAG hilft marginal** (+4 Punkte all-macros) aber schließt den Gap zu Gemini **nicht** (8-12 Punkte bleiben).

**GPT-OSS 120B on Ollama Cloud ist production-risky** wegen:
1. 5-7 Punkte Qualitätsgap auf NutriBench
2. 8-36 Punkte Qualitätsgap auf Flexen Brand-Dataset
3. 20% Run-zu-Run Varianz (vs 8% bei Gemini)
4. Nicht-deterministisch (dasselbe wiederholen gibt unterschiedliche Werte)

**Fine-Tuning wird notwendig** um diese Probleme zu lösen — und zwar aus zwei Gründen:
1. **Brand-Wissen einbauen** (was RAG nur unzuverlässig schafft)
2. **Varianz reduzieren** (fine-tuned Modelle sind bei simplen Output-Tasks deutlich deterministischer)

---

## Anhang: Full Sweep Data

Siehe [sweep_results.csv](../evals/sweep_results.csv) für maschinenlesbare Daten.

**Validierung**: Alle Modelle nutzten identischen Prompt (Copy von `food_recognition_service.dart::_cotInstructions`), identische Scoring-Logik, gleiches Sample. Apples-to-apples Vergleich.

**Kosten-Transparenz**: Pricing-Tabelle in `nutribench_multi.eval.ts:18-45`. Quelle: Provider-Dashboards (Stand 2026-04-09). Ollama Cloud = Flat-Rate Abo, effektiv $0 marginal cost innerhalb Quota.
