'use strict';
// Pools ALL translate-work/part-*.json (BOM-tolerant), writes de-cache.json keyed by exerciseId,
// reports coverage vs the 1500 source ids, and emits retry-NN.json chunks (<=40) for any missing ids.
const fs = require('fs');
const path = require('path');
const { toDisplayName, cleanInstructions } = require('./lib/clean');

const WORK = path.join(__dirname, 'translate-work');
const DATA = path.join(__dirname, '..', 'exercisedb-data');
const strip = s => s.replace(/^﻿/, '');

const exercises = JSON.parse(fs.readFileSync(path.join(DATA, 'exercises.json'), 'utf8'));
const byId = {}; exercises.forEach(e => { byId[e.exerciseId] = e; });
const enLen = {}; exercises.forEach(e => { enLen[e.exerciseId] = cleanInstructions(e.instructions).length; });

// pool every part file
const pool = {};
for (const f of fs.readdirSync(WORK).filter(f => /^part-.*\.json$/.test(f))) {
  let p;
  try { p = JSON.parse(strip(fs.readFileSync(path.join(WORK, f), 'utf8'))); }
  catch (e) { console.log(`  skip ${f} (invalid: ${e.message})`); continue; }
  for (const [id, t] of Object.entries(p)) {
    if (!t || !t.name || !byId[id]) continue;
    pool[id] = { name: t.name, overview: t.overview || '', instructions: Array.isArray(t.instructions) ? t.instructions : [] };
  }
}

const allIds = exercises.map(e => e.exerciseId);
const missing = allIds.filter(id => !pool[id]);
let mismatches = 0;
allIds.forEach(id => { if (pool[id] && pool[id].instructions.length !== enLen[id]) mismatches++; });

const out = {};
allIds.forEach(id => { if (pool[id]) out[id] = pool[id]; });
fs.writeFileSync(path.join(__dirname, 'de-cache.json'), JSON.stringify(out, null, 0));
console.log(`covered ${Object.keys(out).length}/1500 | missing ${missing.length} | instr-length-mismatch ${mismatches}`);

// clear old retry chunks, emit new ones for missing ids
fs.readdirSync(WORK).filter(f => /^retry-\d+\.json$/.test(f)).forEach(f => fs.unlinkSync(path.join(WORK, f)));
const RSIZE = 40;
let r = 0;
for (let i = 0; i < missing.length; i += RSIZE) {
  const items = missing.slice(i, i + RSIZE).map(id => {
    const e = byId[id];
    return { id, name: toDisplayName(e.name), overview: e.overview || '', instructions: cleanInstructions(e.instructions) };
  });
  fs.writeFileSync(path.join(WORK, `retry-${String(r).padStart(2, '0')}.json`), JSON.stringify(items, null, 0));
  r++;
}
console.log(missing.length ? `wrote ${r} retry chunk(s) (<=${RSIZE}) for missing ids` : '✓ FULL COVERAGE 1500/1500');
