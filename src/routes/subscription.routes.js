import express from "express";
import {
  createSubscription,
  getSubscriptionStatus,
  activateSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription
} from "../controllers/subscription.controller.js";


const router = express.Router();

router.post("/create", createSubscription);
router.post("/activate", activateSubscription);

router.get("/status", getSubscriptionStatus);

router.post("/pause", pauseSubscription);
router.post("/resume", resumeSubscription);
router.post("/cancel", cancelSubscription);

export default router;

