import express from "express";
import {
  analyzeAudio,
  analyzeText
} from "../controllers/analyze.controller.js";

console.log("🔥 ANALYZE ROUTES FILE LOADED");

const router = express.Router();

/**
 * Audio analysis
 * POST /api/analyze
 */
router.post("/", analyzeAudio);

/**
 * Text analysis
 * POST /api/analyze/text
 */
router.post("/text", analyzeText);

export default router;
