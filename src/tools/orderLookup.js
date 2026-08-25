import fs from "fs/promises";
import path from "path";

const ORDERS_PATH = path.resolve(
  process.cwd(),
  "data",
  "orders.json"
);

export async function orderLookup(orderId) {
  // Validate input
  if (!orderId || typeof orderId !== "string") {
    return {
      found: false,
      error: "Order ID is required.",
    };
  }

  // Normalize harmless input differences
  const normalizedOrderId = orderId.trim().toUpperCase();

  // Basic order ID format validation
  if (!/^ORD-\d+$/.test(normalizedOrderId)) {
    return {
      found: false,
      error: "Invalid order ID format.",
    };
  }

  const rawData = await fs.readFile(ORDERS_PATH, "utf-8");
  const data = JSON.parse(rawData);
  const orders = data.orders || [];

  const order = orders.find(
    (item) => item.order_id === normalizedOrderId
  );

  if (!order) {
    return {
      found: false,
      error: "Order was not found.",
    };
  }

  // Return ONLY customer-safe information
  const result = {
    found: true,
    orderId: order.order_id,
    status: order.status,
  };

  // Carrier is useful when available
  if (order.carrier) {
    result.carrier = order.carrier;
  }

  // Only expose ETA for orders where it makes sense.
  if (
    order.status !== "cancelled" &&
    order.status !== "returned" &&
    order.estimated_delivery
  ) {
    result.estimatedDelivery = order.estimated_delivery;
  }

  return result;
}