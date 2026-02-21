import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin SDK
let firebaseAdmin;

try {
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

    if (admin.apps.length > 0) {
        firebaseAdmin = admin.app();
        console.log('✅ Firebase Admin SDK already initialized from previous request/task');
    } else if (serviceAccountEnv) {
        console.log('📡 Detected FIREBASE_SERVICE_ACCOUNT environment variable. Attempting to parse...');
        try {
            // Decode if it's base64, otherwise use raw string
            const rawJson = serviceAccountEnv.trim().startsWith('{')
                ? serviceAccountEnv
                : Buffer.from(serviceAccountEnv, 'base64').toString();

            const serviceAccount = JSON.parse(rawJson);
            firebaseAdmin = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✅ Firebase Admin SDK initialized via environment variable');
        } catch (parseError) {
            console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable. Error:', parseError.message);
            console.error('   TIP: If pasting JSON directly fails, try Base64 encoding it and pasting the string instead.');
        }
    }

    if (!firebaseAdmin) {
        // 2. Fallback to local file
        try {
            const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
            firebaseAdmin = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✅ Firebase Admin SDK initialized via service account file');
        } catch (fileError) {
            console.warn('⚠️  Authentication Warning: No FIREBASE_SERVICE_ACCOUNT variable found and no local file.');
            console.warn('   The system is running in "restricted" mode. Deductions will fail for security.');
        }
    }
} catch (error) {
    console.error('❌ Firebase Admin initialization error:', error.message);
}

/**
 * Authentication middleware
 * Verifies Firebase ID token from Authorization header
 */
export async function authenticateUser(req, res, next) {
    try {
        // Skip auth if Firebase is not initialized (development mode)
        if (!firebaseAdmin) {
            console.warn('⚠️  Firebase not initialized - skipping authentication');
            req.user = { uid: 'dev-user', email: 'dev@example.com' };
            return next();
        }

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'No authentication token provided'
            });
        }

        const token = authHeader.split('Bearer ')[1];

        // Verify the ID token
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Attach user info to request
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name,
            emailVerified: decodedToken.email_verified
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);

        let message = 'Authentication failed';

        if (error.code === 'auth/id-token-expired') {
            message = 'Token expired. Please login again.';
        } else if (error.code === 'auth/argument-error') {
            message = 'Invalid token format';
        }

        return res.status(401).json({
            error: 'Unauthorized',
            message
        });
    }
}

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't require it
 */
export async function optionalAuth(req, res, next) {
    try {
        if (!firebaseAdmin) {
            return next();
        }

        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(token);

            req.user = {
                uid: decodedToken.uid,
                email: decodedToken.email,
                name: decodedToken.name,
                emailVerified: decodedToken.email_verified
            };
        }

        next();
    } catch (error) {
        // Don't fail on optional auth errors
        console.warn('Optional auth failed:', error.message);
        next();
    }
}

export default { authenticateUser, optionalAuth };
