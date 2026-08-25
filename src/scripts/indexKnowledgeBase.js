import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import mongoose from "mongoose";

import { loadDocuments, chunkDocuments } from "../ingestion/knowledgeBase.js";
import { connectDB } from "../config/db.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const collection = () =>
  mongoose.connection.useDb("aster_row").collection("knowledge_chunks");

async function generateEmbedding(text) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });

  return response.embeddings[0].values;
}

async function main() {
  await connectDB();

  console.log("Loading knowledge base...");

  const documents = await loadDocuments();
  const chunks = chunkDocuments(documents);

  console.log(`Loaded ${documents.length} documents`);
  console.log(`Created ${chunks.length} chunks`);

  const dbCollection = collection();

  // Clear previous ingestion
  await dbCollection.deleteMany({});

  console.log("Generating embeddings...\n");

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const embedding = await generateEmbedding(chunk.content);

    await dbCollection.insertOne({
      content: chunk.content,
      embedding,

      source: chunk.source,
      documentId: chunk.documentId,
      title: chunk.title,
      heading: chunk.heading,

      metadata: chunk.metadata,

      createdAt: new Date(),
    });

    console.log(
      `[${i + 1}/${chunks.length}] Indexed ${chunk.source} → ${chunk.heading}`
    );
  }

  console.log("\nKnowledge base indexing complete.");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Indexing failed:", error);

  await mongoose.disconnect();

  process.exit(1);
});