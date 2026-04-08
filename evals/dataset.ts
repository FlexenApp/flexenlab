// Hard test cases for Flexen food-text estimation.
//
// FOCUS: US-English market. Brand-published nutrition where possible
// (Starbucks, In-N-Out, Chipotle, McDonald's, Sweetgreen, Trader Joe's,
// Sam's Club, Beyond Meat, Ben & Jerry's), USDA-anchored where not.
// German/EU cases were removed during the US pivot — they will return
// when we add EU/DE database integrations.
//
// Each case has:
//   - target*: best evidence-based estimate (brand site / USDA / standard cookbook)
//   - tol*:    acceptance band as +/- fraction of target (0.20 = ±20%)
//
// Scoring uses CONTINUOUS percent-error against target. Tolerance bands are
// tight on purpose — be skeptical of any case that scores 100% across the
// board, that's where the eval is too lenient.

export type FoodCase = {
  input: string;

  // Best-estimate target values
  targetKcal: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;

  // Tolerance as fraction of target. Tighter = stricter case.
  tolKcal: number;
  tolProtein: number;
  tolCarbs: number;
  tolFat: number;

  // Language the "name" field should come back in
  language: "en" | "es";

  // Expected confidence band. Use null to skip the calibration check.
  expectedConfidence: "HIGH" | "MEDIUM" | "LOW" | null;

  // Free notes — visible to LLM judges as context
  notes: string;

  // True for the hardest subset (obscure brands, ambiguous portions).
  tough?: boolean;
};

// Helper for default tolerances
const tol = (k = 0.25, p = 0.3, c = 0.3, f = 0.35) => ({
  tolKcal: k,
  tolProtein: p,
  tolCarbs: c,
  tolFat: f,
});

export const FOOD_CASES: FoodCase[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLISHED BRAND DATA — should be HIGH confidence, tight tolerances
  // ═══════════════════════════════════════════════════════════════════════
  {
    input: "200g chicken breast, grilled",
    targetKcal: 330, targetProtein: 62, targetCarbs: 0, targetFat: 7.2,
    tolKcal: 0.15, tolProtein: 0.15, tolCarbs: 5.0, tolFat: 0.5,
    language: "en", expectedConfidence: "HIGH",
    notes: "USDA per 100g grilled chicken breast: 165 kcal, 31g protein, 0g carbs, 3.57g fat → ×2 = 330/62/0/7.2. Exact weight + clear prep. Must be HIGH confidence and tight numbers.",
  },
  {
    input: "tall starbucks caramel macchiato with whole milk",
    targetKcal: 210, targetProtein: 8, targetCarbs: 26, targetFat: 9,
    tolKcal: 0.12, tolProtein: 0.2, tolCarbs: 0.15, tolFat: 0.25,
    language: "en", expectedConfidence: "HIGH",
    notes: "fastfoodnutrition.org / Starbucks Tall (12oz) Caramel Macchiato w/ whole milk: 210 kcal, 8P, 26C, 9F. (Earlier dataset version had 250 from a wrong nonfat-vs-whole confusion — corrected after web verification.)",
  },
  {
    input: "grande iced brown sugar oat shaken espresso from starbucks",
    targetKcal: 120, targetProtein: 2, targetCarbs: 20, targetFat: 3,
    tolKcal: 0.2, tolProtein: 1.0, tolCarbs: 0.2, tolFat: 0.5,
    language: "en", expectedConfidence: "HIGH",
    notes: "Starbucks PUBLISHED Grande (16oz) Iced Brown Sugar Oatmilk Shaken Espresso: 120 kcal, 2P, 20C, 3F. Brand-known viral drink.",
  },
  {
    input: "Big Mac with medium fries and a Coke",
    targetKcal: 1170, targetProtein: 31, targetCarbs: 142, targetFat: 44,
    tolKcal: 0.12, tolProtein: 0.2, tolCarbs: 0.15, tolFat: 0.2,
    language: "en", expectedConfidence: "HIGH",
    notes: "McDonald's official Big Mac Meal page lists the combo (Big Mac + medium fries + medium Coke) at 1170 kcal total. Components: Big Mac 590/25P/45C/33F + Medium Fries 320/4P/43C/15F + Medium Coke 210/0P/58C/0F → 1120 sum, mcdonalds.com lists 1170 (~30 cal rounding/regional). Published.",
  },
  {
    input: "two scoops of Ben & Jerry's Cherry Garcia",
    targetKcal: 480, targetProtein: 8, targetCarbs: 56, targetFat: 26,
    tolKcal: 0.18, tolProtein: 0.4, tolCarbs: 0.2, tolFat: 0.25,
    language: "en", expectedConfidence: "HIGH",
    notes: "B&J published: 1/2 cup serving = 240 kcal, 4P, 28C, 13F. Standard ice cream scoop ≈ 1/2 cup, so 'two scoops' ≈ 1 cup = 2 servings → 480/8/56/26.",
  },
  {
    input: "double-double animal style with fries from in n out",
    targetKcal: 1060, targetProtein: 43, targetCarbs: 88, targetFat: 56,
    tolKcal: 0.15, tolProtein: 0.2, tolCarbs: 0.2, tolFat: 0.2,
    language: "en", expectedConfidence: "MEDIUM",
    notes: "In-N-Out official: Double-Double (with spread) 670 kcal/37P/39C/41F. Animal Style adds ~30 kcal (extra spread + grilled onions + mustard-fried). Regular Fries (per official site): 360 kcal/6P/49C/15F. Total ~1060/43/88/56. Medium confidence — Animal Style modifier requires brand knowledge.",
    tough: true,
  },
  {
    input: "slice of pepperoni pizza at Sam's Club",
    targetKcal: 380, targetProtein: 18, targetCarbs: 33, targetFat: 20,
    tolKcal: 0.18, tolProtein: 0.25, tolCarbs: 0.22, tolFat: 0.25,
    language: "en", expectedConfidence: "MEDIUM",
    notes: "Sam's Club Cafe published standard pepperoni pizza slice: 380 kcal/18P/33C/20F (multiple nutrition databases). Note: there's also a 'Hot Bake' pepperoni pizza variant at ~650 kcal but the standard café slice is the default — earlier dataset version had 700 from confusing the two.",
  },
  {
    input: "Chipotle chicken burrito bowl with brown rice black beans corn salsa cheese and guac",
    targetKcal: 940, targetProtein: 55, targetCarbs: 87, targetFat: 46,
    tolKcal: 0.15, tolProtein: 0.2, tolCarbs: 0.2, tolFat: 0.2,
    language: "en", expectedConfidence: "MEDIUM",
    notes: "Chipotle official nutrition calculator: chicken 180/0C/32P/7F + brown rice 210/40C/4P/4F + black beans 130/22C/8P/2F + corn salsa 80/16C/3P/2F + cheese 110/1C/6P/9F + guac 230/8C/2P/22F = 940 kcal/87C/55P/46F. Tests multi-ingredient summation.",
    tough: true,
  },
  {
    input: "Sweetgreen Harvest Bowl",
    targetKcal: 690, targetProtein: 37, targetCarbs: 54, targetFat: 39,
    tolKcal: 0.18, tolProtein: 0.25, tolCarbs: 0.2, tolFat: 0.25,
    language: "en", expectedConfidence: "MEDIUM",
    notes: "Sweetgreen Harvest Bowl per multiple sources (carbmanager, fastfoodnutrition): 690 kcal/37P/54C/39F (with chicken, wild rice, sweet potato, apples, almonds, goat cheese, balsamic vinaigrette). Earlier dataset version had 685/30/84/25 — protein and fat were significantly understated, carbs overstated.",
  },
  {
    input: "Beyond Burger patty pan-fried with cheese",
    targetKcal: 385, targetProtein: 27, targetCarbs: 8, targetFat: 28,
    tolKcal: 0.18, tolProtein: 0.2, tolCarbs: 0.5, tolFat: 0.2,
    language: "en", expectedConfidence: "HIGH",
    notes: "Beyond Burger patty (113g) PUBLISHED: 230 kcal, 20P, 7C, 14F. + 1 tsp oil pan-fry (~40 kcal, 5F) + 1 slice cheddar (115 kcal, 7P, 9F). Total ~385/27/8/28.",
  },
  {
    input: "1 serving of Trader Joe's Mandarin Orange Chicken",
    targetKcal: 320, targetProtein: 21, targetCarbs: 24, targetFat: 16,
    tolKcal: 0.18, tolProtein: 0.25, tolCarbs: 0.22, tolFat: 0.3,
    language: "en", expectedConfidence: "HIGH",
    notes: "TJ's Mandarin Orange Chicken PUBLISHED single serving: 320 kcal/21P/24C/16F. Query rephrased to 'one serving' for unambiguity (the original 'half bag' was ambiguous because bag size varies between SKUs). Brand-published, HIGH confidence.",
    tough: true,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PORTION & MODIFIER STRESS TESTS — testing fractions, multipliers, sizes
  // ═══════════════════════════════════════════════════════════════════════
  {
    input: "two large eggs scrambled with butter",
    targetKcal: 230, targetProtein: 13, targetCarbs: 1, targetFat: 19,
    tolKcal: 0.2, tolProtein: 0.25, tolCarbs: 2.0, tolFat: 0.25,
    language: "en", expectedConfidence: "HIGH",
    notes: "USDA: large egg 72 kcal/6P/0.4C/4.8F. ×2 = 144/12/0.8/9.6. + 1 tbsp butter (102 kcal/0P/0C/11.5F). Total ~246/12/0.8/21. Tight tolerances around 230/13/1/19.",
  },
  {
    input: "half a chipotle chicken burrito",
    targetKcal: 580, targetProtein: 26, targetCarbs: 65, targetFat: 21,
    tolKcal: 0.2, tolProtein: 0.25, tolCarbs: 0.25, tolFat: 0.3,
    language: "en", expectedConfidence: "MEDIUM",
    notes: "Standard Chipotle chicken burrito (white rice, black beans, salsa, cheese, sour cream, no guac) = ~1160 kcal/52P/130C/42F. Half = 580/26/65/21. Tests fraction modifier.",
  },
  {
    input: "three slices of cheese pizza",
    targetKcal: 855, targetProtein: 36, targetCarbs: 108, targetFat: 30,
    tolKcal: 0.18, tolProtein: 0.25, tolCarbs: 0.2, tolFat: 0.25,
    language: "en", expectedConfidence: "MEDIUM",
    notes: "USDA cheese pizza 1 slice (107g) = 285 kcal/12P/36C/10F. ×3 = 855/36/108/30. Tests multiplier on anchor in prompt.",
  },
  {
    input: "a handful of almonds",
    targetKcal: 165, targetProtein: 6, targetCarbs: 6, targetFat: 14,
    tolKcal: 0.3, tolProtein: 0.4, tolCarbs: 0.5, tolFat: 0.35,
    language: "en", expectedConfidence: "LOW",
    notes: "USDA almonds 1oz (28g) = 164 kcal/6P/6C/14F. 'Handful' ≈ 1oz typical convention. LOW because 'handful' is ambiguous (could be 0.5-1.5oz depending on hand size).",
  },
  {
    input: "small bowl of oatmeal with banana and honey",
    targetKcal: 290, targetProtein: 6, targetCarbs: 60, targetFat: 4,
    tolKcal: 0.2, tolProtein: 0.4, tolCarbs: 0.2, tolFat: 0.5,
    language: "en", expectedConfidence: "MEDIUM",
    notes: "Small bowl = ~3/4 cup cooked oats (115 kcal/4P/20C/2F) + 1 medium banana (105 kcal/1P/27C/0.4F) + 1 tbsp honey (64 kcal/0P/17C/0F) = 284 kcal. Round to 290.",
  },
  {
    input: "Thai green curry takeout, about half the box",
    targetKcal: 420, targetProtein: 18, targetCarbs: 45, targetFat: 25,
    tolKcal: 0.3, tolProtein: 0.4, tolCarbs: 0.4, tolFat: 0.4,
    language: "en", expectedConfidence: "LOW",
    notes: "Full takeout green curry with rice ~800-900 kcal. 'Half the box' is ambiguous (box size varies). LOW confidence expected.",
    tough: true,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // CUISINE & FUSION STRESS TESTS
  // ═══════════════════════════════════════════════════════════════════════
  {
    input: "ramen tonkotsu with chashu and ajitama",
    targetKcal: 850, targetProtein: 38, targetCarbs: 85, targetFat: 38,
    tolKcal: 0.2, tolProtein: 0.3, tolCarbs: 0.25, tolFat: 0.3,
    language: "en", expectedConfidence: "MEDIUM",
    notes: "Restaurant tonkotsu bowl ~600g: pork bone broth 250 kcal, noodles 200g (~280 kcal), chashu 60g (~180 kcal), ajitama (~80 kcal), aromatics → ~850/38/85/38.",
    tough: true,
  },
  {
    input: "Pho Bo large with extra brisket",
    targetKcal: 720, targetProtein: 48, targetCarbs: 100, targetFat: 12,
    tolKcal: 0.22, tolProtein: 0.25, tolCarbs: 0.25, tolFat: 0.5,
    language: "en", expectedConfidence: "MEDIUM",
    notes: "Large pho ~750ml broth + 250g rice noodles (~100g carbs) + 100g sliced beef + 80g extra brisket. Standard large pho ~580 kcal + ~140 from extra brisket = 720. Lean cuts → low fat.",
  },
  {
    input: "elote cup",
    targetKcal: 380, targetProtein: 11, targetCarbs: 38, targetFat: 20,
    tolKcal: 0.25, tolProtein: 0.35, tolCarbs: 0.25, tolFat: 0.3,
    language: "en", expectedConfidence: "MEDIUM",
    notes: "Mexican street corn in cup: 1.5 cups corn kernels (195 kcal/7P/41C/2F) + 2 tbsp mayo (180 kcal/0P/0C/20F) + 30g cotija cheese (120 kcal/7P/1C/10F) = ~380/11/38/20.",
  },
  {
    input: "carne apache",
    targetKcal: 250, targetProtein: 22, targetCarbs: 6, targetFat: 14,
    tolKcal: 0.3, tolProtein: 0.35, tolCarbs: 0.5, tolFat: 0.4,
    language: "es", expectedConfidence: "LOW",
    notes: "Mexican raw-beef ceviche, ~200g lean ground beef (~200 kcal/20P/0C/11F) + lime + 50g veg + 1tsp oil (~50 kcal/2P/6C/3F) = ~250/22/6/14. LOW because no standard portion.",
    tough: true,
  },
  {
    input: "Mac and Cheese with Spam and Kimchi",
    targetKcal: 720, targetProtein: 28, targetCarbs: 78, targetFat: 32,
    tolKcal: 0.25, tolProtein: 0.35, tolCarbs: 0.3, tolFat: 0.3,
    language: "en", expectedConfidence: "MEDIUM",
    notes: "250g mac & cheese (310 kcal/11P/40C/11F) + 60g Spam (175 kcal/7P/2C/16F) + 50g kimchi (15 kcal/1P/3C/0F) + extra cheese (~220 kcal). Total ~720/28/78/32.",
    tough: true,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SIMPLE/STAPLE — must be HIGH and accurate
  // ═══════════════════════════════════════════════════════════════════════
  {
    input: "1 cup of cooked white rice",
    targetKcal: 205, targetProtein: 4.3, targetCarbs: 45, targetFat: 0.4,
    tolKcal: 0.12, tolProtein: 0.25, tolCarbs: 0.15, tolFat: 1.0,
    language: "en", expectedConfidence: "HIGH",
    notes: "USDA: 1 cup cooked white rice (158g) = 206 kcal/4.25P/44.5C/0.44F. One of the most-tested anchors in any nutrition DB.",
  },
  {
    input: "medium banana",
    targetKcal: 105, targetProtein: 1.3, targetCarbs: 27, targetFat: 0.4,
    tolKcal: 0.15, tolProtein: 0.5, tolCarbs: 0.15, tolFat: 1.0,
    language: "en", expectedConfidence: "HIGH",
    notes: "USDA: medium banana (118g edible) = 105 kcal/1.3P/27C/0.4F. Anchored in the prompt's reference list.",
  },
  {
    input: "salmon fillet baked",
    targetKcal: 350, targetProtein: 39, targetCarbs: 0, targetFat: 21,
    tolKcal: 0.2, tolProtein: 0.2, tolCarbs: 5.0, tolFat: 0.25,
    language: "en", expectedConfidence: "MEDIUM",
    notes: "USDA salmon fillet (170g baked) = 350 kcal/39P/0C/21F. Anchored in prompt. MEDIUM because no weight given — model has to assume.",
  },
];
