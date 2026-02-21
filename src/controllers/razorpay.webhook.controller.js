import crypto from "crypto";
import admin from "firebase-admin";

export const razorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret || secret === "dummy_secret") {
    console.warn("⚠️ RAZORPAY_WEBHOOK_SECRET is not set correctly. Webhook may fail signature check.");
    return res.status(500).send("Webhook secret not configured");
  }

  // Extract signature from Razorpay headers
  const signature = req.headers["x-razorpay-signature"];
  if (!signature) {
    console.error("❌ Missing x-razorpay-signature header");
    return res.status(400).send("Missing signature");
  }

  // Verify webhook signature
  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (signature !== expectedSignature) {
    console.error("❌ Invalid Razorpay webhook signature");
    return res.status(400).send("Invalid signature");
  }

  // Process the event
  const event = req.body.event;
  console.log(`📩 Razorpay Webhook Event: ${event}`);

  const db = admin.firestore();

  try {
    if (event === "subscription.activated") {
      const subEntity = req.body.payload.subscription.entity;
      const userId = subEntity.notes?.userId;
      console.log("✅ Subscription Activated:", subEntity.id, "User:", userId);

      if (userId) {
        // Map planId to Plan Name
        const PLANS = {
          "plan_SGJ9lQs5QEKndd": "Basic",
          "plan_SGJCJCot5JdhOo": "Pro",
          "plan_SGJDEt9DtLott3": "Premium"
        };
        const planName = PLANS[subEntity.plan_id] || "Unknown Plan";

        // Update Firestore with active subscription
        await db.collection("subscriptions").doc(userId).set({
          subscriptionId: subEntity.id,
          planId: subEntity.plan_id,
          planName: planName,
          status: "ACTIVE",
          activatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`📝 Firestore updated for user ${userId} with plan: ${planName}`);
      }
    }

    if (event === "subscription.charged") {
      const paymentEntity = req.body.payload.payment.entity;
      const subEntity = req.body.payload.subscription?.entity;
      const userId = subEntity?.notes?.userId;
      console.log("💳 Subscription Charged:", paymentEntity.id, "User:", userId);

      if (userId) {
        // Refill monthly credits
        const subDoc = await db.collection("subscriptions").doc(userId).get();
        if (subDoc.exists) {
          const data = subDoc.data();
          await db.collection("subscriptions").doc(userId).update({
            remainingCredits: data.totalCredits, // Reset to full credits
            lastChargedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    if (event === "subscription.cancelled") {
      const subEntity = req.body.payload.subscription.entity;
      const userId = subEntity.notes?.userId;
      console.log("❌ Subscription Cancelled:", subEntity.id, "User:", userId);

      if (userId) {
        // Downgrade to Free Trial
        await db.collection("subscriptions").doc(userId).update({
          planName: "Free Trial",
          status: "CANCELLED",
          totalCredits: 50,
          remainingCredits: 50,
          monthlyCredits: 50,
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.error("❌ Webhook processing error:", err);
    // Still return 200 so Razorpay doesn't retry endlessly
  }

  res.json({ status: "ok" });
};
