// Mirrors UsdaService.getRagContext from lib/services/usda_service.dart.
// The Dart version proxies through Cloud Functions; here we hit USDA FoodData
// Central directly with the same query + limit and format the output identically.
//
// Get a free key at https://fdc.nal.usda.gov/api-key-signup and put it in
// .env as USDA_API_KEY. If unset, RAG returns "" (same fallback as the app
// when the search fails).

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";

function nutrient(food: any, id: number): number {
  for (const n of food.foodNutrients ?? []) {
    if ((n.nutrientId ?? n.nutrientNumber) === id) return Number(n.value ?? 0);
  }
  for (const n of food.foodNutrients ?? []) {
    if (`${n.nutrientNumber}` === `${id}`) return Number(n.value ?? 0);
  }
  return 0;
}

export async function getRagContext(query: string, limit = 3): Promise<string> {
  const key = process.env.USDA_API_KEY;
  if (!key || !query.trim()) return "";

  try {
    const url = `${USDA_BASE}/foods/search?api_key=${encodeURIComponent(key)}` +
      `&query=${encodeURIComponent(query)}&pageSize=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return "";
    const body = await res.json();
    const foods = (body.foods ?? []) as any[];
    if (foods.length === 0) return "";

    const lines = foods.map((f) => {
      const name = (f.description ?? "").trim();
      const kcal = Math.round(nutrient(f, 1008));
      const carbs = Math.round(nutrient(f, 1005));
      const protein = Math.round(nutrient(f, 1003));
      const fat = Math.round(nutrient(f, 1004));
      return `- ${name} (per 100g): ${kcal} kcal, ${carbs}g carbs, ${protein}g protein, ${fat}g fat`;
    });
    return lines.join("\n") + "\n";
  } catch {
    return "";
  }
}
