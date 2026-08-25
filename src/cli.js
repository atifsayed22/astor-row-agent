import readline from "readline";
import { createAgentSession } from "./agent/agent.js";
import { connectDB } from "./config/db.js";

async function main() {
  await connectDB();

  const session = createAgentSession();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\nYou: ",
  });

  console.log("Aster & Row Support Agent");
  console.log('Type "exit" to quit.');

  rl.prompt();

  rl.on("line", async (input) => {
    const message = input.trim();

    if (!message) {
      rl.prompt();
      return;
    }

    if (message.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    try {
      const {answer } = await session.send(message);


      console.log(`\nAGENT:\n${answer}`);
     
     
    } catch (error) {
      console.error("\nAgent error:", error);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});