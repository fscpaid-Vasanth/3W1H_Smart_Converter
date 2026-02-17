import "dotenv/config";
import { generateStructuredTable } from "./src/services/ai.service.js";

async function testMultiLanguage() {
    console.log("=".repeat(60));
    console.log("🌍 TESTING MULTI-LANGUAGE SUPPORT");
    console.log("=".repeat(60));

    // Test 1: English
    console.log("\n📝 TEST 1: English");
    const englishText = "The production line stopped from running state to complete shutdown on January 15th, 2024 at 2:30 PM. The issue was caused by a bearing failure in Motor Unit 3. The maintenance team identified the problem and replaced the bearing within 4 hours.";

    try {
        const result1 = await generateStructuredTable(englishText, "3W1H");
        console.log("✅ English Result:");
        console.log("   Detected Language:", result1.detectedLanguage);
        console.log("   Was Translated:", result1.wasTranslated);
        console.log("   Rows:", result1.rows.length);
        if (result1.rows.length > 0) {
            console.log("   First Row:", JSON.stringify(result1.rows[0], null, 2));
        }
    } catch (err) {
        console.error("❌ English test failed:", err.message);
    }

    // Test 2: Kannada (from screenshot)
    console.log("\n📝 TEST 2: Kannada");
    const kannadaText = "ಅದರ ಸಂಗಲಿಯಂ ಸಿಮಾಲಾನ ಬಿಸಿಸಿಪಾಸಮಾಹಿಸಾಮಾಗಾನ ಸಿಸಾಲಿಯಂ ತಡಾಸಿಕೆ ಚದರಿ ಸಂಗಲಿಯಂ ಸಸಾ";

    try {
        const result2 = await generateStructuredTable(kannadaText, "3W1H");
        console.log("✅ Kannada Result:");
        console.log("   Detected Language:", result2.detectedLanguage);
        console.log("   Was Translated:", result2.wasTranslated);
        console.log("   Translated Text:", result2.translatedText);
        console.log("   Rows:", result2.rows.length);
        if (result2.rows.length > 0) {
            console.log("   First Row:", JSON.stringify(result2.rows[0], null, 2));
        }
    } catch (err) {
        console.error("❌ Kannada test failed:", err.message);
    }

    // Test 3: Hindi
    console.log("\n📝 TEST 3: Hindi");
    const hindiText = "उत्पादन लाइन 15 जनवरी 2024 को दोपहर 2:30 बजे चालू अवस्था से पूर्ण बंद हो गई। समस्या मोटर यूनिट 3 में बेयरिंग की विफलता के कारण हुई। रखरखाव टीम ने 4 घंटे के भीतर समस्या की पहचान की और बेयरिंग को बदल दिया।";

    try {
        const result3 = await generateStructuredTable(hindiText, "3W1H");
        console.log("✅ Hindi Result:");
        console.log("   Detected Language:", result3.detectedLanguage);
        console.log("   Was Translated:", result3.wasTranslated);
        console.log("   Translated Text:", result3.translatedText);
        console.log("   Rows:", result3.rows.length);
        if (result3.rows.length > 0) {
            console.log("   First Row:", JSON.stringify(result3.rows[0], null, 2));
        }
    } catch (err) {
        console.error("❌ Hindi test failed:", err.message);
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 MULTI-LANGUAGE TESTING COMPLETE");
    console.log("=".repeat(60));
}

testMultiLanguage();
