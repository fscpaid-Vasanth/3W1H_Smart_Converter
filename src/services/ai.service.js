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

  console.log("🚀 CONSOLIDATED AI ANALYSIS STARTING...");

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a senior professional industrial analyst and management consultant. You extract 3W1H (What, Who, Where, When, How) data from text and produce detailed, structured, and corporate-grade analysis.

TASK:
1. Detect the language of the input text.
2. If the language is NOT English, translate the information to English for the analysis fields.
3. Extract 3W1H data and group related observations.
4. Return ONLY a valid JSON object with this structure:
{
  "detectedLanguage": "ISO 639-1 code (e.g., 'en', 'kn', 'hi')",
  "wasTranslated": true/false,
  "translatedText": "Full text translated to English (null if already English)",
  "rows": [
    {
      "what": "SHORT raw extracted fact (1-2 sentences)",
      "from": "Origin/initial state (SHORT)",
      "to": "Result/target state (SHORT)",
      "when": "ACTION PLAN DEADLINE (e.g. 'By end of Q1')",
      "who": "Teams/People involved in action",
      "how": "Method/Action taken (SHORT)",
      "problem": "Professional problem statement (25-30 words)",
      "actionPlan": "Professional action plan (25-30 words, 2 steps)",
      "fromNumeric": "Starting metric with qualifier (1 sentence)",
      "toNumeric": "Target metric with qualifier (1 sentence)",
      "summary": "Executive summary (150-200 words)"
    }
  ]
}

CRITICAL: 
- Group all related observations into a single analysis row.
- "when" MUST be the deadline for the action plan, not the time of the incident.
- Return ONLY JSON.`
      },
      {
        role: "user",
        content: `Analyze the following text professionally:\n"${text}"`
      }
    ],
    temperature: 0.3,
    max_tokens: 8192,
    response_format: { type: "json_object" }
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  console.log("✅ CONSOLIDATED AI ANALYSIS COMPLETE. Detected:", parsed.detectedLanguage);

  return {
    rows: parsed.rows || [],
    detectedLanguage: parsed.detectedLanguage || "en",
    wasTranslated: parsed.wasTranslated || false,
    originalText: text,
    translatedText: parsed.translatedText || (parsed.wasTranslated ? text : null)
  };
}


