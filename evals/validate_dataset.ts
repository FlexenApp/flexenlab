// Sanity-checks every FOOD_CASE target against an authoritative source.
// Uses Claude with explicit instructions to ONLY trust published brand data
// or USDA/standard nutrition databases, and to flag anything that looks
// off by more than ~25%.
//
// Run:  npx tsx validate_dataset.ts
//
// Output:
//   - prints a per-case verdict to stdout
//   - writes dataset_audit.md with full results

import "dotenv/config";
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { FOOD_CASES, type FoodCase } from "./dataset.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = "claude-sonnet-4-5";

type Audit = {
  case: FoodCase;
  verdict: "OK" | "ADJUST" | "WRONG";
  flaggedFields: string[];
  suggestedKcal?: number;
  suggestedProtein?: number;
  suggestedCarbs?: number;
  suggestedFat?: number;
  rationale: string;
};

const PROMPT = (c: FoodCase) => `You are a senior nutritionist auditing a test dataset for an AI nutrition app.

A test case has these proposed ground-truth values:

QUERY: "${c.input}"
PROPOSED TARGETS:
- Calories: ${c.targetKcal} kcal
- Protein: ${c.targetProtein}g
- Carbs: ${c.targetCarbs}g
- Fat: ${c.targetFat}g

SOURCING NOTES (what the dataset author was thinking): ${c.notes}

Your job: validate the proposed targets against authoritative data ONLY:
- Published brand nutrition facts (Starbucks, In-N-Out, Beyond Burger, B&J, Sam's Club, etc.)
- USDA FoodData Central
- Standard food databases / cookbook references
- For obscure items: state explicitly that no public nutrition exists and assess whether the estimate is reasonable

DO NOT speculate. If you don't have a confident source for a value, say so.

Be strict. A target is OK only if every macro is within ~15% of what authoritative data supports. ADJUST means at least one macro is off by 15-40%. WRONG means a macro is >40% off OR the food was misidentified in the notes.

Return ONLY this JSON (no markdown, no extra text):
{
  "verdict": "OK" | "ADJUST" | "WRONG",
  "flagged_fields": ["kcal" | "protein" | "carbs" | "fat", ...],
  "suggested_kcal": <number or null>,
  "suggested_protein": <number or null>,
  "suggested_carbs": <number or null>,
  "suggested_fat": <number or null>,
  "rationale": "<2-4 sentences citing your sources>"
}`;

async function auditCase(c: FoodCase): Promise<Audit> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 800,
        temperature: 0,
        messages: [{ role: "user", content: PROMPT(c) }],
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      let cleaned = text.trim();
      if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) cleaned = m[0];
      const j = JSON.parse(cleaned);
      return {
        case: c,
        verdict: j.verdict ?? "ADJUST",
        flaggedFields: j.flagged_fields ?? [],
        suggestedKcal: j.suggested_kcal ?? undefined,
        suggestedProtein: j.suggested_protein ?? undefined,
        suggestedCarbs: j.suggested_carbs ?? undefined,
        suggestedFat: j.suggested_fat ?? undefined,
        rationale: j.rationale ?? "",
      };
    } catch (e: any) {
      const status = e?.status;
      if (!(status === 429 || status === 529 || status >= 500) || attempt === 4) throw e;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt) + Math.random() * 500));
    }
  }
  throw new Error("unreachable");
}

async function main() {
  console.log(`Auditing ${FOOD_CASES.length} cases against authoritative sources...\n`);

  const results: Audit[] = [];
  // Sequential to keep under rate limit
  for (let i = 0; i < FOOD_CASES.length; i++) {
    const c = FOOD_CASES[i];
    process.stdout.write(`[${i + 1}/${FOOD_CASES.length}] ${c.input.slice(0, 50)}... `);
    try {
      const r = await auditCase(c);
      results.push(r);
      const tag = r.verdict === "OK" ? "✓" : r.verdict === "ADJUST" ? "⚠" : "✗";
      console.log(`${tag} ${r.verdict}${r.flaggedFields.length ? " [" + r.flaggedFields.join(",") + "]" : ""}`);
    } catch (e: any) {
      console.log(`ERROR: ${e?.message ?? e}`);
    }
  }

  // Markdown report
  let md = "# Dataset Audit Report\n\n";
  md += `Audited ${results.length} cases.\n\n`;
  const ok = results.filter((r) => r.verdict === "OK").length;
  const adjust = results.filter((r) => r.verdict === "ADJUST").length;
  const wrong = results.filter((r) => r.verdict === "WRONG").length;
  md += `- ✓ OK: **${ok}**\n- ⚠ ADJUST: **${adjust}**\n- ✗ WRONG: **${wrong}**\n\n---\n\n`;

  for (const r of results) {
    if (r.verdict === "OK") continue;
    md += `## ${r.verdict === "WRONG" ? "✗" : "⚠"} ${r.case.input}\n\n`;
    md += `**Flagged:** ${r.flaggedFields.join(", ") || "—"}\n\n`;
    md += `**Current:** ${r.case.targetKcal} kcal, ${r.case.targetProtein}g P, ${r.case.targetCarbs}g C, ${r.case.targetFat}g F\n\n`;
    if (r.suggestedKcal != null || r.suggestedProtein != null || r.suggestedCarbs != null || r.suggestedFat != null) {
      md += `**Suggested:** ${r.suggestedKcal ?? "—"} kcal, ${r.suggestedProtein ?? "—"}g P, ${r.suggestedCarbs ?? "—"}g C, ${r.suggestedFat ?? "—"}g F\n\n`;
    }
    md += `**Rationale:** ${r.rationale}\n\n---\n\n`;
  }

  // Also include the OK ones at the end for completeness
  md += "## ✓ Cases passing audit\n\n";
  for (const r of results) {
    if (r.verdict === "OK") md += `- ${r.case.input} — ${r.rationale}\n`;
  }

  fs.writeFileSync("dataset_audit.md", md);
  console.log(`\n✓ ${ok}  ⚠ ${adjust}  ✗ ${wrong}`);
  console.log("Report written to dataset_audit.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
