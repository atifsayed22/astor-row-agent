import { orderLookup } from "../tools/orderLookup.js";

async function test() {
  console.log("\n=== Valid order ===");
  console.log(await orderLookup("ORD-1007"));

  console.log("\n=== Lowercase + whitespace ===");
  console.log(await orderLookup("  ord-1007 "));

  console.log("\n=== Unknown order ===");
  console.log(await orderLookup("ORD-9999"));

  console.log("\n=== Invalid order ID ===");
  console.log(await orderLookup("hello"));

  console.log("\n=== Missing order ID ===");
  console.log(await orderLookup());

  console.log("\n=== Cancelled order ===");
  console.log(await orderLookup("ORD-1004"));

  console.log("\n=== Shipped without ETA ===");
  console.log(await orderLookup("ORD-1011"));
}

test().catch(console.error);