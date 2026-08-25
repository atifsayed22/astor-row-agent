import "dotenv/config";
import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import { knowledgeSearch } from "../tools/knowledgeSearch.js";

async function main() {
  await connectDB();

  const query =
    "How long does a regular customer have to return an unused backpack?";

  console.log("\nQuery:");
  console.log(query);

  const result = await knowledgeSearch(query);

  console.log("\nKnowledge Search Result:");
  console.dir(result, { depth: null });

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Knowledge search failed:", error);
  process.exit(1);
});