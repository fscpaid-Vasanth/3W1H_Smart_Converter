import "dotenv/config";   // 🔥 MUST BE FIRST
import app from "./app.js";
import Razorpay from "razorpay";

const PORT = process.env.PORT || 5000;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

console.log("ENV CHECK → OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);

app.listen(PORT, () => {
  console.log(`✅ 3W1H Smart Converter backend running on port ${PORT}`);
});

export async function createSubscription(req, res){
  const { planId } = req.body;

  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    customer_notify: 1,
    total_count: 12 // 12 months (or omit for infinite)
  });

  res.json(subscription);
}
