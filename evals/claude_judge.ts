// Lightweight Claude-based LLM-as-judge. We don't go through autoevals' proxy
// path because that requires the Anthropic key to be configured in Braintrust
// Workspace Settings; here we use the Anthropic SDK directly with the local
// ANTHROPIC_API_KEY from .env.

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = "claude-sonnet-4-5";

export type Choice = { letter: string; score: number };

/**
 * Ask Claude a multiple-choice question. Returns {score, rationale, picked}.
 * Prompt MUST instruct Claude to end with "Answer: X" where X is one of the
 * letters in `choices`.
 */
export async function judge(
  prompt: string,
  choices: Choice[],
  { useCoT = true }: { useCoT?: boolean } = {},
): Promise<{ score: number; picked: string | null; rationale: string }> {
  const letters = choices.map((c) => c.letter).join(", ");
  const instructions = useCoT
    ? `Think step-by-step in 1-3 sentences, then on a new line write exactly: Answer: <letter>\nWhere <letter> is one of: ${letters}.`
    : `Respond with exactly one line: Answer: <letter>\nWhere <letter> is one of: ${letters}.`;

  // Anthropic rate-limits hit easily during parallel evals. Retry with
  // exponential backoff + jitter on 429/529, up to 5 attempts.
  let res: Anthropic.Message | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 400,
        temperature: 0,
        messages: [{ role: "user", content: `${prompt}\n\n${instructions}` }],
      });
      break;
    } catch (e: any) {
      lastErr = e;
      const status = e?.status ?? e?.error?.status;
      const isRetryable = status === 429 || status === 529 || status >= 500;
      if (!isRetryable || attempt === 4) throw e;
      const wait = 1000 * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  if (!res) throw lastErr ?? new Error("anthropic call failed");

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const m = text.match(/Answer:\s*([A-Z])/i);
  const picked = m ? m[1].toUpperCase() : null;
  const choice = choices.find((c) => c.letter === picked);
  return {
    score: choice?.score ?? 0,
    picked,
    rationale: text,
  };
}
