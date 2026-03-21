import admin from 'firebase-admin';
import fs from 'fs';

// Read JSON file manually
const serviceAccount = JSON.parse(
  fs.readFileSync(new URL('./firebase-key.json', import.meta.url))
);

let app;

if (!admin.apps.length) {
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'rental-7b689.firebasestorage.app',
  });
 
}

export const firebaseApp = app || null;
export const storageBucket = app ? admin.storage().bucket() : null;