'use strict';
const fs = require('fs');
const path = require('path');
const { init } = require('./lib/admin');
const { db } = init();

async function main() {
  const dir = path.join(__dirname, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const snap = await db.collection('exercises').get();
  const out = {};
  snap.forEach(d => { out[d.id] = d.data(); });
  const stamp = (process.argv.find(a => a.startsWith('--stamp=')) || '--stamp=manual').split('=')[1];
  const file = path.join(dir, `exercises-backup-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`✓ backed up ${snap.size} docs → ${file}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
