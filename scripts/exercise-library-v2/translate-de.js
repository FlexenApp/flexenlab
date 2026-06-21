'use strict';
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { cleanName, toDisplayName, cleanInstructions } = require('./lib/clean');

const DATA_DIR = path.join(__dirname, '..', 'exercisedb-data');
const CACHE = path.join(__dirname, 'de-cache.json');
const BATCH = 20;
const glossary = require('./glossary.json');

const key = process.env.GEMINI_API_KEY;
if (!key) { console.error('Set GEMINI_API_KEY'); process.exit(1); }
const model = new GoogleGenerativeAI(key).getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
});

const glossaryText = Object.entries(glossary).map(([e, d]) => `- "${e}" → "${d}"`).join('\n');

function prompt(items) {
  return `Übersetze diese Fitnessübungen ins Deutsche. Behalte etablierte Anglizismen (z.B. "Curl", "Workout", "Set"). Nutze dieses Fachglossar wo passend:\n${glossaryText}\n\nGib NUR ein JSON-Array zurück, gleiche Reihenfolge, je Objekt {"name","overview","instructions":[...]} — instructions als Array gleicher Länge.\n\nINPUT:\n${JSON.stringify(items.map(i => ({ name: i.name, overview: i.overview, instructions: i.instructions })))}`;
}

async function main() {
  const exercises = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'exercises.json'), 'utf8'));
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const todo = exercises.filter(e => !cache[e.exerciseId]);
  console.log(`${todo.length} to translate (${Object.keys(cache).length} cached)`);

  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const items = slice.map(e => ({ id: e.exerciseId, name: toDisplayName(e.name), overview: e.overview || '', instructions: cleanInstructions(e.instructions) }));
    try {
      const res = await model.generateContent(prompt(items));
      const arr = JSON.parse(res.response.text());
      slice.forEach((e, idx) => { if (arr[idx] && arr[idx].name) cache[e.exerciseId] = arr[idx]; });
      fs.writeFileSync(CACHE, JSON.stringify(cache, null, 0));
    } catch (err) {
      console.error(`\n✗ batch @${i}: ${err.message}`);
    }
    process.stdout.write(`\r  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  }
  console.log(`\n✓ cached translations: ${Object.keys(cache).length}`);
}
main().catch(e => { console.error(e); process.exit(1); });
