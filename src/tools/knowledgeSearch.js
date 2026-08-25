import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import mongoose from "mongoose";
import { filterAuthoritativeChunks } from "../retrieval/retrievalPolicy.js";
import { connectDB } from "../config/db.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function generateEmbedding(text) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });

  return response.embeddings[0].values;
}

export async function knowledgeSearch(query) {
  if (!query || typeof query !== "string") {
    return {
      success: false,
      error: "Search query is required.",
      results: [],
    };
  }

  const queryEmbedding = await generateEmbedding(query);

  // Reuse the existing MongoDB connection.
  const db = mongoose.connection.useDb("aster_row");

  const results = await db
    .collection("knowledge_chunks")
    .aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 50,
          limit: 10,
        },
      },
      {
        $project: {
          _id: 0,
          content: 1,
          source: 1,
          documentId: 1,
          title: 1,
          heading: 1,
          metadata: 1,
          score: {
            $meta: "vectorSearchScore",
          },
        },
      },
    ])
    .toArray();

  const filtered = filterAuthoritativeChunks(results);

  return {
    success: true,
    results: filtered.accepted,
  };
}