// Diagnostic: fire 1 real NutriBench case at each candidate model.
// Runs in PARALLEL with per-call 120s timeout + streaming progress logs.
import fs from "fs";
import OpenAI from "openai";

const KEYS = fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8")
  .split("\n").filter(Boolean).reduce((a, l) => { const [k, ...v] = l.split("="); a[k] = v.join("="); return a; }, {});
process.env.OPENAI_API_KEY = KEYS.OPENAI_API_KEY;
process.env.OLLAMA_API_KEY = KEYS.OLLAMA_API_KEY;

const ollama = new OpenAI({ apiKey: KEYS.OLLAMA_API_KEY, baseURL: "https://ollama.com/v1", timeout: 120_000 });
const openai = new OpenAI({ apiKey: KEYS.OPENAI_API_KEY, timeout: 60_000 });

const SAMPLE = JSON.parse(fs.readFileSync("nutribench_smoke20.json", "utf8"));
const CASE = SAMPLE[0];

const PROMPT = `You are a certified nutritionist. Estimate the nutritional content of the described food.

CONTEXT:
- Region: United States

Return ONLY a JSON object with these exact keys:
  name (string), kcal (number), carbsG (number), proteinG (number),
  fatG (number), servingSize (string), confidence ("HIGH"|"MEDIUM"|"LOW").
NO reasoning text, NO markdown fences. Just the JSON object.

Food to estimate: ${CASE.meal_description}`;

const CANDIDATES = [
  { provider: "ollama", model: "qwen3.5:397b",    kind: "reasoning-moe" },
  { provider: "ollama", model: "qwen3-next:80b",  kind: "reasoning" },
  { provider: "ollama", model: "deepseek-v3.2",   kind: "reasoning" },
  { provider: "ollama", model: "kimi-k2-thinking",kind: "reasoning" },
  { provider: "ollama", model: "minimax-m2.7",    kind: "reasoning" },
  { provider: "ollama", model: "glm-5.1",         kind: "reasoning" },
  { provider: "ollama", model: "gpt-oss:120b",    kind: "reasoning" },
  { provider: "ollama", model: "gpt-oss:20b",     kind: "dense" },
  { provider: "ollama", model: "gemma4:31b",      kind: "dense" },
  { provider: "ollama", model: "gemma3:27b",      kind: "dense" },
  { provider: "ollama", model: "ministral-3:14b", kind: "dense" },
  { provider: "ollama", model: "ministral-3:8b",  kind: "dense" },
  { provider: "openai", model: "gpt-4.1-nano",    kind: "dense" },
  { provider: "openai", model: "gpt-5-mini",      kind: "dense" },
];

function log(msg) {
  process.stdout.write(msg + "\n");
}

function extractJson(txt) {
  if (!txt) return null;
  let t = String(txt).replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.substring(first, last + 1);
  try { return JSON.parse(t); } catch { return null; }
}

async function testOne(idx, total, { provider, model, kind }) {
  log(`[${idx+1}/${total}] ▶ starting ${provider}/${model}`);
  const client = provider === "ollama" ? ollama : openai;
  const t0 = Date.now();
  try {
    // GPT-5 family (reasoning models) use max_completion_tokens + no temperature override
    const isGpt5 = /^gpt-5/.test(model);
    const body = {
      model,
      messages: [
        { role: "system", content: "Respond with a single valid JSON object only. No reasoning, no prose, no markdown." },
        { role: "user", content: PROMPT },
      ],
    };
    if (isGpt5) {
      body.max_completion_tokens = 8192;
    } else {
      body.temperature = 0.1;
      body.max_tokens = 8192;
    }
    if (provider === "openai") body.response_format = { type: "json_object" };

    const res = await client.chat.completions.create(body);
    const dt = Date.now() - t0;
    const msg = res.choices[0]?.message ?? {};
    const content = (msg.content ?? "").trim();
    const reasoning = (msg.reasoning ?? "").trim();
    const chosen = content || reasoning;
    const parsed = extractJson(chosen);
    const ok = parsed && typeof parsed.kcal === "number";
    const usage = res.usage ?? {};
    const line = ok
      ? `[${idx+1}/${total}] ✓ ${provider}/${model}  ${dt}ms  ${usage.prompt_tokens}/${usage.completion_tokens} tok  kcal=${parsed.kcal}`
      : `[${idx+1}/${total}] ✗ ${provider}/${model}  ${dt}ms  parse-fail  raw: ${chosen.substring(0,100).replace(/\n/g," ")}`;
    log(line);
    return { model, provider, kind, ok, dt, inTok: usage.prompt_tokens, outTok: usage.completion_tokens,
             contentEmpty: !content, reasoningUsed: !content && !!reasoning,
             rawPreview: ok ? null : chosen.substring(0, 200) };
  } catch (e) {
    const dt = Date.now() - t0;
    const errMsg = String(e.message ?? e).substring(0, 150);
    log(`[${idx+1}/${total}] ✗ ${provider}/${model}  ${dt}ms  ERROR: ${errMsg}`);
    return { model, provider, kind, ok: false, dt, error: errMsg };
  }
}

log(`\nDiagnostic on: "${CASE.meal_description}"`);
log(`Ground truth:  ${CASE.energy} kcal, ${CASE.protein}g P / ${CASE.carb}g C / ${CASE.fat}g F\n`);

// Ollama Cloud only allows 1 concurrent request per account → sequential.
// OpenAI runs in parallel to save time.
const ollamaCandidates = CANDIDATES.filter(c => c.provider === "ollama");
const openaiCandidates = CANDIDATES.filter(c => c.provider === "openai");

const results = [];
// OpenAI in parallel
const openaiPromises = openaiCandidates.map((c, i) =>
  testOne(CANDIDATES.indexOf(c), CANDIDATES.length, c)
);
// Ollama sequential (interleaved with OpenAI for perceived progress)
for (const c of ollamaCandidates) {
  results.push(await testOne(CANDIDATES.indexOf(c), CANDIDATES.length, c));
}
// Now collect OpenAI results
results.push(...(await Promise.all(openaiPromises)));

log("\n\n═══════════════ SUMMARY ═══════════════");
const winners = results.filter(r => r.ok);
const losers = results.filter(r => !r.ok);
log(`\n✓ WORKING (${winners.length}/${results.length}):`);
winners.sort((a, b) => a.dt - b.dt).forEach(r =>
  log(`   ${(r.provider + "/" + r.model).padEnd(30)}  ${String(r.dt).padStart(6)}ms  ${r.inTok || "?"}→${r.outTok || "?"} tok${r.reasoningUsed ? "  [reasoning fallback]" : ""}`)
);
log(`\n✗ BROKEN (${losers.length}/${results.length}):`);
losers.forEach(r =>
  log(`   ${(r.provider + "/" + r.model).padEnd(30)}  ${r.error || "parse failed"}`)
);

fs.writeFileSync("diagnose_results.json", JSON.stringify(results, null, 2));
log("\nSaved: diagnose_results.json");
