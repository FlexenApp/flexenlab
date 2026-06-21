'use strict';
const admin = require('firebase-admin');
const path = require('path');
const os = require('os');

const BUCKET_NAME = 'flexenapp-74265.firebasestorage.app';

function init() {
  if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ credential: admin.credential.applicationDefault(), storageBucket: BUCKET_NAME });
    } else {
      const keyPath = path.join(os.homedir(), '.flexen', 'serviceAccountKey.json');
      admin.initializeApp({ credential: admin.credential.cert(require(keyPath)), storageBucket: BUCKET_NAME });
    }
  }
  return { admin, db: admin.firestore(), bucket: admin.storage().bucket(), BUCKET_NAME };
}
module.exports = { init, BUCKET_NAME };
