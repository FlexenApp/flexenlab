'use strict';
const fs = require('fs');
const path = require('path');
const { init, BUCKET_NAME } = require('./lib/admin');

const ANIM = path.join(__dirname, 'webp', 'anim');
const THUMB = path.join(__dirname, 'webp', 'thumb');
const MANIFEST = path.join(__dirname, 'media-manifest.json');
const CONCURRENT = 10;

const { bucket } = init();

async function up(localPath, dest) {
  const file = bucket.file(dest);
  const [exists] = await file.exists();
  if (!exists) {
    await bucket.upload(localPath, { destination: dest, metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' } });
    await file.makePublic();
  }
  return `https://storage.googleapis.com/${BUCKET_NAME}/${dest}`;
}

async function main() {
  const ids = fs.readdirSync(ANIM).map(f => f.replace(/\.webp$/, ''));
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  let done = 0;
  for (let i = 0; i < ids.length; i += CONCURRENT) {
    const chunk = ids.slice(i, i + CONCURRENT);
    await Promise.all(chunk.map(async id => {
      const [gifUrl, thumbUrl] = await Promise.all([
        up(path.join(ANIM, `${id}.webp`), `exercises/anim/${id}.webp`),
        up(path.join(THUMB, `${id}.webp`), `exercises/thumb/${id}.webp`),
      ]);
      manifest[id] = { gifUrl, thumbUrl };
    }));
    done += chunk.length;
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 0));
    process.stdout.write(`\r  uploaded ${done}/${ids.length}`);
  }
  console.log(`\n✓ manifest entries: ${Object.keys(manifest).length}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
