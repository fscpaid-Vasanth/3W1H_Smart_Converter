import crypto from "crypto";

export const razorpayWebhook = (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret || secret === "dummy_secret") {
    console.warn("⚠️ RAZORPAY_WEBHOOK_SECRET is not set correctly. Webhook may fail signature check.");
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (signature !== expectedSignature) {
    console.error("Invalid Razorpay signature");
    return res.status(400).send("Invalid signature");
  }

  const event = req.body.event;
  console.log(`Received Razorpay Webhook Event: ${event}`);

  if (event === "subscription.activated") {
    console.log("✅ Subscription Activated:", req.body.payload.subscription.entity.id);
    // Add credits / activate plan logic here
  }

  if (event === "subscription.charged") {
    console.log("💳 Subscription Charged:", req.body.payload.payment.entity.id);
    // Monthly credit refill logic here
  }

  if (event === "subscription.cancelled") {
    console.log("❌ Subscription Cancelled:", req.body.payload.subscription.entity.id);
    // Downgrade user logic here
  }

  res.json({ status: "ok" });
};
