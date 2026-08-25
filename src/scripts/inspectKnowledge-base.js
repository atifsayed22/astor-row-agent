import {
  loadDocuments,
  chunkDocuments,
} from "../ingestion/knowledgeBase.js";

const documents = await loadDocuments();

console.log(`Loaded ${documents.length} documents`);

const chunks = chunkDocuments(documents);

console.log(`Created ${chunks.length} chunks`);

for (const chunk of chunks) {
  console.log("\n========================================");
  console.log(`Source: ${chunk.source}`);
  console.log(`Document ID: ${chunk.documentId}`);
  console.log(`Heading: ${chunk.heading}`);
  console.log(`Content: ${chunk.content}`);
}