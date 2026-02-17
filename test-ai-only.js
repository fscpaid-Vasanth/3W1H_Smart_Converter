import "dotenv/config";
import { generateStructuredTable } from "./src/services/ai.service.js";

async function testAI() {
    const sampleText = `The production line stopped from running state to complete shutdown on January 15th, 2024 at 2:30 PM. The issue was caused by a bearing failure in Motor Unit 3. The maintenance team identified the problem and replaced the bearing within 4 hours.`;

    try {
        console.log("🤖 Testing AI Service with sample text...");
        console.log("📝 INPUT:", sampleText);
        console.log("");

        const result = await generateStructuredTable(sampleText, "3W1H");

        console.log("✅ AI SERVICE SUCCESS!");
        console.log("📊 RESULT:", JSON.stringify(result, null, 2));
        console.log("");
        console.log("🔍 Validation:");
        console.log("- Is Array:", Array.isArray(result));
        console.log("- Number of rows:", result.length);

        if (result.length > 0) {
            console.log("- First row has 'what':", !!result[0].what);
            console.log("- First row has 'from':", !!result[0].from);
            console.log("- First row has 'to':", !!result[0].to);
            console.log("- First row has 'when':", !!result[0].when);
            console.log("- First row has 'who':", !!result[0].who);
            console.log("- First row has 'how':", !!result[0].how);
        }

    } catch (err) {
        console.error("❌ AI SERVICE FAILED:");
        console.error("Error message:", err.message);
        console.error("Full error:", err);
    }
}

testAI();
