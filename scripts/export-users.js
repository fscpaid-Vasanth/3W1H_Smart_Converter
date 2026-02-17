/**
 * Firebase User Export Script
 * 
 * Usage: node scripts/export-users.js
 * Output: users-export-[timestamp].json
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '../firebase-service-account.json';
const serviceAccount = require(path.resolve(__dirname, serviceAccountPath));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const auth = admin.auth();

async function exportAllUsers(nextPageToken) {
    // List batch of users, 1000 at a time.
    const result = await auth.listUsers(1000, nextPageToken);
    const users = result.users.map(userRecord => userRecord.toJSON());

    if (result.pageToken) {
        // List next batch.
        const nextBatch = await exportAllUsers(result.pageToken);
        return users.concat(nextBatch);
    } else {
        return users;
    }
}

async function main() {
    console.log('🚀 Starting user export...');
    try {
        const allUsers = await exportAllUsers();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `users-export-${timestamp}.json`;
        const filepath = path.join(__dirname, '../backups', filename);

        // Ensure backup directory exists
        const backupDir = path.dirname(filepath);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        fs.writeFileSync(filepath, JSON.stringify(allUsers, null, 2));
        console.log(`✅ Successfully exported ${allUsers.length} users.`);
        console.log(`📁 File saved to: ${filepath}`);

    } catch (error) {
        console.error('❌ Error exporting users:', error);
    } finally {
        process.exit();
    }
}

main();
