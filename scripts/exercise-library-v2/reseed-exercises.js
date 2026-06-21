'use strict';
const fs = require('fs');
const path = require('path');
const { init } = require('./lib/admin');
const { buildExerciseDoc } = require('./lib/transform');

const DATA_DIR = path.join(__dirname, '..', 'exercisedb-data');
const args = process.argv.slice(2);
const CONFIRM = args.includes('--confirm');
const BATCH = 400;

function load(f) { return JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')); }
function loadData(f) { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); }

async function main() {
  const { db } = init();
  const exercises = loadData('exercises.json');
  const manifest = fs.existsSync(path.join(__dirname, 'media-manifest.json')) ? load('media-manifest.json') : {};
  const deCache = fs.existsSync(path.join(__dirname, 'de-cache.json')) ? load('de-cache.json') : {};

  const docs = exercises.map(raw => ({
    id: raw.exerciseId,
    data: buildExerciseDoc(raw, manifest[raw.exerciseId] || {}, deCache[raw.exerciseId] || null),
  }));

  if (!CONFIRM) {
    console.log('DRY RUN (no --confirm). Sample doc:');
    console.log(JSON.stringify(docs[0], null, 2));
    console.log(`\nWould write ${docs.length} docs. With media: ${docs.filter(d => d.data.gifUrl).length}, with i18n.de: ${docs.filter(d => d.data.i18n).length}`);
    return;
  }

  // Safety: refuse to overwrite without a backup on disk (backups/ is gitignored, no Firestore PITR on Spark).
  const backupDir = path.join(__dirname, 'backups');
  const hasBackup = fs.existsSync(backupDir) &&
    fs.readdirSync(backupDir).some(f => f.endsWith('.json') && fs.statSync(path.join(backupDir, f)).size > 0);
  if (!hasBackup) {
    console.error('✗ No backup found in backups/. Run backup-exercises.js first.');
    process.exit(1);
  }

  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + BATCH)) batch.set(db.collection('exercises').doc(d.id), d.data);
    await batch.commit();
    process.stdout.write(`\r  wrote ${Math.min(i + BATCH, docs.length)}/${docs.length}`);
  }

  // refresh filter metadata from clean data
  const bodyParts = loadData('bodyParts.json').map(b => b.name).sort();
  const equipments = loadData('equipments.json').map(e => e.name).sort();
  const muscles = loadData('muscles.json').map(m => m.name).sort();
  const mb = db.batch();
  mb.set(db.collection('exercises_meta').doc('bodyParts'), { values: bodyParts });
  mb.set(db.collection('exercises_meta').doc('equipment'), { values: equipments });
  mb.set(db.collection('exercises_meta').doc('targets'), { values: muscles });
  await mb.commit();

  console.log(`\n✓ wrote ${docs.length} exercises + metadata`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
