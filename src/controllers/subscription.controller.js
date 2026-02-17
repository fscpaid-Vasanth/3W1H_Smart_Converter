import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

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

    // TODO: Save subscription to database with userId
    // await saveSubscriptionToDatabase(userId, subscription.id, planId);

    return res.json({
      subscriptionId: subscription.id
    });
  } catch (err) {
    console.error("SUBSCRIPTION CREATE ERROR:", err);
    res.status(500).json({ error: "Subscription creation failed" });
  }
};

export const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.uid; // Get from authenticated user

    // TODO: Fetch from database
    // const subscription = await getSubscriptionFromDatabase(userId);

    // 🔹 Example data (replace with DB later)
    const subscription = {
      planName: "Pro",
      status: "ACTIVE",
      monthlyCredits: 1200,
      remainingCredits: 1200,
      expiryDate: "2026-03-15",
      nextBillingDate: "2026-03-15"
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

    res.json({ message: "Subscription will cancel at end of billing cycle" });
  } catch (err) {
    console.error("CANCEL ERROR:", err);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
};


