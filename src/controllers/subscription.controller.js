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

// ===== FIRESTORE STORAGE =====
// All subscriptions are stored in Firestore per user (no shared in-memory fallback)

function getDb() {
  try {
    if (admin.apps.length > 0) {
      return admin.firestore();
    }
  } catch (e) {
    console.error("❌ Firestore unavailable:", e.message);
  }
  return null;
}

/**
 * Safety guard: ensure we never operate on a shared/invalid userId.
 * If userId is missing or looks like a dev fallback, throw an error so the
 * caller returns a 401 instead of silently reading/writing shared data.
 */
function assertUserId(userId) {
  if (!userId || userId === 'dev-user' || userId === 'undefined') {
    throw new Error(`Invalid userId: "${userId}". Firebase Auth must be properly initialized.`);
  }
}

// Read subscription from Firestore (per user)
async function readSubscription(userId) {
  assertUserId(userId);
  const db = getDb();
  if (!db) {
    console.error("❌ Firestore not available. Cannot read subscription.");
    return null;
  }
  try {
    const doc = await db.collection("subscriptions").doc(userId).get();
    if (doc.exists) return doc.data();
    return null;
  } catch (e) {
    console.error(`⚠️ Firestore read failed for user ${userId}:`, e.message);
    return null;
  }
}

// Write subscription to Firestore (per user)
async function writeSubscription(userId, data) {
  assertUserId(userId);
  const db = getDb();
  if (!db) {
    console.error("❌ Firestore not available. Cannot write subscription.");
    return;
  }
  try {
    await db.collection("subscriptions").doc(userId).set(data);
    console.log(`✅ Saved subscription to Firestore for user ${userId}: ${data.planName}`);
  } catch (e) {
    console.error(`⚠️ Firestore write failed for user ${userId}:`, e.message);
  }
}

// Update subscription fields in Firestore (per user)
async function updateSubscription(userId, updates) {
  assertUserId(userId);
  const db = getDb();
  if (!db) {
    console.error("❌ Firestore not available. Cannot update subscription.");
    return;
  }
  try {
    await db.collection("subscriptions").doc(userId).set(updates, { merge: true });
    console.log(`✅ Updated subscription in Firestore for user ${userId}`);
  } catch (e) {
    console.error(`⚠️ Firestore update failed for user ${userId}:`, e.message);
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

      // Patch missing expiryDate (old records before fix)
      if (!stored.expiryDate) {
        stored.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await updateSubscription(userId, { expiryDate: stored.expiryDate });
        console.log(`🔧 Patched missing expiryDate for user ${userId}`);
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
 * POST /api/subscription/deduct-credits
 * Called by frontend AFTER successful analysis to persist credit deduction to Firestore.
 */
export const deductCredits = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.uid;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const stored = await readSubscription(userId);
    if (!stored) {
      return res.status(404).json({ error: "No subscription found" });
    }

    // Unlimited plans — no deduction needed
    if (stored.remainingCredits === "Unlimited" || stored.planName === "Premium") {
      return res.json({ remainingCredits: "Unlimited", planName: stored.planName });
    }

    const current = typeof stored.remainingCredits === "number"
      ? stored.remainingCredits
      : parseInt(stored.remainingCredits) || 0;

    if (current < amount) {
      return res.status(402).json({ error: "Insufficient credits", remainingCredits: current });
    }

    const newCredits = current - amount;
    await updateSubscription(userId, {
      remainingCredits: newCredits,
      updatedAt: new Date().toISOString()
    });

    console.log(`💳 Deducted ${amount} credits for user ${userId}. Remaining: ${newCredits}`);
    res.json({ remainingCredits: newCredits, planName: stored.planName });
  } catch (err) {
    console.error("DEDUCT CREDITS ERROR:", err);
    res.status(500).json({ error: "Failed to deduct credits" });
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
