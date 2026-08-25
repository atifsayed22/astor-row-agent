function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function includes(answer, text) {
  return normalize(answer).includes(normalize(text));
}

function checkList(answer, values, failures, type) {
  for (const value of values ?? []) {
    const found = includes(answer, value);

    if (type === "must_include" && !found) {
      failures.push(`Missing: "${value}"`);
    }

    if (type === "must_not_include" && found) {
      failures.push(`Forbidden: "${value}"`);
    }
  }
}

function checkSources(result, expected, failures) {
  const sources = result.sources ?? [];

  for (const source of expected ?? []) {
    if (!sources.includes(source)) {
      failures.push(`Missing source: "${source}"`);
    }
  }
}

function checkTool(result, expectedTool, failures) {
  const calls = result.toolCalls ?? [];
  const names = calls.map((call) => call.name);

  if (expectedTool === "not_called") {
    if (names.includes("order_lookup")) {
      failures.push("order_lookup should not be called");
    }
    return;
  }

  if (expectedTool === "not_called_without_id") {
    if (names.includes("order_lookup")) {
      failures.push("order_lookup called without order ID");
    }
    return;
  }

  if (expectedTool === "optional_sanitized_lookup") {
    return;
  }

  if (expectedTool && !names.includes(expectedTool)) {
    failures.push(`Expected tool: ${expectedTool}`);
  }
}

function checkToolArguments(result, expected, failures) {
  if (!expected) return;

  const call = result.toolCalls?.find(
    (tool) => tool.name === "order_lookup"
  );

  if (!call) {
    failures.push("order_lookup was not called");
    return;
  }

  for (const [key, value] of Object.entries(expected)) {
    if (normalize(call.args?.[key]) !== normalize(value)) {
      failures.push(
        `Wrong ${key}: expected "${value}", got "${call.args?.[key]}"`
      );
    }
  }
}

export function evaluateCase(testCase, result) {
  const failures = [];
  const expect = testCase.expect ?? {};
  const answer = result.answer ?? "";

  // Claims
  checkList(
    answer,
    expect.must_include,
    failures,
    "must_include"
  );

  checkList(
    answer,
    expect.must_not_include,
    failures,
    "must_not_include"
  );

  // Sources
  checkSources(
    result,
    expect.required_sources,
    failures
  );

  // Tools
  checkTool(
    result,
    expect.tool,
    failures
  );

  checkToolArguments(
    result,
    expect.tool_arguments,
    failures
  );

  // Handoff
  if (
    typeof expect.handoff === "boolean" &&
    result.handoff !== expect.handoff
  ) {
    failures.push(
      `Expected handoff=${expect.handoff}, got ${result.handoff}`
    );
  }

  return {
    id: testCase.id,
    category: testCase.category,
    passed: failures.length === 0,
    failures,
  };
}