# Flexen Food-AI — Next Steps Implementation Plan
**Erstellt**: 2026-04-09
**Basiert auf**: [BENCHMARK_REPORT_2026_04_09.md](./BENCHMARK_REPORT_2026_04_09.md)

## Executive Summary

Der Benchmark hat bestätigt was wir vermutet haben: **Gemini 3 Flash Preview ist der Champion**. Kein Modell-Swap nötig. Aber er hat drei neue Hebel freigelegt:

1. **Smart Router ist jetzt verantwortbar** — wir haben konkrete Zahlen für die Qualität jedes Budget-Modells.
2. **Fine-Tuning auf `gpt-oss:120b`** ist ein legitimer 3-6-Monats-Pfad (datensouverän, praktisch kostenlos).
3. **Benchmark-Infrastruktur steht** — wir können jedes zukünftige Modell/Prompt-Change in <30 Min gegen die Baseline testen.

Der folgende Plan ist nach **Impact × Aufwand** sortiert. Sofort-Maßnahmen erfordern keine User-Entscheidung und keine Architekturänderung.

---

## Phase 1 — Sofortmaßnahmen (diese Woche, ~1-2 Tage Arbeit)

### 1.1 — Benchmark-Ergebnisse als Production-Baseline speichern

**Warum**: Wir brauchen einen Referenzpunkt gegen den jedes zukünftige Experiment gemessen wird. Ohne Baseline können wir Regressionen nicht erkennen.

**Was**:
- [sweep_results.csv](../evals/sweep_results.csv) als "baseline_2026_04_09.csv" archivieren
- Primary-Metriken (54.59% Acc@7.5g, 65.55% kcal Acc20, 95.45 MAE kcal, $4.68/1k) in `flexenlab/evals/BASELINE.md` festschreiben
- Braintrust-Experiment URL bookmarken (public share link generieren)

**Aufwand**: 30 Min
**Outcome**: Jede künftige Änderung im Food-AI-Stack kann sofort gegen eine solide Baseline gebencht werden.

### 1.2 — GPT-5-Familie aus allen Plänen streichen

**Warum**: Der Benchmark hat unwiderlegbar gezeigt, dass Reasoning-Modelle für Food-Estimation miserabel sind. Zeit nicht weiter mit A/B-Tests verschwenden.

**Was**:
- `MASTER_PLAN.md` updaten: GPT-5.x als "killed" markieren mit Begründung „Reasoning-Overhead kontraproduktiv für strukturierte Food-Output-Tasks"
- Aus jeder Router-Planung streichen

**Aufwand**: 10 Min
**Outcome**: Klareres Fokus auf die Modelle die tatsächlich funktionieren.

### 1.3 — Nightly Benchmark CI einrichten

**Warum**: Wenn Google ein Silent-Update an Gemini 3 Flash Preview deployt, wollen wir das innerhalb von 24h wissen — nicht erst wenn User sich beschweren.

**Was**:
- GitHub Action in `flexenlab/.github/workflows/benchmark-nightly.yml`:
  - Trigger: täglich 03:00 UTC + auf jeden Push in `flexenlab/evals/`
  - Läuft `nutribench_multi.eval.ts` mit `gemini-3-flash-preview` gegen 100-Case Sample
  - Postet Delta zur Baseline an OpenClaw/Telegram wenn |delta Acc@7.5| > 2 Punkte
- 100 Cases (nicht 500) damit CI schnell bleibt und API-Kosten unter $0.50/Monat
- Secrets: `GEMINI_API_KEY` + `BRAINTRUST_API_KEY` in Repo-Secrets

**Aufwand**: 2-3h (inkl. Telegram-Integration via bestehende OpenClaw-Infrastruktur)
**Outcome**: Automatisches Regression-Warning System. Nie wieder Silent-Quality-Drops.

### 1.4 — „Competitive Accuracy"-Marketing-Claim vorbereiten

**Warum**: Wir haben jetzt echte Zahlen. Cal AIs Marketing ist nicht zitierfähig. Unser ist.

**Was**:
- Landing-Page-Text: „Flexen achieves **65.55% kcal accuracy within ±20%** on NutriBench v2, compared to GPT-4o CoT (66.82%) reported in the original NutriBench paper — while delivering responses in under 2 seconds."
- **Wichtig**: Noch KEIN Vergleich gegen Cal AI / MyFitnessPal da wir die nicht benchmarked haben. Das kommt in Phase 3.

**Aufwand**: 30 Min Copywriting
**Outcome**: Erster zitierfähiger Quality-Claim für Marketing/Fundraising.

---

## Phase 2 — Smart Router B4.2 (2-4 Wochen, der große Kostenhebel)

Bisher war Smart Router „theoretisch eine gute Idee". Jetzt haben wir die Daten um ihn rational zu designen.

### 2.1 — Router-Logik basierend auf Benchmark-Daten

**Konkrete Eskalations-Regeln**:
```
Stage 1: gpt-4.1-mini ($0.54/1k, 37.20% Acc@7.5g, 54.00% kcal Acc20)

ESCALATE TO Gemini 3 Flash Preview if ANY:
  - confidence != HIGH
  - kcal < 20 OR kcal > 2500 (out-of-range sanity)
  - |protein*4 + carbs*4 + fat*9 - kcal| / kcal > 0.15 (Atwater drift)
  - Missing required fields
  - Query has brand token (Big Mac, Chipotle, etc.) → brand queries need best model
  - Query length > 100 chars (complex meals)
```

**Warum nicht `gemini-2.5-flash-lite` als Stage 1?** Weil es nur 29.80% kcal Acc20 hat (vs 54% bei gpt-4.1-mini). Der Eskalations-Rate wäre so hoch dass der „Budget-Saving"-Effekt verpufft.

**Warum nicht `gpt-4.1-nano`?** 36.40% kcal Acc20 ist grenzwertig. Marginal billiger ($0.13 vs $0.54) aber doppelt so hoher MAE kcal. Nicht wert.

### 2.2 — Projected Savings (basierend auf ~1000 geloggten Queries)

Annahme: 60% der Queries sind „einfach" (Stage 1 hält), 40% eskalieren.
- Stage 1 cost: 1000 × $0.00054 = **$0.54**
- Stage 2 cost: 400 × $0.00468 = **$1.87**
- **Total: $2.41** vs **$4.68** (alles Gemini 3 Flash)
- **Savings: 48.5%**

Wenn die E3 Cache bereits 70% der Queries vorab abfängt:
- 300 echte Queries × $2.41/1k = **$0.72** (gegen $1.40 ohne Router)
- **Savings on top of cache: 49%**

### 2.3 — Implementation

**Code-Änderungen**:
1. Neue Methode in `food_recognition_service.dart::estimateFromTextRouted()`:
   - Ruft zuerst `gpt-4.1-mini` via neue Cloud Function `estimateFoodAICheap`
   - Prüft Eskalations-Regeln in Dart
   - Fallback auf existierende `estimateFoodAI` wenn eskaliert wird
2. Neue CF in `functions/index.js::estimateFoodAICheap` — mirror von `estimateFoodAI` aber mit OpenAI GPT-4.1-mini SDK
3. Feature flag `enable_smart_router_v1` in `FeatureFlagsService` (default `false` initial, gradual rollout)
4. Analytics events: `food_router_stage1_hit`, `food_router_stage2_escalation` mit Eskalations-Grund

**PostHog A/B-Test-Design**:
- 50/50 Split zwischen Router-On und Router-Off
- Messe: avg cost per query, avg MAE kcal (via User-Korrekturen), correction rate
- **Ship criteria**: Correction rate gleich oder besser UND cost ≥ 30% niedriger

**Aufwand**: 3-5 Tage Dev + 1 Woche A/B-Run für statistische Signifikanz
**Outcome**: Real-Production-Kosten von $4.68/1k auf ~$2.40/1k halbieren ohne Qualitätsverlust.

### 2.4 — Risiken & Mitigations

| Risiko | Mitigation |
|---|---|
| OpenAI-Outage killt Stage 1 → alle Queries eskalieren | Feature-Flag `enable_smart_router_v1=false` als instant kill |
| GPT-4.1-mini ist schlechter bei EU/DE-Foods | Language-Detection → nur Englisch in Stage 1, Deutsch direkt in Stage 2 |
| A/B-Sample-Bias (nur Premium-User eskalieren viel) | Stratifizierte Analyse nach Subscription-Tier |
| OpenAI-Preise ändern sich | Pricing in CF aus Firestore config laden, nicht hardcoded |

---

## Phase 3 — Competitor-Benchmark (nach Smart Router Ship, ~1 Woche)

Jetzt wo wir unsere eigene Baseline haben, ist der nächste logische Schritt: sind wir wirklich besser als die Konkurrenz?

### 3.1 — Phase B aus Competitive Benchmark Plan

Details in [COMPETITIVE_BENCHMARK_PLAN.md](./COMPETITIVE_BENCHMARK_PLAN.md).

**Zusammenfassung**:
- 150 Queries (100 aus PostHog-Logs, 50 hand-picked canonical)
- Manuell durch Cal AI, MyFitnessPal, Yazio, MacroFactor, Lose It jagen
- Ground Truth aus NutriBench / USDA / Brand-PDFs
- Scoring: Win Rate (% Queries wo Flexen am nähesten ist)

**Aufwand**: 3-5 Tage (hauptsächlich manuelle Daten-Collection)
**Outcome**: **DIE** Marketing-Zahl: „Flexen ist X% genauer als Cal AI" oder „Flexen matches MyFitnessPal accuracy at 1/10 user effort".

### 3.2 — Ergebnis-Szenarien

**Szenario A: Wir sind Top-3 auf Accuracy**
→ Pricing-Power. Wir können Premium-Pricing ($10-15/Monat) rechtfertigen gegen Cal AIs $7.99.

**Szenario B: Wir sind im Mittelfeld**
→ Differenzierung über Features (AI Chat, Adapty Subscription, deutscher Markt) statt Accuracy. Focus auf UX.

**Szenario C: Wir sind schlechter als Cal AI**
→ Fine-Tune-Pfad (Phase 4) wird Top-Priorität. Accuracy-Gap ist existenzielle Bedrohung.

---

## Phase 4 — Fine-Tuning auf gpt-oss:120b (3-6 Monate, strategische Wette)

Die spannendste Entdeckung aus dem Benchmark: **gpt-oss:120b ist 94% so gut wie Gemini 3 Flash Preview**. Das ist Fine-Tune-ready.

### 4.1 — Warum das interessant ist

1. **Datensouveränität**: Open Weights, wir können es selbst hosten. Kein Google-Lock-in.
2. **Kosten**: Nach Fine-Tune-Investition sind marginal costs = $0 (nur Compute).
3. **Proprietärer Moat**: Unser Fine-Tune-Dataset (user corrections) ist einzigartig und kann nicht von Konkurrenten kopiert werden.
4. **EU-Compliance**: Kein Datentransfer in die USA, hilft bei DSGVO-kritischen Enterprise-Deals.

### 4.2 — Voraussetzungen

Bevor wir Fine-Tunen, brauchen wir:

1. **E14 Correction Training Loop**: User können falsche Kalorienwerte korrigieren. Korrektur-Dataset wird gesammelt. **Muss vor Fine-Tune stehen.**
2. **Correction UX**: Einfacher Tap „Das stimmt nicht → richtiger Wert". Schon in Produktplanung, muss priorisiert werden.
3. **~10k korrigierte Datapoints**: Grobe Regel. Bei 1000 MAU und 5% Correction Rate × 10 Queries/User/Monat = 500 corrections/Monat → 20 Monate. Alternative: Bootstrap mit NutriBench v2 + USDA direkt.
4. **GPU-Training-Infrastruktur**: Entweder Ollama Cloud Fine-Tune API (sobald sie das anbieten), oder self-hosted auf A100 (mieten, nicht kaufen).

### 4.3 — Training Plan

1. **Phase 4a — Dataset Bootstrap (4 Wochen)**:
   - 11k NutriBench v2 Samples → direkt trainingsreif (public dataset)
   - 5k USDA-Direct-Lookups für brand foods
   - = 16k samples als Basis
2. **Phase 4b — First Fine-Tune (2 Wochen)**:
   - LoRA adapter auf gpt-oss:120b base
   - Training auf NutriBench + USDA
   - Evaluate gegen Hold-Out (500 cases)
   - **Ziel**: Match Gemini 3 Flash Preview Acc@7.5g auf NutriBench (54.59%)
3. **Phase 4c — User-Correction Loop (ongoing)**:
   - Monatlich Re-Training mit akkumulierten Korrekturen
   - A/B gegen Production-Modell
   - Ship wenn 2 Monate in Folge > Production Accuracy

**Aufwand**: 4-6 Monate, ~$2-5k Training-Kosten insgesamt (bei gemieteter A100)
**Outcome**: Unabhängigkeit von Google, proprietärer Moat, langfristig 90%+ Kostensenkung.

### 4.4 — Wann starten?

**NICHT JETZT.** Erst wenn:
- Smart Router gelaufen ist (dann wissen wir wie viel Kosten bleiben zu senken sind)
- Correction UX shipped ist (Datasammlung läuft)
- Competitive Benchmark abgeschlossen (wir wissen ob Accuracy-Gap geschlossen werden muss)

**Realistischer Start**: Q3/Q4 2026, wenn alle Voraussetzungen stehen.

---

## Phase 5 — Gemini 3 Pro Preview Retry (1 Tag, niedrig-Prio)

Im Full-Run hatte Gemini 3 Pro Preview **70% Error-Rate durch Rate-Limits** (151/500 cases). Die gelaufenen Cases zeigten aber: **54.30% Acc@7.5g, 74.83% kcal Acc@±20%** — letzteres ist **deutlich besser als Gemini 3 Flash Preview** (65.55%).

**Was wir wissen wollen**: Ist Gemini 3 Pro wirklich 9 Punkte besser bei kcal Accuracy? Das wäre ein potenzieller Swap-Kandidat für den Stage-2-Escalation-Pfad im Smart Router.

**Was wir tun**:
- Braintrust mit einem Throttle von 1 req/s (Rate-Limit-friendly) gegen 200-Case-Sample
- Wenn kcal Acc20 bestätigt ~75% liegt: in Smart Router Phase 2 als Stage 2 statt Gemini 3 Flash Preview aufnehmen (3.4× teurer aber 9 Punkte besser)
- Wenn es unter 70% fällt: Pro Preview bleibt aus dem Router raus

**Aufwand**: 30 Min Script-Anpassung + 2-3h Laufzeit
**Outcome**: Klarheit ob wir ein noch besseres Production-Modell haben.

---

## Offene Fragen (brauchen User-Input)

1. **Soll der Smart Router OpenAI GPT-4.1-mini nutzen oder lieber ein EU-Provider?** GPT-4.1-mini ist technisch am besten geeignet, aber für DSGVO-harte EU-Strategie vielleicht unpassend. Alternative: Mistral Small (hatten wir nicht im Full-Sweep).
2. **Wie dringend ist Competitive Benchmark?** Phase 3 erfordert ~5 Tage fokussierte manuelle Arbeit. Wenn vorher Launch ansteht, könnte man's auf nach-Launch schieben.
3. **Fine-Tune Interest Level?** Phase 4 ist eine strategische Wette über Monate. Lohnt nur wenn entweder (a) Kosten wirklich explodieren, oder (b) wir uns positionieren wollen als „Datensouveräne AI-App" für deutschen Markt.

---

## Zusammenfassung: Was ich empfehle

**Diese Woche:**
- ✅ Baseline archivieren (30 Min)
- ✅ GPT-5 Familie begraben (10 Min)
- ✅ Nightly Benchmark CI einrichten (3h)
- ✅ Marketing-Claim für Landing Page vorbereiten (30 Min)

**Nächste 2-4 Wochen:**
- 🎯 Smart Router B4.2 (gpt-4.1-mini → Gemini 3 Flash Preview) implementieren und A/B-testen
- 🎯 Gemini 3 Pro Preview Retry mit Rate-Limit-Throttle

**Nach Smart Router Ship (4-8 Wochen):**
- 📊 Phase 3 Competitive Benchmark (Cal AI, MyFitnessPal Vergleich)

**Q3/Q4 2026 (falls strategisch relevant):**
- 🧠 Fine-Tuning auf gpt-oss:120b mit user correction data

**Nicht mehr anfassen:**
- ❌ Claude (nicht konkurrenzfähig für Food)
- ❌ GPT-5 Reasoning (gebrochen für diese Domäne)
- ❌ Kleinere Ollama-Modelle (ministral-3, gemma3:27b — zu schlecht)
