// Long-prompt variant — inject more examples + explicit edge cases into the
// food prompt and test if accuracy improves on NutriBench.
//
// Used by run_variance.sh for the 4th run (LONG_PROMPT=1 variant).
//
// Note: this file is NOT a standalone eval — it just exports an augmented
// COT_INSTRUCTIONS block. nutribench_multi.eval.ts checks for LONG_PROMPT env
// and replaces its COT block.
export const LONG_COT_INSTRUCTIONS = `ESTIMATION PROCESS (mandatory steps):
1. IDENTIFY: Food item(s), preparation method, cultural context from language.
2. WEIGH: Estimate serving weight in grams. State reasoning briefly.
3. LOOKUP: Recall per-100g macros from USDA reference data.
4. CALCULATE: Multiply per-100g values by (serving_weight / 100).
5. VERIFY: protein(g)*4 + carbs(g)*4 + fat(g)*9 must be within 10% of kcal. If not, recalculate kcal from macros.
6. CONFIDENCE: HIGH (well-known food, clear portion), MEDIUM (some ambiguity), LOW (complex/unclear).

ACCURACY RULES:
- Cooked chicken breast = 31g protein per 100g. Lean beef = 26g/100g. Eggs = 13g/100g.
- Cooking method matters: fried adds 10-15% weight in oil (~120 kcal per tbsp absorbed). Grilled/baked adds minimal fat.
- US portion sizes by default.

CALIBRATION EXAMPLES (anchor your estimates to these):
- 1 large banana (~120g): 105 kcal, 27g carbs, 1g protein, 0g fat
- 1 medium apple (~180g): 95 kcal, 25g carbs, 0.5g protein, 0.3g fat
- Big Mac meal (burger only): 563 kcal, 45g carbs, 26g protein, 33g fat
- Chipotle chicken bowl (standard): 625 kcal, 60g carbs, 45g protein, 22g fat
- Starbucks Tall Latte: 150 kcal, 15g carbs, 10g protein, 6g fat
- 100g cooked white rice: 130 kcal, 28g carbs, 2.7g protein, 0.3g fat
- 100g cooked pasta: 158 kcal, 31g carbs, 6g protein, 1g fat
- 1 slice whole wheat bread (~30g): 80 kcal, 14g carbs, 4g protein, 1g fat
- 1 tbsp olive oil (~14g): 120 kcal, 0g carbs, 0g protein, 14g fat
- 1 cup whole milk (240g): 150 kcal, 12g carbs, 8g protein, 8g fat
- 100g grilled salmon: 208 kcal, 0g carbs, 22g protein, 13g fat
- 100g scrambled eggs: 155 kcal, 1g carbs, 13g protein, 11g fat

EDGE CASES TO HANDLE CAREFULLY:
- If query uses mass in grams (e.g. "150g banana"): USE THAT MASS. Do NOT default to standard portion.
- If query has multiple items ("with", "and", ","): SUM all components, don't pick one.
- If query mentions beverages (water, tea without sugar): ADD 0 kcal for them but still list them.
- If query mentions cooking method ("fried", "deep-fried", "battered"): ADD oil absorption (10-25% weight increase).
- If query is in non-English language: DO NOT assume US portion, use regional portion norms.
- If servings are specified ("2 eggs", "3 slices"): MULTIPLY per-unit values.
- If food is ambiguous ("salad", "soup", "stew"): default to a reasonable US average composition but mark confidence MEDIUM.

NEGATIVE EXAMPLES (common failure modes to avoid):
- "1 apple" → NOT 50 kcal (too low, that's 100g not full apple)
- "grilled chicken salad" → NOT just salad kcal, MUST include chicken (~150-200g cooked)
- "fried rice" → NOT plain rice kcal, MUST add oil (+80-120 kcal per cup)
- "smoothie" → NOT 50 kcal, MUST account for fruit + milk/yogurt base (typically 200-350 kcal)

Return ONLY the JSON object.`;
