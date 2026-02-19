import "dotenv/config";   // 🔥 MUST BE FIRST
import app from "./app.js";

const PORT = process.env.PORT || 5000;

console.log("ENV CHECK → OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);

app.listen(PORT, () => {
  console.log(`✅ 3W1H Smart Converter backend running on port ${PORT}`);
});
