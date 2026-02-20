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

  // Step 2: Translation
  if (detectedLang !== "en") {
    console.log(`⚠️ Non-English text detected (${detectedLang}). Translating...`);
    textToAnalyze = await translateToEnglish(text, detectedLang);
    wasTranslated = true;
  }

  // Step 3: Extract 3W1H
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a senior professional industrial analyst and management consultant. You extract 3W1H (What, Who, Where, When, How) data from text and produce detailed, structured, and corporate-grade analysis.
Return ONLY a valid JSON array of objects. No intro or explanation.
Each object MUST have ALL of these fields:

--- Standard 3W1H fields (for First Investigation Report — keep these SHORT and CONCISE) ---
- what: What happened or what is the issue? SHORT answer, max 1-2 sentences, raw extracted fact only.
- from: Origin, starting point, or initial state. SHORT — 1 sentence or a number/metric only.
- to: Result, destination, or target state. SHORT — 1 sentence or a number/metric only.
- when: ACTION PLAN TIMELINE. When will the action be completed? (e.g., "By end of Q1 2026", "Within 2 weeks"). DO NOT use the time the issue occurred.
- who: People, teams, or parties involved in the ACTION. SHORT — names, roles, or departments only.
- how: Method, cause, or action taken. SHORT answer, max 1-2 sentences, raw extracted fact only.

--- Professional Investigation Analysis ( 3W1H ) fields ---
- problem: A concise professional problem statement (exactly 25-30 words). Rephrase the raw "what" professionally. MUST be between 25 and 30 words.
- actionPlan: A concise professional action plan (exactly 25-30 words, 2 numbered steps). MUST be between 25 and 30 words.
- fromNumeric: The starting metric with a brief professional qualifier (1 sentence).
- toNumeric: The target metric with a brief professional qualifier (1 sentence).
- summary: A concise executive summary (150-200 words) covering What, How, From, and To.

CRITICAL INSTRUCTIONS:
1. CONSOLIDATION: Group all related observations into a single analysis row. DO NOT create multiple rows for the same overarching issue (e.g., if multiple sentences refer to "manpower shortage", create only ONE row).
2. TIMELINE: The "when" field MUST indicate the DEADLINE or DURATION of the Action Plan.
3. LANGUAGE: Use formal, senior-consultant-grade English.

${wasTranslated ? "Note: This text was translated from another language. Extract the information accurately." : ""}`
      },
      {
        role: "user",
        content: `Extract the 3W1H analysis from the following text:
"${textToAnalyze}"`
      }
    ],
    temperature: 0.4,
    max_tokens: 8192
  });

  const raw = response.choices[0].message.content;
  const cleaned = cleanJson(raw);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    throw new Error("AI returned invalid JSON: " + parseErr.message);
  }

  // ✅ FORCE ARRAY
  if (!Array.isArray(parsed)) {
    if (parsed && typeof parsed === 'object') {
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) {
          parsed = parsed[key];
          break;
        }
      }
    }
    if (!Array.isArray(parsed)) {
      throw new Error("AI did not return array");
    }
  }

  return {
    rows: parsed,
    detectedLanguage: detectedLang,
    wasTranslated,
    originalText: text,
    translatedText: wasTranslated ? textToAnalyze : null
  };
}

