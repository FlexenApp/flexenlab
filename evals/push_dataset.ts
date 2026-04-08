// Pushes FOOD_CASES to Braintrust as a managed Dataset.
// Run:  npx tsx push_dataset.ts
//
// After this, the dataset shows up at:
//   Braintrust UI → flexen-food-text → Datasets → food-text-hard-cases
// and the eval can reference it by name instead of inlining the data.

import "dotenv/config";
import { initDataset } from "braintrust";
import { FOOD_CASES } from "./dataset.js";

async function main() {
  const ds = initDataset("flexen-food-text", {
    dataset: "food-text-hard-cases",
    description:
      "Hard, evidence-based test cases for Flexen's text-based food estimation. " +
      "Each case has target macros + tolerances, ground-truth notes, and expected confidence. " +
      "Mirrors the cases used by food_text.eval.ts.",
  });

  // Wipe & re-upload (idempotent: same `id` overwrites the row)
  for (let i = 0; i < FOOD_CASES.length; i++) {
    const c = FOOD_CASES[i];
    ds.insert({
      id: `case-${i}-${c.input.slice(0, 40).replace(/\s+/g, "_")}`,
      input: c, // full case so the eval can read tolerances + expectedConfidence
      expected: {
        targetKcal: c.targetKcal,
        targetProtein: c.targetProtein,
        targetCarbs: c.targetCarbs,
        targetFat: c.targetFat,
        expectedConfidence: c.expectedConfidence,
        language: c.language,
      },
      metadata: {
        language: c.language,
        expectedConfidence: c.expectedConfidence,
        notes: c.notes,
      },
      tags: [c.language, c.expectedConfidence ?? "no-conf"],
    });
  }

  const summary = await ds.summarize();
  console.log("Dataset uploaded:", summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
