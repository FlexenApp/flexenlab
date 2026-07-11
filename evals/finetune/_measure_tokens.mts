// Measure actual token usage for Lite with thinkingBudget=-1
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

for (const line of fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2];
}

const google = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const LITE = "gemini-3.1-flash-lite-preview";
const PREMIUM = "gemini-3-flash-preview";

const CF_SRC = fs.readFileSync("C:/Users/Leonard/Documents/Business/Flexen/flexenapp/functions/index.js", "utf8");
const mSys = CF_SRC.match(/const FOOD_SYSTEM_INSTRUCTION = `([\s\S]*?)`;/);
if (!mSys) throw new Error("Could not extract prompt");
const SYSTEM = mSys[1];

const queries = [
  "medium banana",
  "Big Mac with medium fries and a Coke",
  "chicken tikka masala with basmati rice",
  "2 tablespoons of peanut butter",
  "a generous serving of chicken fried rice",
];

const KEYS = `\nReturn JSON with EXACTLY these keys: name, kcal, carbsG, proteinG, fatG, servingSize, confidence, reasoning.`;

for (const q of queries) {
  const prompt = `${SYSTEM}${KEYS}\n\nFood to estimate: <user_input>${q}</user_input>`;

  // Lite with thinkingBudget=-1 (current config)
  const res = await google.models.generateContent({
    model: LITE,
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
      maxOutputTokens: 16384,
      thinkingConfig: { thinkingBudget: -1 },
    },
  });

  const usage = res.usageMetadata;
  console.log(`[LITE thinkBudget=-1] "${q.substring(0, 40)}"`);
  console.log(`  input: ${usage?.promptTokenCount}  output: ${usage?.candidatesTokenCount}  thinking: ${usage?.thoughtsTokenCount ?? 'N/A'}  total: ${usage?.totalTokenCount}`);

  // Premium (no thinking)
  const res2 = await google.models.generateContent({
    model: PREMIUM,
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });
  const u2 = res2.usageMetadata;
  console.log(`[PREMIUM]            "${q.substring(0, 40)}"`);
  console.log(`  input: ${u2?.promptTokenCount}  output: ${u2?.candidatesTokenCount}  thinking: ${u2?.thoughtsTokenCount ?? 'N/A'}  total: ${u2?.totalTokenCount}`);
  console.log();
}
