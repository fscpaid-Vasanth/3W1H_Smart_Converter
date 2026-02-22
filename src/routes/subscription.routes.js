import express from "express";
import {
  createSubscription,
  getSubscriptionStatus,
  activateSubscription,
  deductCredits
} from "../controllers/subscription.controller.js";


const router = express.Router();

router.post("/create", createSubscription);
router.post("/activate", activateSubscription);
router.post("/deduct-credits", deductCredits);

router.get("/status", getSubscriptionStatus);

export default router;

