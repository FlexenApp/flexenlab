// 1:1 port of FoodRecognitionService._parseAndValidate from
// lib/services/food_recognition_service.dart. Same caps, same recompute logic,
// same micronutrient ULs. Per-user bias correction (VerifiedFoodsService)
// defaults to 1.0 in evals — there is no user history.

export type ParsedNutrition = {
  name: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  servingSize?: string;
  reasoning?: string;
  // micros omitted from eval scoring but kept for completeness
  vitaminAUg?: number;
  vitaminCMg?: number;
  vitaminDUg?: number;
  vitaminEMg?: number;
  vitaminKUg?: number;
  vitaminB1Mg?: number;
  vitaminB2Mg?: number;
  vitaminB6Mg?: number;
  vitaminB12Ug?: number;
  folateUg?: number;
  calciumMg?: number;
  ironMg?: number;
  magnesiumMg?: number;
  zincMg?: number;
  potassiumMg?: number;
  phosphorusMg?: number;
  seleniumUg?: number;
  // diagnostics
  _kcalRecomputed?: boolean;
  _kcalCapped?: boolean;
};

const dPos = (j: any, key: string): number | undefined => {
  const v = j?.[key];
  return typeof v === "number" && v > 0 ? v : undefined;
};

const capMicro = (j: any, key: string, max: number): number | undefined => {
  const v = dPos(j, key);
  return v != null && v > max ? max : v;
};

export function parseAndValidate(raw: string): ParsedNutrition | null {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    const j = JSON.parse(cleaned);

    const name = (j.name as string) ?? "Unbekannt";
    const confidence = ((j.confidence as string) ?? "MEDIUM").toUpperCase() as
      | "HIGH"
      | "MEDIUM"
      | "LOW";

    let kcal = Number(j.kcal ?? 0);
    let carbsG = Number(j.carbsG ?? 0);
    let proteinG = Number(j.proteinG ?? 0);
    let fatG = Number(j.fatG ?? 0);

    let kcalRecomputed = false;
    // Macro–calorie consistency: ratio outside 0.85..1.15 → recompute
    const computedKcal = proteinG * 4 + carbsG * 4 + fatG * 9;
    if (computedKcal > 0) {
      const ratio = kcal / computedKcal;
      if (ratio < 0.85 || ratio > 1.15) {
        kcal = Math.round(computedKcal);
        kcalRecomputed = true;
      }
    }

    if (kcal < 0) kcal = 0;
    if (carbsG < 0) carbsG = 0;
    if (proteinG < 0) proteinG = 0;
    if (fatG < 0) fatG = 0;

    let kcalCapped = false;
    if (kcal > 5000) {
      const scale = 5000 / kcal;
      kcal = 5000;
      carbsG = Math.round(carbsG * scale);
      proteinG = Math.round(proteinG * scale);
      fatG = Math.round(fatG * scale);
      kcalCapped = true;
    }

    if (carbsG > 750) carbsG = 750;
    if (proteinG > 300) proteinG = 300;
    if (fatG > 350) fatG = 350;

    // bias factor would go here — defaults to 1.0 in eval

    let fiberG = dPos(j, "fiberG");
    let sugarG = dPos(j, "sugarG");
    if (fiberG != null && fiberG > carbsG) fiberG = carbsG;
    if (sugarG != null && sugarG > carbsG) sugarG = carbsG;

    return {
      name,
      confidence,
      kcal,
      carbsG,
      proteinG,
      fatG,
      fiberG,
      sugarG,
      servingSize: j.servingSize as string | undefined,
      reasoning: j.reasoning as string | undefined,
      vitaminAUg: capMicro(j, "vitaminAUg", 3000),
      vitaminCMg: capMicro(j, "vitaminCMg", 2000),
      vitaminDUg: capMicro(j, "vitaminDUg", 100),
      vitaminEMg: capMicro(j, "vitaminEMg", 1000),
      vitaminKUg: capMicro(j, "vitaminKUg", 5000),
      vitaminB1Mg: capMicro(j, "vitaminB1Mg", 500),
      vitaminB2Mg: capMicro(j, "vitaminB2Mg", 500),
      vitaminB6Mg: capMicro(j, "vitaminB6Mg", 100),
      vitaminB12Ug: capMicro(j, "vitaminB12Ug", 5000),
      folateUg: capMicro(j, "folateUg", 1000),
      calciumMg: capMicro(j, "calciumMg", 2500),
      ironMg: capMicro(j, "ironMg", 45),
      magnesiumMg: capMicro(j, "magnesiumMg", 1000),
      zincMg: capMicro(j, "zincMg", 40),
      potassiumMg: capMicro(j, "potassiumMg", 10000),
      phosphorusMg: capMicro(j, "phosphorusMg", 4000),
      seleniumUg: capMicro(j, "seleniumUg", 400),
      _kcalRecomputed: kcalRecomputed,
      _kcalCapped: kcalCapped,
    };
  } catch {
    return null;
  }
}
