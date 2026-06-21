'use strict';
const { init } = require('./lib/admin');
const { db } = init();
const MOJI = /Ã|Â|â€/;

async function main() {
  const snap = await db.collection('exercises').get();
  let total = 0, noGif = 0, noThumb = 0, moji = 0, trailing = 0, stepN = 0, noDisplay = 0, noDe = 0;
  snap.forEach(d => {
    const x = d.data(); total++;
    if (!x.gifUrl) noGif++;
    if (!x.thumbUrl) noThumb++;
    if (!x.displayName) noDisplay++;
    if (!x.i18n || !x.i18n.de || !x.i18n.de.name) noDe++;
    const blob = [x.name, x.displayName, (x.i18n && x.i18n.de && x.i18n.de.name) || ''].join(' ');
    if (MOJI.test(blob)) moji++;
    if (x.name && x.name !== x.name.trim()) trailing++;
    if ((x.instructions || []).some(s => /^Step:/i.test(s))) stepN++;
  });
  const report = { total, noGif, noThumb, noDisplay, noDe, moji, trailing, stepN };
  console.log(JSON.stringify(report, null, 2));
  const pass = total === 1500 && !noGif && !noThumb && !noDisplay && !noDe && !moji && !trailing && !stepN;
  console.log(pass ? '✓ ALL ACCEPTANCE CHECKS PASS' : '✗ FAILURES PRESENT');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
