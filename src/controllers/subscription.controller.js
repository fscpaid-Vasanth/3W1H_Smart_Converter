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

// Helper: get Firestore instance
function getDb() {
  return admin.firestore();
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

    // Save to Firestore (persistent!)
    const db = getDb();
    await db.collection("subscriptions").doc(userId).set(subscriptionData);
    console.log(`✅ Subscription saved to Firestore for user ${userId}: ${plan.name}`);

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

    // Check Firestore first
    const db = getDb();
    const doc = await db.collection("subscriptions").doc(userId).get();

    if (doc.exists) {
      const data = doc.data();
      // Check if subscription has expired
      if (data.expiryDate && new Date(data.expiryDate) < new Date() && data.planName !== "Free Trial") {
        // Expired — downgrade to Free Trial
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
        await db.collection("subscriptions").doc(userId).set(freeTrial);
        return res.json(freeTrial);
      }
      return res.json(data);
    }

    // Default: Free Trial for new users
    const subscription = {
      planName: "Free Trial",
      status: "ACTIVE",
      monthlyCredits: 50,
      remainingCredits: 50,
      totalCredits: 50,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      nextBillingDate: null
    };

    // Save default Free Trial to Firestore
    await db.collection("subscriptions").doc(userId).set({
      ...subscription,
      createdAt: new Date().toISOString()
    });

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

    // Update Firestore
    const db = getDb();
    await db.collection("subscriptions").doc(req.user.uid).update({
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

    // Update Firestore
    const db = getDb();
    await db.collection("subscriptions").doc(req.user.uid).update({
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

    // Downgrade to Free Trial in Firestore
    const db = getDb();
    await db.collection("subscriptions").doc(req.user.uid).update({
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
