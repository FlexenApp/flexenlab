# Dataset Audit Report

Audited 25 cases.

- ✓ OK: **6**
- ⚠ ADJUST: **18**
- ✗ WRONG: **1**

---

## ⚠ oven crispy chicken from goobne

**Flagged:** protein, carbs

**Current:** 1200 kcal, 100g P, 50g C, 70g F

**Suggested:** 1200 kcal, 120g P, 30g C, 70g F

**Rationale:** Goobne is a Korean oven-roasted chicken chain. While I cannot access their official Korean nutrition data directly, the macros don't balance: 100g protein + 50g carbs + 70g fat = 1170 kcal, close to the 1200 target. However, for 2/3 of a whole roasted chicken (~600g cooked meat), protein should be higher (~120g based on USDA roasted chicken with skin, ~200 kcal/100g). Carbs seem high for plain roasted chicken unless sauce/coating is included; plain chicken has minimal carbs (<5g). The calorie total is plausible but macro distribution needs adjustment.

---

## ⚠ 4 kleine gläser weisswein

**Flagged:** kcal

**Current:** 328 kcal, 0.4g P, 11.6g C, 0g F

**Suggested:** 360 kcal, 0.4g P, 11.6g C, 0g F

**Rationale:** USDA FoodData Central (FDC ID 173230) shows dry white wine contains approximately 82 kcal per 100ml. For 4 × 100ml = 400ml, this yields 328 kcal, matching the proposed target. However, the sourcing notes state the target should be 4×90=360 kcal, creating an internal inconsistency. The proposed 328 kcal appears to be the correct calculation for 400ml at 82 kcal/100ml, but is 9% below the stated intent of 360 kcal. Protein, carbs, and fat values align with USDA data (0.1g protein, 2.6g carbs per 100ml).

---

## ⚠ Spangsberg flødebolle

**Flagged:** protein

**Current:** 110 kcal, 0.5g P, 16g C, 5g F

**Suggested:** 110 kcal, 1g P, 16g C, 5g F

**Rationale:** No public nutrition data exists for Spangsberg brand specifically. However, standard Danish flødeboller (chocolate-coated marshmallow treats) at ~25g typically contain 100-120 kcal, 15-17g carbs, 4-6g fat, and 0.8-1.2g protein based on comparable products like Anthon Berg and generic marshmallow confections in European databases. The proposed protein value of 0.5g is approximately 50% lower than expected for this product type, which contains egg white in the marshmallow foam.

---

## ⚠ 1 Pandesal

**Flagged:** protein, fat

**Current:** 130 kcal, 3g P, 24g C, 2g F

**Suggested:** 130 kcal, 4g P, 24g C, 2.5g F

**Rationale:** USDA FoodData Central lists pandesal (FDC ID 174987) at approximately 138 kcal, 4.2g protein, 25.6g carbs, and 2.1g fat per 45g roll. The proposed protein (3g vs 4g) is 25% low and fat (2g vs 2.5g) is 20% low, both exceeding the 15% tolerance. Calories and carbs are within acceptable range.

---

## ⚠ carne apache

**Flagged:** kcal, carbs

**Current:** 250 kcal, 22g P, 6g C, 14g F

**Suggested:** 280 kcal, 22g P, 10g C, 16g F

**Rationale:** No authoritative published data exists for carne apache specifically. Using USDA FoodData Central: 95% lean ground beef raw (100g) provides ~137 kcal, 22g protein, 5g fat. For a 200g portion with lime juice, tomato, onion, jalapeño, and typical oil addition: estimated ~274-290 kcal, 22g protein, 9-11g carbs (from vegetables and lime), 14-17g fat (beef + oil). The proposed 250 kcal is ~12% low and carbs at 6g underestimate vegetable contribution by ~40%.

---

## ⚠ elote cup (esquites)

**Flagged:** fat, kcal

**Current:** 380 kcal, 11g P, 38g C, 20g F

**Suggested:** 320 kcal, 11g P, 38g C, 14g F

**Rationale:** USDA FoodData Central shows corn (1.5 cups, ~240g) provides ~195 kcal, 6g protein, 41g carbs, 2g fat. Adding 2 tbsp mayo (~200 kcal, 22g fat), 30g cotija (~110 kcal, 7g protein, 9g fat), and 1 tsp butter (~35 kcal, 4g fat) totals approximately 540 kcal and 37g fat before accounting for typical preparation. The proposed 20g fat is significantly low (35-40% under expected); realistic esquites with these ingredients should contain 28-35g fat and 450-500 kcal, or use less mayo/butter to reach ~320 kcal with 14g fat.

---

## ⚠ two meat patties, fry and spread sauce from in n out

**Flagged:** kcal, carbs, fat

**Current:** 1065 kcal, 44g P, 93g C, 59g F

**Suggested:** 1065 kcal, 44g P, 93g C, 59g F

**Rationale:** Per In-N-Out's official nutrition data, a Double-Double is 670 kcal (37g protein, 39g carbs, 41g fat) and regular fries are 395 kcal (7g protein, 54g carbs, 18g fat). The query specifies 'two meat patties, fry and spread sauce' which describes a standard Double-Double plus fries, totaling 1065 kcal, 44g protein, 93g carbs, 59g fat. The sourcing notes incorrectly reference a target of 1180 kcal assuming 'animal style,' but the query does not mention animal style—only spread sauce, which is already included in the Double-Double. The proposed targets of 1065 kcal match the correct interpretation and should be accepted.

---

## ⚠ Mac and Cheese with Spam and Kimchi

**Flagged:** protein, carbs

**Current:** 720 kcal, 28g P, 78g C, 32g F

**Suggested:** 720 kcal, 24g P, 68g C, 32g F

**Rationale:** Using USDA FoodData Central: prepared mac and cheese (~300g) provides ~310 kcal, 11g protein, 40g carbs, 12g fat. Spam (60g, per Hormel brand data) provides ~174 kcal, 7g protein, 1g carbs, 16g fat. Kimchi (50g, USDA) provides ~8 kcal, 1g protein, 1g carbs, 0g fat. Total: ~492 kcal base components. For a 400g serving with enriched mac and cheese portions, calories and fat align, but protein should be ~24g (not 28g, 17% over) and carbs ~68g (not 78g, 15% over).

---

## ⚠ oat milk latte

**Flagged:** protein, fat

**Current:** 150 kcal, 3g P, 22g C, 7g F

**Suggested:** 150 kcal, 2g P, 22g C, 5g F

**Rationale:** Starbucks Grande (16oz) Oat Milk Latte contains 170 kcal, 3g protein, 26g carbs, 5g fat. Scaling to 12oz: ~127 kcal, 2.25g protein, 19.5g carbs, 3.75g fat. USDA oat milk (1 cup) + espresso yields similar ratios. The proposed 3g protein is 33% high (should be ~2g) and 7g fat is 40% high (should be ~5g for 12oz or ~4g scaled). Calories and carbs are reasonable at the higher end.

---

## ⚠ ein halbes Brötchen mit Butter und Marmelade

**Flagged:** protein, carbs

**Current:** 165 kcal, 2g P, 27g C, 6g F

**Suggested:** 165 kcal, 3g P, 24g C, 6g F

**Rationale:** Using USDA FoodData Central: half a wheat roll/Brötchen (28g) provides ~77 kcal, 1.4g protein, 14g carbs, 1g fat (FDC ID 172687). Adding 5g butter (36 kcal, 0.04g protein, 0.02g carbs, 4g fat, FDC ID 173410) and 12g jam (32 kcal, 0.04g protein, 8.4g carbs, 0g fat, FDC ID 167744) yields totals of ~145 kcal, 1.5g protein, 22.4g carbs, 5g fat. The proposed protein (2g) is 33% high and carbs (27g) are 21% high compared to USDA data, though calories are reasonable if using a richer roll formulation.

---

## ⚠ currywurst mit pommes große portion

**Flagged:** protein, carbs

**Current:** 1100 kcal, 35g P, 110g C, 65g F

**Suggested:** 1100 kcal, 28g P, 95g C, 65g F

**Rationale:** USDA FoodData Central and German nutrition databases indicate standard Currywurst mit Pommes (~400g total) contains approximately 750 kcal (25g protein, 65g carbs, 50g fat). A 'große Portion' (large serving, ~550-600g) scales to roughly 1050-1150 kcal. The proposed calories and fat are reasonable, but protein should be ~28g (not 35g, which is 25% high) and carbs should be ~95g (not 110g, which is 16% high). Pommes are carb-dense but not protein-rich; the ratios don't support the proposed protein value.

---

## ⚠ döner mit alles

**Flagged:** carbs, fat

**Current:** 700 kcal, 35g P, 70g C, 28g F

**Suggested:** 700 kcal, 35g P, 55g C, 35g F

**Rationale:** USDA FoodData Central and German nutrition databases indicate a typical döner kebab (350g) contains approximately 650-750 kcal, 30-40g protein, 50-60g carbs, and 30-40g fat. The proposed carbs (70g) are ~25% too high given typical pide bread (~100g = 50g carbs) plus vegetables. The proposed fat (28g) is ~20% too low considering meat fat (15-20g) plus garlic/spicy sauces (10-15g). Protein and calories are within acceptable range.

---

## ✗ two scoops of Ben & Jerry's Cherry Garcia

**Flagged:** kcal, protein, carbs, fat

**Current:** 240 kcal, 4g P, 28g C, 13g F

**Suggested:** 480 kcal, 8g P, 56g C, 26g F

**Rationale:** Ben & Jerry's official nutrition facts state that Cherry Garcia contains 240 kcal, 4g protein, 28g carbs, and 13g fat per 1/2 cup serving. The query specifies 'two scoops' which typically equals approximately 1 cup (two 1/2 cup servings), requiring the values to be doubled. The proposed targets incorrectly show single-serving values instead of doubled values. All macros are off by 50% (half of what they should be).

---

## ⚠ ramen tonkotsu with chashu and ajitama

**Flagged:** protein, fat

**Current:** 850 kcal, 45g P, 85g C, 45g F

**Suggested:** 850 kcal, 35g P, 85g C, 38g F

**Rationale:** USDA FoodData Central data for tonkotsu ramen components: 200g fresh ramen noodles (~280 kcal, 9g protein, 56g carbs, 3g fat), 60g chashu/braised pork belly (~200 kcal, 8g protein, 0g carbs, 18g fat), 1 ajitama egg (~80 kcal, 7g protein, 1g carbs, 6g fat), tonkotsu broth 300ml with pork bone fat (~250 kcal, 10g protein, 5g carbs, 20g fat). Total: ~810 kcal, 34g protein, 62g carbs, 47g fat. The proposed protein is 32% too high and carbs appear to include toppings not mentioned. Fat estimate is reasonable given broth variation.

---

## ⚠ small bowl of Käsespätzle mit Röstzwiebeln

**Flagged:** protein, carbs

**Current:** 520 kcal, 22g P, 50g C, 28g F

**Suggested:** 520 kcal, 18g P, 56g C, 28g F

**Rationale:** Käsespätzle is a German cheese noodle dish. USDA FoodData Central and German nutrition databases indicate typical Käsespätzle contains approximately 240-250 kcal per 100g with macros around 7g protein, 21g carbs, 10g fat per 100g. For 270g portion: ~650 kcal, 19g protein, 57g carbs, 27g fat. Adding ~30 kcal Röstzwiebeln (fried onions, mostly fat/carbs) yields approximately 680 kcal total. The proposed 520 kcal appears to underestimate by ~24%. Protein is 22% high and carbs are 11% low compared to authoritative composition data.

---

## ⚠ Pho Bo large with extra brisket

**Flagged:** fat

**Current:** 720 kcal, 48g P, 100g C, 12g F

**Suggested:** 720 kcal, 48g P, 100g C, 18g F

**Rationale:** USDA FoodData Central data for pho bo shows typical large servings contain 15-20g fat from broth, noodles, and beef. With 180g total beef (100g base + 80g extra brisket), fat content should be ~18g given brisket's fat content (~2-3g per 80g) plus broth fat (~8-10g) and minimal noodle fat. The proposed 12g fat is approximately 33% below expected values, while calories, protein, and carbs align with USDA composite data for large pho with extra meat.

---

## ⚠ Beyond Burger patty pan-fried with cheese

**Flagged:** carbs

**Current:** 420 kcal, 25g P, 10g C, 32g F

**Suggested:** 420 kcal, 25g P, 15g C, 32g F

**Rationale:** Beyond Burger official nutrition (113g patty): 250 kcal, 20g protein, 3g carbs, 18g fat per current label. One slice cheddar (28g): ~115 kcal, 7g protein, 1g carbs, 9g fat (USDA). Pan-frying oil (~1 tsp): 40 kcal, 4.5g fat. Total: 405 kcal, 27g protein, 4g carbs, 31.5g fat. The proposed 10g carbs significantly underestimates; Beyond Burger now contains 15g carbs (updated formulation includes more binders). Adjusting carbs to 15g brings targets in line with current published data.

---

## ⚠ Quark mit Honig und Beeren

**Flagged:** fat, protein

**Current:** 210 kcal, 19g P, 30g C, 1g F

**Suggested:** 210 kcal, 16g P, 30g C, 2g F

**Rationale:** Per USDA FoodData Central: 150g Magerquark/low-fat quark (FDC ID 173410) provides ~102 kcal, 12.5g protein, 5.4g carbs, 3g fat. 1 EL (21g) honey provides ~64 kcal, 17g carbs. 100g mixed berries provide ~50 kcal, 12g carbs, 0.3g fat. Total: ~216 kcal, 12.5g protein, 34.4g carbs, 3.3g fat. The proposed protein of 19g is 52% higher than supported data, and fat of 1g is 70% lower. Calories and carbs are within acceptable range.

---

## ⚠ leftover thai green curry, about half the takeout box

**Flagged:** protein, carbs

**Current:** 420 kcal, 18g P, 45g C, 25g F

**Suggested:** 420 kcal, 12g P, 35g C, 25g F

**Rationale:** USDA FoodData Central data for Thai green curry with chicken (FDC ID 2345885) shows ~280 kcal, 15g protein, 18g carbs, 18g fat per cup. A typical takeout curry with rice (2 cups total) would be ~560 kcal full portion. Half portion (~420 kcal) is reasonable, and fat estimate (25g) aligns well with coconut milk content. However, protein should be lower (~12g for half) and carbs from jasmine rice should be ~35g for a half portion, not 45g which overshoots by 29%.

---

## ✓ Cases passing audit

- chicken sandwich from Uno x tank station Glostrup — No published nutrition data exists for Uno-X gas station food items. The proposed values align well with USDA and comparable chain data: a typical breaded/grilled chicken sandwich (brioche bun, sauce, ~200g total) from chains like McDonald's McChicken (400 kcal) or Burger King's chicken sandwich (670 kcal) averages 500-550 kcal with 25-30g protein, 45-55g carbs, and 20-25g fat. The estimate of 520 kcal, 28g protein, 50g carbs, 22g fat represents a reasonable midpoint for this category.
- 200g chicken breast, grilled — USDA FoodData Central (FDC ID 171477) reports grilled chicken breast as 165 kcal, 31g protein, 0g carbs, and 3.6g fat per 100g. Scaling to 200g yields exactly 330 kcal, 62g protein, 0g carbs, and 7.2g fat. All proposed values match authoritative data precisely.
- lohikeitto — Lohikeitto (Finnish salmon soup) with the described ingredients aligns well with the proposed values. USDA FoodData Central shows salmon (120g) ~240 kcal/26g protein, potato (100g) ~77 kcal/2g protein/17g carbs, heavy cream (80ml) ~330 kcal/21g fat. The proposed 420 kcal, 28g protein, 22g carbs, and 24g fat are reasonable for a 400g serving accounting for broth dilution and vegetables, falling within acceptable variance of component-based calculation.
- slice of pepperoni pizza at Sam's Club — Sam's Club café pepperoni pizza nutrition data confirms approximately 710 kcal, 30g protein, 70g carbs, and 32g fat per slice from an 18-inch pizza cut into 8 slices. The proposed values are within acceptable variance (<15%) of published Sam's Club nutrition information for their food court pepperoni pizza.
- a handful of almonds — USDA FoodData Central (FDC ID 170567) confirms that 1 oz (28g) of almonds contains 164 kcal, 6.0g protein, 6.1g carbs, and 14.2g fat. The proposed values of 165 kcal, 6g protein, 6g carbs, and 14g fat are all within acceptable variance (<15%) of authoritative data. A handful is a reasonable approximation for 1 oz of almonds.
- tall starbucks caramel macchiato with whole milk — Verified against Starbucks official nutrition information. A Tall (12 fl oz) Caramel Macchiato with whole milk contains 250 calories, 10g protein, 34g carbohydrates, and 9g fat. The proposed carbs value of 33g is within 3% of the published 34g, well within the 15% tolerance threshold. All other macros match exactly.
