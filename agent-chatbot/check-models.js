import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    // Note: The SDK might not have a direct listModels, but we can try to generate content with a known model to verify the key.
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("test");
    console.log("Response:", result.response.text());
  } catch (err) {
    console.error("Error:", err.message);
  }
}

listModels();
