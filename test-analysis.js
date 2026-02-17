import "dotenv/config";
import { speechToText } from "./src/services/stt.service.js";
import { generateStructuredTable } from "./src/services/ai.service.js";
import path from "path";

async function test() {
    const filePath = "d:/Ai Tech Boss - Digital Flow Company/3W1H Smart Converter - Testing/3w1h-backend/uploads/0f23641273d8f455ad6a3efea75dc156.webm";
    try {
        console.log("🎤 Testing STT...");
        const transcript = await speechToText(filePath);
        console.log("📝 TRANSCRIPT:", transcript);

        if (!transcript || transcript.trim().length < 5) {
            console.log("⚠️ Transcript too short!");
            return;
        }

        console.log("🔍 Testing AI Analysis...");
        const aiResult = await generateStructuredTable(transcript, "3W1H");
        console.log("🤖 AI RESULT:", JSON.stringify(aiResult, null, 2));
    } catch (err) {
        console.error("❌ TEST FAILED:", err);
    }
}

test();
