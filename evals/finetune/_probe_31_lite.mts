import { GoogleGenAI } from "@google/genai";
import fs from "fs";
for (const line of fs.readFileSync("C:/Users/Leonard/.flexen/api_keys.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2];
}
const g = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const ids = [
  "gemini-3-flash-lite-preview",
  "gemini-3-1-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3-1-flash-lite-preview",
  "gemini-3.1-flash-lite-preview",
];
for (const m of ids) {
  try {
    const r = await g.models.generateContent({
      model: m, contents: "ping",
      config: { maxOutputTokens: 20, thinkingConfig: { thinkingBudget: 0 } },
    });
    console.log("✓", m, "→", (r.text || "").substring(0, 40));
  } catch (e: any) { console.log("✗", m, "→", String(e.message || e).substring(0, 120)); }
}
