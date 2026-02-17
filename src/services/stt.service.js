import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * ======================================
 * SPEECH → TEXT (SAFE + FORMAT FIXED)
 * ======================================
 */
export async function speechToText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error("Audio file not found for STT");
  }

  // 🔥 FORCE EXTENSION FIX
  let ext = path.extname(filePath).toLowerCase();

  // If no extension → assume webm
  if (!ext) {
    const newPath = `${filePath}.webm`;
    fs.renameSync(filePath, newPath);
    filePath = newPath;
    ext = ".webm";
  }

  // Allowed formats by OpenAI
  const allowed = [
    ".flac", ".m4a", ".mp3", ".mp4",
    ".mpeg", ".mpga", ".oga", ".ogg",
    ".wav", ".webm"
  ];

  if (!allowed.includes(ext)) {
    throw new Error(`Unsupported audio format: ${ext}`);
  }

  try {
    const stats = fs.statSync(filePath);
    console.log("📊 STT FILE SIZE:", stats.size, "bytes");
  } catch (e) {
    console.warn("⚠️ Could not get file stats:", e.message);
  }

  console.log("🎧 STT FILE:", filePath);

  // 🔥 SEND WITH CORRECT FILENAME
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-1",
    response_format: "text",
    prompt: "This is a business/industrial analysis recording for the 3W1H framework (What, Who, Where, When, How)."
  });

  console.log("📝 TRANSCRIPTION RESULT:", transcription);

  if (!transcription || !transcription.trim()) {
    throw new Error("Empty transcription from audio");
  }

  return transcription;
}
