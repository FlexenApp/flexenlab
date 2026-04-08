// scripts/seed.js
// Seeds Firestore with example training plans for userId 'flexen'.
//
// SETUP:
//   1. Download your Firebase service account key from:
//      Firebase Console → Project Settings → Service accounts → Generate new private key
//   2. Save it OUTSIDE any repo at ~/.flexen/serviceAccountKey.json  (never commit!)
//      Or set GOOGLE_APPLICATION_CREDENTIALS to point at it.
//   3. cd scripts && npm install
//   4. node seed.js

const admin = require('firebase-admin');
const path = require('path');
const os = require('os');
const { plans } = require('./seed_data');

const USER_ID = 'flexen';

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
} else {
  const keyPath = path.join(os.homedir(), '.flexen', 'serviceAccountKey.json');
  const serviceAccount = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function deleteCollection(collRef) {
  const snapshot = await collRef.get();
  if (snapshot.empty) return;
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

// ── Step 1: Clear existing data for this user ─────────────────────────────────

async function clearExistingData() {
  console.log(`Clearing existing training plans for userId='${USER_ID}'...`);

  const snapshot = await db
    .collection('trainingPlans')
    .where('userId', '==', USER_ID)
    .get();

  if (snapshot.empty) {
    console.log('  Nothing to clear.');
    return;
  }

  for (const planDoc of snapshot.docs) {
    await deleteCollection(planDoc.ref.collection('exercises'));
    await planDoc.ref.delete();
  }

  console.log(`  Cleared ${snapshot.size} plan(s).`);
}

// ── Step 2: Insert training plan seed data ─────────────────────────────────

async function seedData() {
  console.log('Seeding training plans...');

  for (const plan of plans) {
    const { exercises, ...planData } = plan;

    // Create plan document with auto-generated ID
    const planRef = db.collection('trainingPlans').doc();

    await planRef.set({
      ...planData,
      userId: USER_ID,
    });

    // Create exercises subcollection in a single batch
    const batch = db.batch();
    exercises.forEach((exercise, index) => {
      const exRef = planRef.collection('exercises').doc();
      batch.set(exRef, { ...exercise, order: index });
    });
    await batch.commit();

    console.log(
      `  ✓ "${planData.name}" — ${exercises.length} exercises  (id: ${planRef.id})`
    );
  }

  console.log('Done!');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  try {
    await clearExistingData();
    await seedData();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

main();
