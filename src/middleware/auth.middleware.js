import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin SDK
let firebaseAdmin;

try {
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

    if (serviceAccountEnv) {
        // 1. Try loading from environment variable (standard for Render/Production)
        try {
            const serviceAccount = JSON.parse(serviceAccountEnv);
            firebaseAdmin = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✅ Firebase Admin SDK initialized via environment variable');
        } catch (parseError) {
            console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', parseError.message);
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
            console.warn('⚠️  Firebase Admin could not be initialized (No file or valid env var).');
            console.warn('   In Production: Set FIREBASE_SERVICE_ACCOUNT environment variable to the JSON contents.');
            console.warn('   In Development: Add firebase-service-account.json to your project root.');
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
