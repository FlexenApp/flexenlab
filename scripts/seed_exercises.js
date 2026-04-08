// scripts/seed_exercises.js
// Imports ExerciseDB Kaggle dataset (1,500 exercises + GIFs) into Firestore + Firebase Storage.
//
// SETUP:
//   1. Ensure ~/.flexen/serviceAccountKey.json exists (or set GOOGLE_APPLICATION_CREDENTIALS)
//   2. Place extracted ExerciseDB data in scripts/exercisedb-data/
//      - exercises.json, bodyParts.json, equipments.json, muscles.json
//      - gifs_360x360/ folder with GIF files
//   3. cd scripts && npm install
//   4. node seed_exercises.js
//
// OPTIONS:
//   --skip-gifs     Skip GIF upload (Firestore-only seeding)
//   --start=N       Resume GIF upload from exercise index N

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Config ────────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, 'exercisedb-data');
const GIF_DIR = path.join(DATA_DIR, 'gifs_720x720');
const BATCH_SIZE = 400; // Firestore batch limit is 500
const BUCKET_NAME = 'flexenapp-74265.firebasestorage.app';
const CONCURRENT_UPLOADS = 10;

const args = process.argv.slice(2);
const skipGifs = args.includes('--skip-gifs');
const startArg = args.find(a => a.startsWith('--start='));
const startIndex = startArg ? parseInt(startArg.split('=')[1], 10) : 0;

// ── Init ──────────────────────────────────────────────────────────────────────

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: BUCKET_NAME,
  });
} else {
  const keyPath = path.join(os.homedir(), '.flexen', 'serviceAccountKey.json');
  const serviceAccount = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: BUCKET_NAME,
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function deleteCollection(collRef) {
  const snapshot = await collRef.get();
  if (snapshot.empty) return 0;
  let deleted = 0;
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += Math.min(BATCH_SIZE, docs.length - i);
  }
  return deleted;
}

async function uploadGif(exerciseId, gifFilename) {
  const localPath = path.join(GIF_DIR, gifFilename);
  if (!fs.existsSync(localPath)) return '';

  const destination = `exercises/gifs/${exerciseId}.gif`;
  const file = bucket.file(destination);

  // Check if already uploaded (for resume support)
  const [exists] = await file.exists();
  if (exists) {
    return `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
  }

  await bucket.upload(localPath, {
    destination,
    metadata: {
      contentType: 'image/gif',
      cacheControl: 'public, max-age=31536000',
    },
  });

  await file.makePublic();
  return `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
}

async function uploadBatch(items) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENT_UPLOADS) {
    const chunk = items.slice(i, i + CONCURRENT_UPLOADS);
    const chunkResults = await Promise.all(
      chunk.map(({ exerciseId, gifFilename }) =>
        uploadGif(exerciseId, gifFilename).catch(err => {
          console.error(`  ✗ Failed to upload GIF for ${exerciseId}: ${err.message}`);
          return '';
        })
      )
    );
    results.push(...chunkResults);
  }
  return results;
}

function transformExercise(raw, gifUrl) {
  return {
    name: raw.name || '',
    bodyPart: (raw.bodyParts || [])[0] || '',
    target: (raw.targetMuscles || [])[0] || '',
    equipment: (raw.equipments || [])[0] || '',
    gifUrl: gifUrl || '',
    secondaryMuscles: raw.secondaryMuscles || [],
    instructions: raw.instructions || [],
    overview: raw.overview || '',
    difficulty: raw.difficulty || '',
    exerciseTypes: raw.exerciseTypes || [],
    nameLower: (raw.name || '').toLowerCase(),
  };
}

// ── Step 1: Upload GIFs to Firebase Storage ──────────────────────────────────

async function uploadAllGifs(exercises) {
  if (skipGifs) {
    console.log('Skipping GIF upload (--skip-gifs flag).');
    return new Map();
  }

  if (!fs.existsSync(GIF_DIR)) {
    console.log(`GIF directory not found: ${GIF_DIR}`);
    console.log('Run with --skip-gifs to seed Firestore without GIFs.');
    return new Map();
  }

  console.log(`Uploading GIFs to Firebase Storage (starting from index ${startIndex})...`);
  const gifUrlMap = new Map();
  const toUpload = exercises.slice(startIndex);

  for (let i = 0; i < toUpload.length; i += CONCURRENT_UPLOADS) {
    const batch = toUpload.slice(i, i + CONCURRENT_UPLOADS);
    const items = batch.map(ex => ({
      exerciseId: ex.exerciseId,
      gifFilename: (ex.gifUrls && ex.gifUrls['720p']) || '',
    })).filter(item => item.gifFilename);

    const urls = await uploadBatch(items);
    items.forEach((item, idx) => {
      if (urls[idx]) gifUrlMap.set(item.exerciseId, urls[idx]);
    });

    const globalIdx = startIndex + i + batch.length;
    const pct = ((globalIdx / exercises.length) * 100).toFixed(1);
    process.stdout.write(`\r  ${globalIdx}/${exercises.length} (${pct}%)`);
  }

  console.log(`\n  ✓ ${gifUrlMap.size} GIFs uploaded.`);
  return gifUrlMap;
}

// ── Step 2: Clear & seed exercises collection ────────────────────────────────

async function seedExercises(exercises, gifUrlMap) {
  console.log('Clearing existing exercises collection...');
  const deleted = await deleteCollection(db.collection('exercises'));
  console.log(`  Cleared ${deleted} documents.`);

  console.log(`Seeding ${exercises.length} exercises...`);

  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = exercises.slice(i, i + BATCH_SIZE);

    for (const ex of chunk) {
      const gifUrl = gifUrlMap.get(ex.exerciseId) || '';
      const doc = transformExercise(ex, gifUrl);
      batch.set(db.collection('exercises').doc(ex.exerciseId), doc);
    }

    await batch.commit();
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} docs`);
  }

  console.log(`  ✓ ${exercises.length} exercises written.`);
}

// ── Step 3: Seed filter metadata ─────────────────────────────────────────────

async function seedMetadata() {
  console.log('Seeding filter metadata...');

  const bodyParts = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bodyParts.json'), 'utf8'));
  const equipments = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'equipments.json'), 'utf8'));
  const muscles = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'muscles.json'), 'utf8'));

  const metaRef = db.collection('exercises_meta');
  const batch = db.batch();

  batch.set(metaRef.doc('bodyParts'), {
    values: bodyParts.map(b => b.name).sort(),
  });
  batch.set(metaRef.doc('equipment'), {
    values: equipments.map(e => e.name).sort(),
  });
  batch.set(metaRef.doc('targets'), {
    values: muscles.map(m => m.name).sort(),
  });

  await batch.commit();
  console.log('  ✓ Metadata written (bodyParts, equipment, targets).');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  try {
    const exercises = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'exercises.json'), 'utf8')
    );
    console.log(`Loaded ${exercises.length} exercises from dataset.`);

    const gifUrlMap = await uploadAllGifs(exercises);
    await seedExercises(exercises, gifUrlMap);
    await seedMetadata();

    console.log('\nDone! ✓');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

main();
