// Quick test: verify professional fields are different from raw fields
import { generateStructuredTable } from './src/services/ai.service.js';
import dotenv from 'dotenv';
dotenv.config();

const testText = "Drastical drop in parts conception from 50000 to 25000 in last 3 months. Manoj from Noida Automobiles identified root cause as lack of parts executive and planned to increase from 2 to 3.";

console.log("🧪 Testing professional field expansion...\n");
console.log("INPUT:", testText, "\n");

try {
    const result = await generateStructuredTable(testText);

    if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        console.log("═══════════════════════════════════════");
        console.log("FIRST INVESTIGATION REPORT (raw):");
        console.log("═══════════════════════════════════════");
        console.log("What:", row.what);
        console.log("How:", row.how);
        console.log("From:", row.from);
        console.log("To:", row.to);
        console.log("");
        console.log("═══════════════════════════════════════");
        console.log("PROFESSIONAL INVESTIGATION ANALYSIS:");
        console.log("═══════════════════════════════════════");
        console.log("Problem (What):", row.problem);
        console.log("Problem length:", row.problem ? row.problem.length : 0, "chars");
        console.log("");
        console.log("ActionPlan (How):", row.actionPlan);
        console.log("ActionPlan length:", row.actionPlan ? row.actionPlan.length : 0, "chars");
        console.log("");
        console.log("FromNumeric:", row.fromNumeric);
        console.log("ToNumeric:", row.toNumeric);
        console.log("");
        console.log("Summary length:", row.summary ? row.summary.length : 0, "chars");
        console.log("");
        console.log("═══════════════════════════════════════");
        console.log("COMPARISON:");
        console.log("═══════════════════════════════════════");
        console.log("What === Problem?", row.what === row.problem);
        console.log("How === ActionPlan?", row.how === row.actionPlan);
        console.log("Problem is different?", row.what !== row.problem ? "✅ YES" : "❌ NO");
        console.log("ActionPlan is different?", row.how !== row.actionPlan ? "✅ YES" : "❌ NO");
    } else {
        console.log("❌ No rows returned:", JSON.stringify(result).substring(0, 500));
    }
} catch (err) {
    console.error("❌ Error:", err.message);
}
