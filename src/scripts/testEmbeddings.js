import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const text =
  "Customers on the standard plan may request a return within 30 calendar days of delivery.";

const response = await ai.models.embedContent({
  model: "gemini-embedding-001",
  contents: text,
});

const embedding = response.embeddings[0].values;

console.log("Embedding generated successfully");
console.log("Dimensions:", embedding.length);
console.log("First 10 values:", embedding.slice(0, 10));
