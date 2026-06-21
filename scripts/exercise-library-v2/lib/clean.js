'use strict';
const iconv = require('iconv-lite');

const MOJIBAKE_RE = /Ã|Â|â€/;
const MARKERS = /Ã|Â|â€/g;

function fixMojibake(s) {
  let cur = String(s == null ? '' : s);
  for (let i = 0; i < 3 && MOJIBAKE_RE.test(cur); i++) {
    let next;
    try { next = iconv.decode(iconv.encode(cur, 'win1252'), 'utf8'); }
    catch (_) { break; }
    if (next.includes('�') || next.includes('?') && !cur.includes('?')) break;
    if ((next.match(MARKERS) || []).length >= (cur.match(MARKERS) || []).length) break;
    cur = next;
  }
  return cur;
}

const QUALIFIER_RES = [
  / \((?:side|back|front|left|right)?\s*pov\)/gi,
  / \((?:male|female)\)/gi,
];

function cleanName(s) {
  let out = fixMojibake(s);
  for (const re of QUALIFIER_RES) out = out.replace(re, '');
  return out.replace(/\s+/g, ' ').trim();
}

const SMALL = new Set(['a','an','and','the','to','of','with','on','in','for','at','by','or']);
const ACRONYMS = { ez:'EZ', jm:'JM', 'v-bar':'V-Bar', 't-bar':'T-Bar', rdl:'RDL', ohp:'OHP' };

function capWord(w) {
  if (!w) return w;
  const lower = w.toLowerCase();
  if (ACRONYMS[lower]) return ACRONYMS[lower];
  if (w.includes('-')) return w.split('-').map(capWord).join('-');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function toDisplayName(s) {
  const words = cleanName(s).split(' ').filter(Boolean);
  return words.map((w, i) => {
    const lower = w.toLowerCase();
    if (i !== 0 && i !== words.length - 1 && SMALL.has(lower) && !w.includes('-')) return lower;
    return capWord(w);
  }).join(' ');
}

function cleanInstructions(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(s => String(s == null ? '' : s).replace(/^Step:\s*\d+\s*/i, '').trim()).filter(Boolean);
}

module.exports = { fixMojibake, cleanName, toDisplayName, cleanInstructions };
