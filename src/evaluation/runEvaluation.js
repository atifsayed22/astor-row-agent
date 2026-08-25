import "dotenv/config";

import { connectDB } from "../config/db.js";
import { createAgentSession } from "../agent/agent.js";
import { evaluationCases } from "./evaluationCases.js";
import { evaluateCase } from "./evaluator.js";

async function runCase(testCase) {
  const session = createAgentSession();

  let finalResult = null;

  for (const message of testCase.messages) {
    finalResult = await session.send(message.content);
  }

  return finalResult;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await connectDB();

  const requestedIds = process.argv.slice(2);

  const casesToRun =
    requestedIds.length > 0
      ? evaluationCases.filter((testCase) => requestedIds.includes(testCase.id))
      : evaluationCases;

  console.log("\n========================================");
  console.log("ASTER & ROW AGENT EVALUATION");
  console.log("========================================\n");

  let passed = 0;
  let failed = 0;
  let quota = 0;
  let errors = 0;

  for (const testCase of casesToRun) {
    process.stdout.write(`Running ${testCase.id} ... `);

    try {
      const result = await runCase(testCase);

      const evaluation = evaluateCase(testCase, result);

      if (evaluation.passed) {
        passed++;
        console.log("PASS");
      } else {
        failed++;

        console.log("FAIL");

        console.log("\n   AGENT ANSWER:");
        console.log(`   ${result.answer}`);

        for (const failure of evaluation.failures) {
          console.log(`   - ${failure}`);
        }
      }
    } catch (error) {
      if (error?.status === 429) {
        quota++;

        console.log("QUOTA");
        console.log("   - Gemini API rate limit reached");
      } else {
        errors++;

        console.log("ERROR");
        console.log(`   - ${error.message}`);
      }
    }

    await sleep(15000);
  }

  console.log("\n========================================");
  console.log("EVALUATION SUMMARY");
  console.log("========================================");

  console.log(`Total:  ${casesToRun.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Quota:  ${quota}`);
  console.log(`Errors: ${errors}`);

  console.log("========================================\n");

  await import("mongoose").then(({ default: mongoose }) =>
    mongoose.disconnect(),
  );

  if (failed > 0 || errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\nEvaluation failed:", error);
  process.exit(1);
});
