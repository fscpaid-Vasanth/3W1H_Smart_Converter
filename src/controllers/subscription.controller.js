import Razorpay from "razorpay";
import admin from "firebase-admin";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Plan definitions — UPDATE THESE when switching to live mode
const PLANS = {
  "plan_SGJ9lQs5QEKndd": { name: "Basic", credits: 500 },
  "plan_SGJCJCot5JdhOo": { name: "Pro", credits: 1200 },
  "plan_SGJDEt9DtLott3": { name: "Premium", credits: -1 } // -1 = unlimited
};

// ===== DUAL STORAGE: Firestore (persistent) + In-memory (fallback) =====
const userSubscriptions = new Map(); // Fallback if Firestore unavailable

function getDb() {
  try {
    // Check if Firebase Admin is initialized
    if (admin.apps.length > 0) {
      return admin.firestore();
    }
  } catch (e) {
    console.warn("⚠️ Firestore not available, using in-memory store");
  }
  return null;
}

// Read subscription: try Firestore first, then in-memory
async function readSubscription(userId) {
  const db = getDb();
  if (db) {
    try {
      const doc = await db.collection("subscriptions").doc(userId).get();
      if (doc.exists) return doc.data();
    } catch (e) {
      console.error("⚠️ Firestore read failed:", e.message);
    }
  }
  // Fallback to in-memory
  return userSubscriptions.get(userId) || null;
}

// Write subscription: try Firestore first, always write to in-memory
async function writeSubscription(userId, data) {
  // Always save to in-memory (instant, reliable)
  userSubscriptions.set(userId, data);

  // Try to save to Firestore (persistent)
  const db = getDb();
  if (db) {
    try {
      await db.collection("subscriptions").doc(userId).set(data);
      console.log(`✅ Saved to Firestore for user ${userId}`);
    } catch (e) {
      console.error("⚠️ Firestore write failed, using in-memory only:", e.message);
    }
  }
}

// Update subscription fields
async function updateSubscription(userId, updates) {
  // Update in-memory
  const existing = userSubscriptions.get(userId) || {};
  const merged = { ...existing, ...updates };
  userSubscriptions.set(userId, merged);

  // Try Firestore
  const db = getDb();
  if (db) {
    try {
      await db.collection("subscriptions").doc(userId).update(updates);
    } catch (e) {
      console.error("⚠️ Firestore update failed:", e.message);
    }
  }
}

/**
 * POST /api/subscription/create
 */
export const createSubscription = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user.uid;

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 12,
      notes: {
        userId: userId,
        email: req.user.email
      }
    });

    return res.json({
      subscriptionId: subscription.id
    });
  } catch (err) {
    console.error("SUBSCRIPTION CREATE ERROR:", err);
    res.status(500).json({ error: "Subscription creation failed" });
  }
};

/**
 * POST /api/subscription/activate
 * Called by frontend after successful Razorpay payment
 */
export const activateSubscription = async (req, res) => {
  try {
    const { planId, paymentId } = req.body;
    const userId = req.user.uid;

    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ error: "Invalid plan ID" });
    }

    const now = new Date();
    const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const subscriptionData = {
      planName: plan.name,
      status: "ACTIVE",
      monthlyCredits: plan.credits === -1 ? "Unlimited" : plan.credits,
      remainingCredits: plan.credits === -1 ? "Unlimited" : plan.credits,
      totalCredits: plan.credits === -1 ? "Unlimited" : plan.credits,
      expiryDate: expiryDate.toISOString().split('T')[0],
      nextBillingDate: expiryDate.toISOString().split('T')[0],
      paymentId: paymentId,
      planId: planId,
      activatedAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    // Save to storage (Firestore + in-memory)
    await writeSubscription(userId, subscriptionData);
    console.log(`✅ Subscription activated for user ${userId}: ${plan.name}`);

    res.json(subscriptionData);
  } catch (err) {
    console.error("SUBSCRIPTION ACTIVATE ERROR:", err);
    res.status(500).json({ error: "Subscription activation failed" });
  }
};

/**
 * GET /api/subscription/status
 */
export const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log(`📡 Getting subscription for user: ${userId}`);

    // Read from storage
    const stored = await readSubscription(userId);

    if (stored && stored.planName) {
      console.log(`📊 Found subscription:`, stored.planName);

      const paidPlans = ["Basic", "Pro", "Premium"];

      // 🔒 PAYMENT VALIDATION: Paid plans MUST have a paymentId (from activateSubscription)
      // If a paid plan record exists without a paymentId, it was never legitimately purchased.
      // This catches stale test/demo data and resets it to Free Trial.
      if (paidPlans.includes(stored.planName) && !stored.paymentId) {
        console.log(`🚫 Paid plan "${stored.planName}" found without paymentId for user ${userId}. Resetting to Free Trial.`);
        const freeTrial = {
          planName: "Free Trial",
          status: "ACTIVE",
          monthlyCredits: 50,
          remainingCredits: 50,
          totalCredits: 50,
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          nextBillingDate: null,
          createdAt: new Date().toISOString()
        };
        await writeSubscription(userId, freeTrial);
        return res.json(freeTrial);
      }

      // Check if subscription has expired
      if (stored.expiryDate && new Date(stored.expiryDate) < new Date() && stored.planName !== "Free Trial") {
        console.log(`⏰ Subscription expired for ${userId}, reverting to Free Trial`);
        const freeTrial = {
          planName: "Free Trial",
          status: "EXPIRED",
          monthlyCredits: 50,
          remainingCredits: 50,
          totalCredits: 50,
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          nextBillingDate: null,
          updatedAt: new Date().toISOString()
        };
        await writeSubscription(userId, freeTrial);
        return res.json(freeTrial);
      }

      return res.json(stored);
    }

    // Default: Free Trial for new users or if data is incomplete
    console.log(`🆕 New or incomplete user data for ${userId}, assigning Free Trial`);
    const subscription = {
      planName: "Free Trial",
      status: "ACTIVE",
      monthlyCredits: 50,
      remainingCredits: 50,
      totalCredits: 50,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      nextBillingDate: null,
      createdAt: new Date().toISOString()
    };

    await writeSubscription(userId, subscription);
    console.log(`✅ Returning default Free Trial for user ${userId}:`, JSON.stringify(subscription));
    res.json(subscription);
  } catch (err) {
    console.error("SUBSCRIPTION STATUS ERROR:", err);
    res.status(500).json({ error: "Unable to fetch subscription status" });
  }
};

/**
 * PAUSE SUBSCRIPTION
 */
export const pauseSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    await razorpay.subscriptions.pause(subscriptionId, {
      pause_at: "now"
    });

    await updateSubscription(req.user.uid, {
      status: "PAUSED",
      updatedAt: new Date().toISOString()
    });

    res.json({ message: "Subscription paused successfully" });
  } catch (err) {
    console.error("PAUSE ERROR:", err);
    res.status(500).json({ error: "Failed to pause subscription" });
  }
};

/**
 * RESUME SUBSCRIPTION
 */
export const resumeSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    await razorpay.subscriptions.resume(subscriptionId);

    await updateSubscription(req.user.uid, {
      status: "ACTIVE",
      updatedAt: new Date().toISOString()
    });

    res.json({ message: "Subscription resumed successfully" });
  } catch (err) {
    console.error("RESUME ERROR:", err);
    res.status(500).json({ error: "Failed to resume subscription" });
  }
};

/**
 * CANCEL SUBSCRIPTION
 */
export const cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    await razorpay.subscriptions.cancel(subscriptionId, {
      cancel_at_cycle_end: true
    });

    await updateSubscription(req.user.uid, {
      planName: "Free Trial",
      status: "CANCELLED",
      monthlyCredits: 50,
      remainingCredits: 50,
      totalCredits: 50,
      cancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json({ message: "Subscription will cancel at end of billing cycle" });
  } catch (err) {
    console.error("CANCEL ERROR:", err);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
};
