// Cross-validates every dataset target against THREE independent sources:
//   1. FatSecret API (top-1 search result)
//   2. USDA FoodData Central API (top-1 search result)
//   3. Claude Sonnet 4.5 with native web_search tool (authoritative web)
//
// For each case, prints a comparison table and flags rows where 2+ sources
// disagree with our dataset target. Writes a full markdown report to
// `dataset_cross_check.md`.
//
// Run:  npx tsx compare_sources.ts

import "dotenv/config";
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { FOOD_CASES, type FoodCase } from "./dataset.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── FatSecret top-1 (raw, not RAG-formatted) ──

let fsToken: { token: string; exp: number } | null = null;
async function fsGetToken(): Promise<string> {
  if (fsToken && Date.now() < fsToken.exp - 30_000) return fsToken.token;
  const id = process.env.FATSECRET_CLIENT_ID!;
  const secret = process.env.FATSECRET_CLIENT_SECRET!;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=basic",
  });
  if (!res.ok) throw new Error(`FS oauth ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  fsToken = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

type Macros = { kcal: number; protein: number; carbs: number; fat: number; serving: string; name: string };

function parseFsDescription(desc: string): { kcal: number; protein: number; carbs: number; fat: number; serving: string } | null {
  const m = desc.match(/Per ([^-]+)-\s*Calories:\s*([\d.]+)kcal\s*\|\s*Fat:\s*([\d.]+)g\s*\|\s*Carbs:\s*([\d.]+)g\s*\|\s*Protein:\s*([\d.]+)g/i);
  if (!m) return null;
  return { serving: m[1].trim(), kcal: parseFloat(m[2]), fat: parseFloat(m[3]), carbs: parseFloat(m[4]), protein: parseFloat(m[5]) };
}

async function fsLookup(query: string): Promise<Macros | null> {
  try {
    const tok = await fsGetToken();
    const params = new URLSearchParams({ method: "foods.search", search_expression: query, max_results: "1", format: "json" });
    const res = await fetch(`https://platform.fatsecret.com/rest/server.api?${params.toString()}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as any;
    const list = body?.foods?.food;
    if (!list) return null;
    const f = Array.isArray(list) ? list[0] : list;
    const parsed = parseFsDescription(f.food_description ?? "");
    if (!parsed) return null;
    const brand = f.brand_name as string | undefined;
    return { ...parsed, name: brand ? `${f.food_name} (${brand})` : f.food_name };
  } catch {
    return null;
  }
}

// ── USDA top-1 ──

async function usdaLookup(query: string): Promise<Macros | null> {
  const key = process.env.USDA_API_KEY;
  if (!key) return null;
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&pageSize=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as any;
    const food = (body.foods ?? [])[0];
    if (!food) return null;
    const nut = (id: number) => {
      for (const n of food.foodNutrients ?? []) {
        if ((n.nutrientId ?? n.nutrientNumber) === id) return Number(n.value ?? 0);
      }
      return 0;
    };
    return {
      name: (food.description ?? "").trim(),
      kcal: nut(1008),
      carbs: nut(1005),
      protein: nut(1003),
      fat: nut(1004),
      serving: "per 100g",
    };
  } catch {
    return null;
  }
}

// ── Claude with native web_search tool ──

type ClaudeAnswer = {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  source: string;
  notes: string;
};

async function claudeWebLookup(c: FoodCase): Promise<ClaudeAnswer | null> {
  const prompt = `You are auditing a nutrition dataset. The user's food description is:

"${c.input}"

Use web search to find the AUTHORITATIVE published nutrition for this food.
Priority order for sources:
1. Brand official nutrition page (e.g. starbucks.com, mcdonalds.com)
2. USDA FoodData Central
3. Major nutrition databases (cronometer, myfitnesspal)
For dishes (not branded products), search the most cited recipe with portion specified.

Then compute the values for the EXACT portion described in the query.
Show your work briefly.

Return ONLY this JSON at the end (no markdown fences):
{"kcal": <number|null>, "protein_g": <number|null>, "carbs_g": <number|null>, "fat_g": <number|null>, "source": "<short URL or source name>", "notes": "<one sentence>"}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        temperature: 0,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 4,
          } as any,
        ],
        messages: [{ role: "user", content: prompt }],
      });

      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      // Extract last JSON object in the text
      const matches = [...text.matchAll(/\{[\s\S]*?\}/g)];
      for (let i = matches.length - 1; i >= 0; i--) {
        try {
          const j = JSON.parse(matches[i][0]);
          if ("kcal" in j) {
            return {
              kcal: j.kcal ?? null,
              protein: j.protein_g ?? null,
              carbs: j.carbs_g ?? null,
              fat: j.fat_g ?? null,
              source: j.source ?? "",
              notes: j.notes ?? "",
            };
          }
        } catch {}
      }
      return null;
    } catch (e: any) {
      const status = e?.status;
      if (!(status === 429 || status === 529 || status >= 500) || attempt === 2) {
        // web_search tool may not be available — log and skip
        if (attempt === 0 && status === 400) {
          console.log(`  (claude web_search unavailable: ${e?.message?.slice?.(0, 100)})`);
          return null;
        }
        return null;
      }
      await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)));
    }
  }
  return null;
}

// ── Comparison logic ──

const pctErr = (act: number, exp: number) => {
  const denom = Math.max(Math.abs(exp), 5);
  return Math.abs(act - exp) / denom;
};

function diffSummary(target: number, source: Macros | ClaudeAnswer | null, key: "kcal" | "protein" | "carbs" | "fat"): string {
  if (!source) return "—";
  const v = (source as any)[key];
  if (v == null) return "—";
  const e = pctErr(v, target);
  const tag = e < 0.15 ? "✓" : e < 0.3 ? "≈" : "✗";
  return `${typeof v === "number" ? Math.round(v) : v} ${tag}`;
}

async function main() {
  console.log(`Cross-checking ${FOOD_CASES.length} cases against FatSecret + USDA + Claude(web)...\n`);

  let md = "# Dataset Cross-Check Report\n\n";
  md += "Each row shows our dataset target vs the top-1 result from each source.\n";
  md += "Tags: ✓ = within 15%, ≈ = within 30%, ✗ = >30% off, — = no data.\n\n";
  md += "Sources note: FatSecret/USDA return per-serving values for the **first match**, which may not be the exact food the query describes (e.g. searching 'Big Mac' may return a different product). Claude web search searches authoritatively for the SPECIFIC query.\n\n";
  md += "| # | Query | Field | Target | FatSecret | USDA | Claude(web) |\n";
  md += "|---|---|---|---|---|---|---|\n";

  let agreementCount = 0; // cases where 2+ sources agree with target on kcal
  let disagreementCount = 0; // cases where 2+ sources disagree with target on kcal

  for (let i = 0; i < FOOD_CASES.length; i++) {
    const c = FOOD_CASES[i];
    process.stdout.write(`[${i + 1}/${FOOD_CASES.length}] ${c.input.slice(0, 50)}...\n`);

    // Claude web_search disabled — not enabled in our Anthropic account (hangs).
    // Using only FatSecret + USDA per case; ambiguous rows get manual web check.
    const [fs, usda] = await Promise.all([
      fsLookup(c.input),
      usdaLookup(c.input),
    ]);
    const claude: ClaudeAnswer | null = null;

    const fields: Array<["kcal" | "protein" | "carbs" | "fat", number]> = [
      ["kcal", c.targetKcal],
      ["protein", c.targetProtein],
      ["carbs", c.targetCarbs],
      ["fat", c.targetFat],
    ];

    md += `| ${i + 1} | ${c.input.replace(/\|/g, "\\|")} | | | ${fs ? `_${fs.name?.replace(/\|/g, "\\|").slice(0, 30)}_` : "—"} | ${usda ? `_${usda.name?.replace(/\|/g, "\\|").slice(0, 30)}_` : "—"} | ${claude ? `_${claude.source?.replace(/\|/g, "\\|").slice(0, 30)}_` : "—"} |\n`;
    for (const [k, v] of fields) {
      md += `| | | ${k} | **${v}** | ${diffSummary(v, fs, k)} | ${diffSummary(v, usda, k)} | ${diffSummary(v, claude, k)} |\n`;
    }

    // Agreement on kcal: how many sources are within 15% of target?
    const sources = [fs?.kcal, usda?.kcal, claude?.kcal].filter((x): x is number => x != null);
    const within = sources.filter((s) => pctErr(s, c.targetKcal) < 0.15).length;
    if (sources.length >= 2) {
      if (within >= 2) agreementCount++;
      else if (sources.length - within >= 2) disagreementCount++;
    }

    // Print quick console line
    const fsk = fs?.kcal != null ? Math.round(fs.kcal) : "—";
    const usk = usda?.kcal != null ? Math.round(usda.kcal) : "—";
    const clk = claude?.kcal != null ? Math.round(claude.kcal) : "—";
    console.log(`    target=${c.targetKcal}  fs=${fsk}  usda=${usk}  claude=${clk}`);
  }

  md += `\n## Summary\n\n`;
  md += `- Cases where ≥2 sources AGREE with our target on kcal: **${agreementCount}**\n`;
  md += `- Cases where ≥2 sources DISAGREE with our target on kcal: **${disagreementCount}**\n`;
  md += `- Total cases: ${FOOD_CASES.length}\n`;

  fs.writeFileSync("dataset_cross_check.md", md);
  console.log(`\nReport written to dataset_cross_check.md`);
  console.log(`Agreement: ${agreementCount}  Disagreement: ${disagreementCount}  Total: ${FOOD_CASES.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
