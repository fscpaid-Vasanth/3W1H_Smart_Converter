import fs from "fs";
import { speechToText } from "../services/stt.service.js";
import { generateStructuredTable } from "../services/ai.service.js";

console.log("🔥 ANALYZE CONTROLLER LOADED");

/**
 * ======================================
 * AUDIO / LIVE AUDIO → TEXT → ANALYSIS
 * Route: POST /api/analyze
 * ======================================
 */
export const analyzeAudio = async (req, res) => {
  console.log("📥 RECEIVED ANALYZE REQUEST:", req.body);
  try {
    const { filePath, framework } = req.body;

    if (!filePath || !framework) {
      return res.status(400).json({
        framework,
        confidenceScore: 0,
        rows: [],
        message: "filePath and framework are required"
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        framework,
        confidenceScore: 0,
        rows: [],
        message: "Audio file not found"
      });
    }

    /* ===============================
       1️⃣ SPEECH → TEXT
    =============================== */
    const transcript = await speechToText(filePath);

    console.log("🎙️ TRANSCRIPT:", transcript);

    if (!transcript || transcript.trim().length < 5 || transcript.toLowerCase().includes("you you")) {
      console.warn("⚠️ suspicious transcript detected:", transcript);
      return res.json({
        framework,
        confidenceScore: 5,
        rows: [],
        message: "Audio captured but transcript was too short or unclear. Please speak more clearly or check your mic."
      });
    }

    /* ===============================
       2️⃣ TEXT → STRUCTURED 3W1H
    =============================== */
    let aiResult;
    try {
      aiResult = await generateStructuredTable(transcript, framework);
    } catch (aiErr) {
      console.error("❌ AI STRUCTURE ERROR:", aiErr);
      return res.json({
        framework,
        confidenceScore: 20,
        rows: [],
        message: "AI failed to structure transcript"
      });
    }

    /* ===============================
       3️⃣ NORMALIZE OUTPUT (CRITICAL)
    =============================== */
    let rows = [];
    let detectedLanguage = "en";
    let wasTranslated = false;
    let translatedText = null;

    // Handle new response format with metadata
    if (aiResult && typeof aiResult === 'object') {
      if (Array.isArray(aiResult.rows)) {
        rows = aiResult.rows;
        detectedLanguage = aiResult.detectedLanguage || "en";
        wasTranslated = aiResult.wasTranslated || false;
        translatedText = aiResult.translatedText || null;
      } else if (Array.isArray(aiResult)) {
        // Backward compatibility: if AI returns array directly
        rows = aiResult;
      }
    }

    // HARD SAFETY — NEVER RETURN UNDEFINED
    if (!Array.isArray(rows)) rows = [];

    if (!rows.length) {
      console.warn("⚠️ NO ROWS EXTRACTED. Transcript was:", transcript);
      console.log("🤖 AI Result was:", aiResult);
    }

    return res.json({
      framework,
      confidenceScore: rows.length ? 95 : 40,
      rows,
      transcript,
      detectedLanguage,
      wasTranslated,
      translatedText
    });

  } catch (err) {
    console.error("❌ ANALYZE AUDIO FATAL ERROR:", err);
    return res.status(500).json({
      framework: req.body?.framework || "3W1H",
      confidenceScore: 0,
      rows: [],
      message: "Unexpected server error during audio analysis"
    });
  }
};


/**
 * ======================================
 * TEXT → ANALYSIS
 * Route: POST /api/analyze/text
 * ======================================
 */
export const analyzeText = async (req, res) => {
  try {
    const { text, framework } = req.body;

    if (!text || !framework) {
      return res.status(400).json({
        framework,
        confidenceScore: 0,
        rows: [],
        message: "text and framework are required"
      });
    }

    let aiResult;
    try {
      aiResult = await generateStructuredTable(text, framework);
    } catch (aiErr) {
      console.error("❌ AI TEXT STRUCTURE ERROR:", aiErr);
      return res.json({
        framework,
        confidenceScore: 20,
        rows: [],
        message: "AI failed to structure text"
      });
    }

    let rows = [];
    let detectedLanguage = "en";
    let wasTranslated = false;
    let translatedText = null;

    // Handle new response format with metadata
    if (aiResult && typeof aiResult === 'object') {
      if (Array.isArray(aiResult.rows)) {
        rows = aiResult.rows;
        detectedLanguage = aiResult.detectedLanguage || "en";
        wasTranslated = aiResult.wasTranslated || false;
        translatedText = aiResult.translatedText || null;
      } else if (Array.isArray(aiResult)) {
        rows = aiResult;
      }
    }

    if (!Array.isArray(rows)) rows = [];

    return res.json({
      framework,
      confidenceScore: rows.length ? 95 : 40,
      rows,
      detectedLanguage,
      wasTranslated,
      translatedText
    });

  } catch (err) {
    console.error("❌ ANALYZE TEXT FATAL ERROR:", err);
    return res.status(500).json({
      framework: req.body?.framework || "3W1H",
      confidenceScore: 0,
      rows: [],
      message: "Unexpected server error during text analysis"
    });
  }
};
