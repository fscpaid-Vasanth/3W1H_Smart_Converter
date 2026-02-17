import OpenAI from "openai";

let openaiClient;

function getClient() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY missing at runtime");
    }

    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openaiClient;
}

function cleanJson(text) {
  return text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

/**
 * Detect language from text using GPT-4o-mini
 * Returns ISO 639-1 language code (e.g., 'en', 'kn', 'hi', 'ta')
 */
export async function detectLanguage(text) {
  const client = getClient();

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a language detection expert. Respond ONLY with the ISO 639-1 language code (2 letters). Examples: en, kn, hi, ta, te, ml, mr, bn, pa, gu"
        },
        {
          role: "user",
          content: `Detect the language of this text: "${text.substring(0, 500)}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 10
    });

    const langCode = response.choices[0].message.content.trim().toLowerCase();
    console.log("🌍 DETECTED LANGUAGE:", langCode);
    return langCode;
  } catch (err) {
    console.error("❌ Language detection failed:", err);
    return "en"; // Default to English on error
  }
}

/**
 * Translate non-English text to English using GPT-4o-mini
 */
export async function translateToEnglish(text, sourceLang) {
  const client = getClient();

  console.log(`🔄 TRANSLATING from ${sourceLang} to English...`);

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional translator. Translate the given text to English. Preserve technical terms, names, dates, and numbers exactly. Return ONLY the translated text, no explanations."
        },
        {
          role: "user",
          content: `Translate this ${sourceLang} text to English:\n\n${text}`
        }
      ],
      temperature: 0.2
    });

    const translation = response.choices[0].message.content.trim();
    console.log("✅ TRANSLATION:", translation);
    return translation;
  } catch (err) {
    console.error("❌ Translation failed:", err);
    throw new Error("Translation failed: " + err.message);
  }
}

export async function generateStructuredTable(text, framework) {
  const client = getClient();

  // Step 1: Detect language
  const detectedLang = await detectLanguage(text);
  let textToAnalyze = text;
  let wasTranslated = false;

  // Step 2: Translate if not English
  if (detectedLang !== "en") {
    console.log(`⚠️ Non-English text detected (${detectedLang}). Translating...`);
    textToAnalyze = await translateToEnglish(text, detectedLang);
    wasTranslated = true;
  }

  // Step 3: Extract 3W1H from English text
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a professional industrial analyst extracting 3W1H (What, Who, Where, When, How) data from text.
Return ONLY a valid JSON array of objects. No intro or explanation.
Each object MUST have these fields:
- what: What happened or what is the issue?
- from: Origin, starting point, or initial state.
- to: Result, destination, or target state.
- when: Timing, duration, or specific date/time.
- who: People, teams, or parties involved.
- how: Method, cause, or how it was resolved.

${wasTranslated ? "Note: This text was translated from another language. Extract the information accurately." : ""}`
      },
      {
        role: "user",
        content: `Extract the 3W1H analysis from the following text:
"${textToAnalyze}"`
      }
    ],
    temperature: 0.2
  });

  const raw = response.choices[0].message.content;
  console.log("🤖 RAW AI RESPONSE:", raw);
  const cleaned = cleanJson(raw);
  console.log("🧼 CLEANED AI JSON:", cleaned);

  const parsed = JSON.parse(cleaned);

  // ✅ FORCE ARRAY
  if (!Array.isArray(parsed)) {
    throw new Error("AI did not return array");
  }

  // Return with metadata
  return {
    rows: parsed,
    detectedLanguage: detectedLang,
    wasTranslated,
    originalText: text,
    translatedText: wasTranslated ? textToAnalyze : null
  };
}

