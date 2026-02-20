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
- when: Timing, duration, or specific date/time. SHORT — date, period, or timeframe only.
- who: People, teams, or parties involved. SHORT — names, roles, or departments only.
- how: Method, cause, or action taken. SHORT answer, max 1-2 sentences, raw extracted fact only.

--- Professional Investigation Analysis ( 3W1H ) fields ---
The fields below must be DIFFERENT from the raw standard fields (what, how) above. Use professional corporate language.

- problem: A concise professional problem statement (25-35 words). Rephrase the raw "what" professionally. Example: "It has been critically observed that [issue], posing adverse implications on performance and requiring immediate corrective action."

- actionPlan: A concise professional action plan (25-35 words, 2 numbered steps). Rephrase the raw "how" professionally. Example: "1. Immediately implement [action] with clear accountability. 2. Track progress via weekly KPIs to ensure performance."

- fromNumeric: The starting metric with a brief professional qualifier (1 sentence, e.g., "Current baseline: 2 executives, assessed as below optimal operational requirement").

- toNumeric: The target metric with a brief professional qualifier (1 sentence, e.g., "Strategic target: 5 executives, projected to achieve full operational efficiency").

- summary: Write a concise executive summary (150-200 words) covering: (1) WHAT — the problem with business impact, (2) HOW — the action plan with key steps, (3) FROM — current baseline, (4) TO — target outcome. Use professional formal language.

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

