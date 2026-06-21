'use strict';
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'exercisedb-data');
const SRC = path.join(DATA_DIR, 'gifs_720x720');
const OUT_ANIM = path.join(__dirname, 'webp', 'anim');
const OUT_THUMB = path.join(__dirname, 'webp', 'thumb');
const LIMIT = (process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1];

async function buildOne(exerciseId, gifFile) {
  const src = path.join(SRC, gifFile);
  if (!fs.existsSync(src)) return 'missing';
  const anim = path.join(OUT_ANIM, `${exerciseId}.webp`);
  const thumb = path.join(OUT_THUMB, `${exerciseId}.webp`);
  if (!fs.existsSync(anim)) await sharp(src, { animated: true }).webp({ quality: 70, effort: 4 }).toFile(anim);
  if (!fs.existsSync(thumb)) await sharp(src).resize(256, 256, { fit: 'inside' }).webp({ quality: 75 }).toFile(thumb);
  return 'ok';
}

async function main() {
  fs.mkdirSync(OUT_ANIM, { recursive: true });
  fs.mkdirSync(OUT_THUMB, { recursive: true });
  let exercises = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'exercises.json'), 'utf8'));
  if (LIMIT) exercises = exercises.slice(0, parseInt(LIMIT, 10));
  let ok = 0, missing = 0, errored = 0;
  for (const ex of exercises) {
    const gif = ex.gifUrls && ex.gifUrls['720p'];
    if (!gif) { missing++; continue; }
    try { (await buildOne(ex.exerciseId, gif)) === 'ok' ? ok++ : missing++; }
    catch (e) { console.error(`\n✗ ${ex.exerciseId}: ${e.message}`); errored++; }
    if (ok % 100 === 0 && ok > 0) process.stdout.write(`\r  built ${ok}/${exercises.length}`);
  }
  console.log(`\n✓ built ${ok}, missing ${missing}, errored ${errored}`);
  if (errored > 0) { console.error(`✗ ${errored} GIF(s) failed conversion — inspect before uploading.`); process.exit(1); }
}
main().catch(e => { console.error(e); process.exit(1); });
