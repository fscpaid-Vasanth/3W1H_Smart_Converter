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
        content: `You are a senior professional industrial analyst and management consultant. You extract 3W1H (What, Who, Where, When, How) data from text and produce detailed, structured, and corporate-grade analysis.
Return ONLY a valid JSON array of objects. No intro or explanation.
Each object MUST have ALL of these fields:

--- Standard 3W1H fields (for First Investigation Report) ---
- what: What happened or what is the issue? (full description)
- from: Origin, starting point, or initial state.
- to: Result, destination, or target state.
- when: Timing, duration, or specific date/time.
- who: People, teams, or parties involved.
- how: Method, cause, or how it was resolved.

--- Professional Investigation Analysis ( 3W1H ) fields ---
CRITICAL: The fields below (problem, actionPlan) must be COMPLETELY DIFFERENT and MUCH LONGER than the standard fields (what, how) above. The standard fields contain raw short data. The professional fields must contain expanded, elaborate, corporate-grade professional statements. NEVER copy the same text. Always expand and elaborate with professional supportive language.

- problem: MUST be MINIMUM 100 WORDS and MUST be completely different from the "what" field above. Take the raw "what" data and transform it into a lengthy, formal, professional problem statement. Start with phrases like "It has been critically observed and documented that..." or "Upon thorough examination and detailed assessment, it has come to the attention of the management that..." or "A comprehensive review of operational performance has revealed a significant and concerning issue wherein...". Include: impact on business operations, severity of the issue, affected stakeholders, financial implications, operational disruptions, and consequences if the problem remains unaddressed. Use elaborate formal corporate language throughout. This must read like a professional management consulting report paragraph.

- actionPlan: MUST be MINIMUM 100 WORDS and MUST be completely different from the "how" field above. Take the raw "how" data and transform it into a lengthy, formal, professional action plan. Format as numbered steps (1. 2. 3. etc.). Start each action with professional phrases like "It is strongly recommended to immediately initiate..." or "The management team is advised to implement a comprehensive..." or "As a strategic corrective measure, it is proposed to...". Each action must include specific quantities, metrics, timelines, responsible parties, expected outcomes, and KPIs for monitoring progress. Use elaborate formal corporate language throughout.

- fromNumeric: The numerical starting value or current baseline metric with a professional supportive statement describing the current state (e.g., "The current operational baseline stands at an insufficient level of 7 customer care executives, which has been assessed as significantly below the optimal staffing requirement").

- toNumeric: The numerical target value or goal metric with a professional supportive statement describing the desired outcome (e.g., "The strategic target has been established at 8 customer care executives, which is projected to achieve a 15% improvement in service delivery capacity and operational efficiency").

- summary: Write a comprehensive executive summary paragraph (MINIMUM 400 WORDS). The summary MUST consolidate: (1) WHAT - the complete problem with context and business impact, (2) HOW - the full quantified action plan with numbers, metrics and timelines, (3) FROM - current baseline metrics and starting values, (4) TO - target metrics and desired outcomes. Include root cause analysis, stakeholder involvement, expected business impact, timeline, risk assessment, and monitoring framework. Use formal professional corporate language with quantified statements throughout.

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
  console.log("🤖 RAW AI RESPONSE:", raw);
  const cleaned = cleanJson(raw);
  console.log("🧼 CLEANED AI JSON:", cleaned);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error("❌ JSON PARSE ERROR:", parseErr.message);
    console.error("❌ RAW CLEANED TEXT:", cleaned.substring(0, 500));
    throw new Error("AI returned invalid JSON: " + parseErr.message);
  }

  // ✅ FORCE ARRAY
  if (!Array.isArray(parsed)) {
    // If it's an object with a rows/data array, extract it
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

  // Return with metadata
  // POST-PROCESS: Ensure professional fields are different from raw fields
  console.log("🔄 POST-PROCESSING: Checking", parsed.length, "rows for professional field expansion");
  for (const row of parsed) {
    console.log("📋 ROW CHECK — problem:", (row.problem || "MISSING").substring(0, 50), "| what:", (row.what || "MISSING").substring(0, 50));
    console.log("📋 ROW CHECK — problem length:", row.problem ? row.problem.length : 0, "| same as what:", row.problem === row.what);
    // If problem is missing or same as what, expand it professionally
    if (!row.problem || row.problem === row.what || row.problem.length < 80) {
      console.log("✅ EXPANDING problem field (was too short or same as what)");
      const rawWhat = row.what || "the identified issue";
      row.problem = `It has been critically observed and documented through a comprehensive operational review that ${rawWhat.toLowerCase()}. This issue has been assessed as having significant adverse implications on the overall business performance, operational efficiency, and strategic growth objectives of the organization. The severity of this matter warrants immediate attention from the management team, as continued inaction may result in further deterioration of key performance indicators, declining customer satisfaction levels, reduced revenue generation capacity, and potential loss of competitive advantage in the market. A thorough root cause analysis indicates that systemic operational gaps and resource constraints have contributed to the emergence of this critical concern, thereby necessitating urgent strategic intervention and the implementation of corrective measures to restore operational stability and drive sustainable improvement.`;
    }
    // If actionPlan is missing or same as how, expand it professionally  
    if (!row.actionPlan || row.actionPlan === row.how || row.actionPlan.length < 80) {
      const rawHow = row.how || "implement corrective measures";
      row.actionPlan = `1. It is strongly recommended to immediately initiate the strategic implementation of the following corrective measures: ${rawHow}. The responsible department heads and team leaders shall be accountable for ensuring timely execution within the designated timeline. 2. The management team is advised to establish a comprehensive performance monitoring and tracking system with clearly defined Key Performance Indicators (KPIs) to measure the effectiveness of the implemented actions on a weekly and monthly basis. 3. As a strategic corrective measure, it is proposed to conduct regular progress review meetings with all relevant stakeholders to assess the status of implementation, identify potential bottlenecks, and make necessary adjustments to ensure the achievement of the targeted outcomes and organizational objectives within the stipulated timeframe.`;
    }
    // If fromNumeric is missing, generate from raw
    if (!row.fromNumeric || row.fromNumeric === row.from) {
      row.fromNumeric = `The current operational baseline stands at: ${row.from || 'the existing level'}, which has been assessed as requiring significant improvement to meet the organizational performance standards and strategic targets`;
    }
    // If toNumeric is missing, generate from raw
    if (!row.toNumeric || row.toNumeric === row.to) {
      row.toNumeric = `The strategic target has been established at: ${row.to || 'the desired level'}, which is projected to deliver measurable improvements in operational efficiency, service delivery, and overall business performance`;
    }
    // If summary is missing or too short, build from other fields
    if (!row.summary || row.summary.length < 200) {
      row.summary = `${row.problem} Furthermore, the proposed action plan encompasses the following strategic measures: ${row.actionPlan} The transition from the current baseline of ${row.fromNumeric} to the targeted outcome of ${row.toNumeric} represents a critical organizational priority. The successful implementation of these measures is expected to yield significant improvements in operational performance, enhance customer satisfaction levels, strengthen competitive positioning, and contribute to the long-term sustainable growth of the organization. All stakeholders are advised to collaborate closely and ensure accountability throughout the implementation process.`;
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

