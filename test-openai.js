import "dotenv/config";
import OpenAI from "openai";

async function testConnectivity() {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    try {
        console.log("📡 Testing OpenAI connectivity...");
        const models = await client.models.list();
        console.log("✅ Models found:", models.data.length);
        console.log("📄 Sample models:", models.data.slice(0, 5).map(m => m.id));

        console.log("💬 Testing simple chat completion...");
        const chat = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "Hello" }]
        });
        console.log("🤖 Chat Response:", chat.choices[0].message.content);
    } catch (err) {
        console.error("❌ CONNECTIVITY FAILED:", err);
    }
}

testConnectivity();
