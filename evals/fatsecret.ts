// FatSecret Platform API client for RAG context.
// Mirrors what FatSecretService.search() in lib/services/fatsecret_service.dart
// returns, but called directly via OAuth2 client_credentials so the eval
// doesn't need Firebase auth.
//
// FatSecret API docs: https://platform.fatsecret.com/api/Default.aspx?screen=rapih
// We use foods.search v3 with the "format=json" param.

const TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const API_URL = "https://platform.fatsecret.com/rest/server.api";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.token;
  }
  const id = process.env.FATSECRET_CLIENT_ID;
  const secret = process.env.FATSECRET_CLIENT_SECRET;
  if (!id || !secret) throw new Error("FATSECRET_CLIENT_ID/SECRET not set in .env");

  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=basic",
  });
  if (!res.ok) throw new Error(`FatSecret OAuth failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return body.access_token;
}

// food_description format examples:
//   "Per 1 cup - Calories: 240kcal | Fat: 14.00g | Carbs: 19.00g | Protein: 7.00g"
//   "Per 100g - Calories: 165kcal | Fat: 3.57g | Carbs: 0.00g | Protein: 31.02g"
function parseDescription(desc: string): { kcal: number; fat: number; carbs: number; protein: number; serving: string } | null {
  if (!desc) return null;
  const m = desc.match(
    /Per ([^-]+)-\s*Calories:\s*([\d.]+)kcal\s*\|\s*Fat:\s*([\d.]+)g\s*\|\s*Carbs:\s*([\d.]+)g\s*\|\s*Protein:\s*([\d.]+)g/i,
  );
  if (!m) return null;
  return {
    serving: m[1].trim(),
    kcal: parseFloat(m[2]),
    fat: parseFloat(m[3]),
    carbs: parseFloat(m[4]),
    protein: parseFloat(m[5]),
  };
}

export async function getRagContext(query: string, limit = 3): Promise<string> {
  if (!query.trim()) return "";
  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      method: "foods.search",
      search_expression: query,
      max_results: String(limit),
      format: "json",
    });
    const res = await fetch(`${API_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return "";
    const body = (await res.json()) as any;
    const foodsObj = body.foods;
    if (!foodsObj || !foodsObj.food) return "";
    const list = Array.isArray(foodsObj.food) ? foodsObj.food : [foodsObj.food];

    const lines: string[] = [];
    for (const f of list.slice(0, limit)) {
      const name = (f.food_name as string) ?? "";
      const brand = (f.brand_name as string) ?? "";
      const display = brand ? `${name} (${brand})` : name;
      const parsed = parseDescription(f.food_description ?? "");
      if (!parsed) continue;
      lines.push(
        `- ${display.trim()} (per ${parsed.serving}): ${Math.round(parsed.kcal)} kcal, ` +
          `${Math.round(parsed.carbs)}g carbs, ${Math.round(parsed.protein)}g protein, ` +
          `${Math.round(parsed.fat)}g fat`,
      );
    }
    if (lines.length === 0) return "";
    return lines.join("\n") + "\n";
  } catch {
    return "";
  }
}
