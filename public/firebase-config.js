// Firebase Configuration
// 3W1H Smart Converter - Firebase Project
// Using Firebase JS SDK v9 Compat mode for compatibility with existing code

const firebaseConfig = {
    apiKey: "AIzaSyA0JpyprYjlMKdmZpOnR0fGtBFp-rdn_J4",
    authDomain: "w1h-smart-converter.firebaseapp.com",
    projectId: "w1h-smart-converter",
    storageBucket: "w1h-smart-converter.firebasestorage.app",
    messagingSenderId: "387691419587",
    appId: "1:387691419587:web:c2094b03cb33e27e5e8f76",
    measurementId: "G-F5DJVPGGLS"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Auth state persistence
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Helper: Get current user
function getCurrentUser() {
    return auth.currentUser;
}

// Helper: Get ID token for API calls
async function getIdToken() {
    const user = getCurrentUser();
    if (!user) return null;
    return await user.getIdToken();
}

// Helper: Sign out
async function signOut() {
    try {
        await auth.signOut();
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Sign out error:', error);
        alert('Failed to sign out: ' + error.message);
    }
}

// Helper: Check if user is authenticated
function requireAuth() {
    return new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                window.location.href = '/login.html';
                reject(new Error('Not authenticated'));
            }
        });
    });
}

// Helper: Make authenticated API call
async function authenticatedFetch(url, options = {}) {
    const token = await getIdToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    return fetch(url, { ...options, headers });
}
