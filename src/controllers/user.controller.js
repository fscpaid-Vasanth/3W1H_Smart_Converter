import admin from 'firebase-admin';

/**
 * Controller for user-related operations
 */

export const exportUserData = async (req, res) => {
    try {
        const userId = req.user.uid;
        const userEmail = req.user.email;

        // 1. Get User Profile from Firebase
        const userRecord = await admin.auth().getUser(userId);

        // 2. Get Subscription Data (Mocked for now, or fetch from Razorpay if linked)
        // In a real app, you would query your database here.
        const subscriptionData = {
            status: 'active', // Placeholder
            plan: 'free',     // Placeholder
            history: []       // Placeholder
        };

        // 3. Construct Export Package
        const exportData = {
            profile: {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                photoURL: userRecord.photoURL,
                metadata: userRecord.metadata,
                providerData: userRecord.providerData
            },
            subscription: subscriptionData,
            generatedAt: new Date().toISOString()
        };

        // 4. Send as JSON
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}.json"`);
        res.status(200).json(exportData);

    } catch (error) {
        console.error('Error exporting user data:', error);
        res.status(500).json({ error: 'Failed to export user data' });
    }
};
