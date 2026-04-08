// Single LLM-as-judge call that evaluates the model on 6 dimensions at once.
// Adapted from Chris Raroque's Amy Backend "Nutrition Judge" pattern: instead
// of 3 separate Claude calls (name lang / portion / fact-check), do ONE call
// returning JSON with 6 sub-scores. Saves ~2/3 of cost + latency.
//
// Critical disclaimer in the prompt (also from Chris): the reference is ONE
// example of a good answer; alternative reasoning paths reaching the same
// conclusion are equally valid. Without this, judges over-penalize creative
// (correct) answers that don't match the rubric verbatim.

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = "claude-sonnet-4-5";

export type JudgeScores = {
  overall_score: number;       // 0..1 — single headline judgment
  food_recognition: number;    // 0..1 — did it identify the right food
  numerical_accuracy: number;  // 0..1 — macros vs reference
  reasoning_quality: number;   // 0..1 — is the chain-of-thought sound
  portion_understanding: number; // 0..1 — fractions/multipliers/sizes parsed
  language_match: number;      // 0..1 — name field in user's language
  confidence_calibration: number; // 0..1 — HIGH/MED/LOW appropriate
  comment: string;             // free-text summary
  // usage metrics for cost tracking
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

// Claude Sonnet 4.5 pricing (Nov 2025): $3/1M input, $15/1M output
const CLAUDE_INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const CLAUDE_OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

const RUBRIC = `You are evaluating an AI nutrition assistant. Score on 6 dimensions, each 1-5.

CRITICAL DISCLAIMER: The reference is ONE example of a good answer. Different
reasoning paths reaching equivalent numbers are equally valid. Do not penalize
creative or differently-worded answers — penalize ONLY when numbers are
quantitatively wrong, the food is misidentified, or reasoning has clear
factual errors.

Dimensions (each 1-5) — USE THESE EXPLICIT THRESHOLDS:

food_recognition: Did the model identify the right food / cuisine?
  5 = correct food, correct preparation, correct cultural context
  4 = correct food, minor preparation detail off
  3 = right food category, wrong specific dish
  2 = adjacent / confused (e.g. burrito vs taco)
  1 = wrong food entirely

numerical_accuracy: Compare each macro (kcal, protein, carbs, fat) to reference.
  Compute the worst-macro percent error: max over macros of |actual - ref| / ref.
  5 = worst-macro error < 10%
  4 = worst-macro error 10-20%
  3 = worst-macro error 20-35%
  2 = worst-macro error 35-60%
  1 = worst-macro error > 60% OR a sign error / missing macro

reasoning_quality: Is the model's "reasoning" field internally consistent and
factually defensible?
  5 = sound chain of thought, math checks out, references plausible values
  4 = mostly sound, one minor leap
  3 = ok logic but a calibration drift
  2 = visible math/identification errors
  1 = contradictory or fabricated reasoning

portion_understanding: Did it correctly parse modifiers (klein/groß/halbes,
"4 glasses", "two scoops", "large", "extra X")?
  5 = all modifiers parsed correctly and reflected in numbers
  4 = modifiers parsed but slightly under/over-applied
  3 = ignored ONE modifier (e.g. ignored "groß")
  2 = ignored most modifiers
  1 = used a totally wrong base portion

language_match: Is the "name" field in the language the user used?
  5 = name in user's language
  3 = name in a different but related language
  1 = name in wrong language

confidence_calibration: Is HIGH/MEDIUM/LOW appropriate to actual ambiguity?
  5 = exact bucket match
  3 = one bucket off
  1 = two buckets off (e.g. HIGH for an unknowable item)

overall_score: Holistic single number — NOT the average. Weight numerical_accuracy
heaviest (this is a calorie-tracker), then food_recognition, then portion. A
response with great reasoning but 70% numerical drift should NOT score above 2.

Return ONLY this JSON (no markdown, no commentary, no preamble):
{"overall_score": <1-5>, "food_recognition": <1-5>, "numerical_accuracy": <1-5>, "reasoning_quality": <1-5>, "portion_understanding": <1-5>, "language_match": <1-5>, "confidence_calibration": <1-5>, "comment": "<one sentence summary>"}`;

export async function nutritionJudge(args: {
  userInput: string;
  language: string;
  notes: string;
  reference: { kcal: number; protein: number; carbs: number; fat: number; expectedConfidence: string | null };
  modelOutput: {
    name: string;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    confidence: string;
    servingSize: string;
    reasoning?: string;
  };
}): Promise<JudgeScores> {
  const prompt = `${RUBRIC}

USER INPUT: "${args.userInput}"
USER LANGUAGE: ${args.language}

REFERENCE (one valid answer, with sources in notes):
- Calories: ${args.reference.kcal}
- Protein: ${args.reference.protein}g
- Carbs: ${args.reference.carbs}g
- Fat: ${args.reference.fat}g
- Expected confidence bucket: ${args.reference.expectedConfidence ?? "any"}
- Notes: ${args.notes}

MODEL'S ACTUAL RESPONSE:
- name: ${args.modelOutput.name}
- kcal: ${args.modelOutput.kcal}
- protein: ${args.modelOutput.proteinG}g
- carbs: ${args.modelOutput.carbsG}g
- fat: ${args.modelOutput.fatG}g
- confidence: ${args.modelOutput.confidence}
- servingSize: ${args.modelOutput.servingSize}
- reasoning: ${args.modelOutput.reasoning ?? "(none)"}

Now return the JSON.`;

  // Retry on rate-limit / 5xx
  let res: Anthropic.Message | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 600,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      });
      break;
    } catch (e: any) {
      lastErr = e;
      const status = e?.status ?? e?.error?.status;
      if (!(status === 429 || status === 529 || status >= 500) || attempt === 4) throw e;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt) + Math.random() * 500));
    }
  }
  if (!res) throw lastErr ?? new Error("anthropic call failed");

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  // Parse JSON (strip markdown fences if present)
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
  }
  // Extract first balanced JSON object — bracket-counting walker, not regex.
  // Handles "Here is my eval: { ... } let me know" and "{ ...scratch... }\n{ ...result... }".
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace >= 0) {
    let depth = 0;
    let end = -1;
    let inString = false;
    let escaped = false;
    for (let i = firstBrace; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end > firstBrace) cleaned = cleaned.slice(firstBrace, end + 1);
  }

  const raw = JSON.parse(cleaned) as Record<string, number | string>;
  const norm = (v: unknown): number => {
    const n = Number(v);
    if (isNaN(n)) return 0;
    // 1-5 → 0-1
    return Math.max(0, Math.min(1, (n - 1) / 4));
  };

  const inputTokens = res.usage?.input_tokens ?? 0;
  const outputTokens = res.usage?.output_tokens ?? 0;
  const costUsd =
    inputTokens * CLAUDE_INPUT_COST_PER_TOKEN +
    outputTokens * CLAUDE_OUTPUT_COST_PER_TOKEN;

  return {
    overall_score: norm(raw.overall_score),
    food_recognition: norm(raw.food_recognition),
    numerical_accuracy: norm(raw.numerical_accuracy),
    reasoning_quality: norm(raw.reasoning_quality),
    portion_understanding: norm(raw.portion_understanding),
    language_match: norm(raw.language_match),
    confidence_calibration: norm(raw.confidence_calibration),
    comment: String(raw.comment ?? ""),
    inputTokens,
    outputTokens,
    costUsd,
  };
}
