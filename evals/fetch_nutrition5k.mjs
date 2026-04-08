// Pulls a 50-dish sample from Nutrition5k for the image eval.
// Downloads overhead RGB images + builds nutrition5k_sample.json with targets.

import fs from "fs";
import path from "path";

const SAMPLE_SIZE = 50;
const META = "nutrition5k/metadata_cafe1.csv";
const IMG_DIR = "nutrition5k/images";
const OUT = "nutrition5k_sample.json";

fs.mkdirSync(IMG_DIR, { recursive: true });

// Parse: each row starts with dish_id, total_calories, total_mass, total_fat, total_carb, total_protein
const lines = fs.readFileSync(META, "utf8").trim().split("\n");
console.log(`Metadata has ${lines.length} dishes`);

// Random sample without replacement
const indices = new Set();
while (indices.size < Math.min(SAMPLE_SIZE * 2, lines.length)) {
  indices.add(Math.floor(Math.random() * lines.length));
}

const sample = [];
let downloaded = 0;
for (const idx of indices) {
  if (sample.length >= SAMPLE_SIZE) break;
  const cells = lines[idx].split(",");
  const dishId = cells[0];
  const kcal = parseFloat(cells[1]);
  const mass = parseFloat(cells[2]);
  const fat = parseFloat(cells[3]);
  const carbs = parseFloat(cells[4]);
  const protein = parseFloat(cells[5]);

  // Sanity filter: skip dishes with implausible / missing values
  if (isNaN(kcal) || kcal < 30 || kcal > 2500 || mass < 20) continue;

  // Try to download overhead RGB
  const url = `https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset/imagery/realsense_overhead/${dishId}/rgb.png`;
  const localPath = path.join(IMG_DIR, `${dishId}.png`);
  if (!fs.existsSync(localPath)) {
    process.stdout.write(`[${sample.length + 1}/${SAMPLE_SIZE}] ${dishId}... `);
    const r = await fetch(url);
    if (!r.ok) {
      console.log(`SKIP (${r.status})`);
      continue;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(localPath, buf);
    console.log(`${(buf.length / 1024).toFixed(0)} KB`);
    downloaded++;
  }

  // Extract first ~5 ingredients for context
  const ingredients = [];
  for (let i = 6; i < cells.length; i += 7) {
    if (cells[i + 1]) ingredients.push(cells[i + 1]);
    if (ingredients.length >= 8) break;
  }

  sample.push({
    dish_id: dishId,
    image_path: localPath,
    kcal,
    mass_g: mass,
    fat_g: fat,
    carbs_g: carbs,
    protein_g: protein,
    ingredients,
  });
}

fs.writeFileSync(OUT, JSON.stringify(sample, null, 2));
console.log(`\nDownloaded ${downloaded} images, ${sample.length} cases → ${OUT}`);
