export function classifyChunk(chunk) {
  const metadata = chunk.metadata || {};

  const status = metadata.status;
  const authority = metadata.policy_authority;
  const audience = metadata.audience;

  // Draft/internal/non-authoritative content
  if (
    status === "draft" ||
    audience === "internal" ||
    authority === "none"
  ) {
    return {
      usable: false,
      reason: "non-authoritative",
    };
  }

  // Superseded documents are historical, not current authority
  if (status === "superseded") {
    return {
      usable: false,
      reason: "superseded",
    };
  }

  // Current official customer-facing information
  if (
    status === "active" &&
    authority === "official" &&
    audience === "customer"
  ) {
    return {
      usable: true,
      reason: "active-official-customer",
    };
  }

  // Active official information where audience isn't explicitly customer
  if (
    status === "active" &&
    authority === "official"
  ) {
    return {
      usable: true,
      reason: "active-official",
    };
  }

  return {
    usable: false,
    reason: "unknown-authority",
  };
}


export function filterAuthoritativeChunks(chunks) {
  const accepted = [];
  const rejected = [];

  for (const chunk of chunks) {
    const classification = classifyChunk(chunk);

    if (classification.usable) {
      accepted.push({
        ...chunk,
        retrievalReason: classification.reason,
      });
    } else {
      rejected.push({
        ...chunk,
        rejectionReason: classification.reason,
      });
    }
  }

  return {
    accepted,
    rejected,
  };
}