import express from "express";
import { razorpayWebhook } from "../controllers/razorpay.webhook.controller.js";

const router = express.Router();

router.post("/razorpay", razorpayWebhook);

export default router;
