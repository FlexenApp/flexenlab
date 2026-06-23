'use strict';
// Splits the 1500 exercises into cleaned EN chunks for Claude-subagent translation.
// Output: translate-work/chunk-NN.json  (each = [{id, name, overview, instructions[]}])
const fs = require('fs');
const path = require('path');
const { toDisplayName, cleanInstructions } = require('./lib/clean');

const DATA_DIR = path.join(__dirname, '..', 'exercisedb-data');
const OUT = path.join(__dirname, 'translate-work');
const CHUNK = 100;

const exercises = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'exercises.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });

const items = exercises.map(e => ({
  id: e.exerciseId,
  name: toDisplayName(e.name),
  overview: e.overview || '',
  instructions: cleanInstructions(e.instructions),
}));

let n = 0;
for (let i = 0; i < items.length; i += CHUNK) {
  const chunk = items.slice(i, i + CHUNK);
  fs.writeFileSync(path.join(OUT, `chunk-${String(n).padStart(2, '0')}.json`), JSON.stringify(chunk, null, 0));
  n++;
}
console.log(`wrote ${n} chunks (<=${CHUNK} each) of ${items.length} exercises into translate-work/`);
