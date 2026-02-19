import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ===== IN-MEMORY SUBSCRIPTION STORE =====
// Maps userId -> subscription data
// NOTE: This resets on server restart. Replace with database later.
const userSubscriptions = new Map();

// Plan definitions
const PLANS = {
  "plan_SGJ9lQs5QEKndd": { name: "Basic", credits: 500 },
  "plan_SGJCJCot5JdhOo": { name: "Pro", credits: 1200 },
  "plan_SGJDEt9DtLott3": { name: "Premium", credits: -1 } // -1 = unlimited
};

/**
 * POST /api/subscription/create
 */
export const createSubscription = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user.uid; // Get from authenticated user

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 12, // 12 months
      notes: {
        userId: userId, // Store Firebase UID in subscription notes
        email: req.user.email
      }
    });

    // Store pending subscription so we can activate it after payment
    userSubscriptions.set(userId + "_pending", {
      subscriptionId: subscription.id,
      planId: planId
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
      activatedAt: now.toISOString()
    };

    // Save to in-memory store
    userSubscriptions.set(userId, subscriptionData);
    console.log(`✅ Subscription activated for user ${userId}: ${plan.name}`);

    res.json(subscriptionData);
  } catch (err) {
    console.error("SUBSCRIPTION ACTIVATE ERROR:", err);
    res.status(500).json({ error: "Subscription activation failed" });
  }
};

export const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.uid;

    // Check in-memory store first
    const stored = userSubscriptions.get(userId);
    if (stored) {
      return res.json(stored);
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

    // Remove from in-memory store
    const userId = req.user.uid;
    userSubscriptions.delete(userId);

    res.json({ message: "Subscription will cancel at end of billing cycle" });
  } catch (err) {
    console.error("CANCEL ERROR:", err);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
};
