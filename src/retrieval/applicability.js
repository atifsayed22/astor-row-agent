export function determineApplicability(query, chunk) {
  const text = query.toLowerCase();
  const source = chunk.source.toLowerCase();
  const content = chunk.content.toLowerCase();

  // TrailPlus-specific policy
  if (source.includes("09-trailplus-membership")) {
    if (
      text.includes("trailplus") ||
      text.includes("trail plus") ||
      text.includes("membership")
    ) {
      return {
        applicable: true,
        reason: "trailplus-context",
      };
    }

    return {
      applicable: false,
      reason: "trailplus-not-mentioned",
    };
  }

  // Standard returns policy
  if (source.includes("01-returns-policy-current")) {
    if (
      text.includes("regular customer") ||
      text.includes("standard customer") ||
      text.includes("standard plan")
    ) {
      return {
        applicable: true,
        reason: "standard-customer-context",
      };
    }
  }

  // Default: don't reject information just because
  // we don't have a specialized rule for it yet.
  return {
    applicable: true,
    reason: "general-applicability",
  };
}