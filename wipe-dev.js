import "dotenv/config";
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin (try to find service account)
let db;
try {
    const serviceAccount = JSON.parse(readFileSync('./firebase-service-account.json', 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log("✅ Firestore initialized");
} catch (e) {
    console.log("⚠️ Could not init Firestore (expected if file missing). Using mock wipe.");
}

async function wipeDevUser() {
    if (db) {
        console.log("🧹 Wiping dev-user from Firestore...");
        await db.collection("subscriptions").doc("dev-user").delete();
        console.log("✅ dev-user wiped from Firestore.");
    } else {
        console.log("❌ Cannot wipe Firestore (no service account).");
    }
}

wipeDevUser().catch(console.error);
