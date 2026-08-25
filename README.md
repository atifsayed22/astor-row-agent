# Aster & Row Customer Support Agent

## Overview

This repository contains a small agentic customer-support system for Aster & Row. The system uses Gemini via the Google GenAI SDK, tool calling, a knowledge base of policy documents, and a mock order dataset to answer customer questions in a grounded way.

The agent is designed to answer Aster & Row company-specific questions using Gemini plus the two main tools in the project:

1. `knowledge_search`
   - Used for company-specific information such as returns, shipping, products, warranties, memberships, and policy questions.
   - This tool searches the curated Markdown knowledge base and returns authoritative, customer-safe excerpts.

2. `order_lookup`
   - Used when the customer asks about a specific order.
   - Requires an order ID such as `ORD-1007`.
   - Reads from the repository’s sample order dataset in `data/orders.json`.

The agent decides whether to answer directly, call `knowledge_search`, call `order_lookup`, or safely refuse and ask for human assistance when the information is insufficient or conflict is detected. The implementation also keeps a conversation history in memory and passes the relevant user and model context back to Gemini for multi-turn interactions.

## Features

The repository implements the following features that are actually present in code:

- Knowledge-base question answering using Gemini and `knowledge_search`
- Semantic retrieval with embeddings generated via Gemini embedding APIs and MongoDB Atlas vector search
- Tool calling with structured function declarations for `knowledge_search` and `order_lookup`
- Order lookup against the repository dataset in `data/orders.json`
- Multi-turn conversation handling through in-memory `contents` history in the agent session
- Source and citation tracking from retrieval results, including `source`, `documentId`, `title`, and `heading`
- Prompt-injection protection by filtering documents with `status: draft`, `audience: internal`, and `policy_authority: none`
- Privacy protection by restricting order lookup result fields to customer-safe values and excluding internal data such as email, shipping address, and risk scores
- Safe refusal / no guessing when policy information is insufficient or the data is missing
- Human assistance / handoff behavior through a `handoff` boolean returned in the Gemini response schema
- Evaluation suite with reusable cases in `src/evaluation/evaluationCases.js` and assertions in `src/evaluation/evaluator.js`

The project does not implement a production ticketing system or a real human-handoff integration. The code only returns a handoff recommendation to the model and the CLI output.

## Architecture

![Agent Architecture](./agent.png)

The runtime flow in this repository is:

Customer
↓
Agent orchestration
↓
Gemini LLM
↓
Tool decision
↓
`knowledge_search` OR `order_lookup`
↓
Tool result
↓
Gemini
↓
Final grounded answer
↓
Customer

The central implementation is in `src/agent/agent.js`. It creates a chat session, appends each user message to an in-memory conversation array, and then calls Gemini with a system instruction that describes the support behavior and safety rules.

Gemini is responsible for:

- reasoning over the user request
- understanding intent and context
- deciding whether a tool is required
- generating tool arguments such as a search query or order ID
- interpreting tool outputs
- generating the final customer-facing response with a `handoff` flag

The tool layer is implemented in `src/tools/knowledgeSearch.js` and `src/tools/orderLookup.js`.

- `knowledge_search` retrieves authoritative Aster & Row company information from the MongoDB-backed knowledge store.
- `order_lookup` reads a specific order from `data/orders.json`, validates the order ID format, and returns only customer-safe fields.

Retrieved knowledge is passed back to the model as tool output. Gemini uses that content, together with the agent’s conversation context, to generate the final answer. The code does not perform a separate post-processing layer beyond the tool return and the LLM’s final JSON response.

### Knowledge-base ingestion pipeline

![Knowledge Base Ingestion Pipeline](./ingestion.png)

The actual ingestion flow in this repository is:

Knowledge Base Documents
↓
Document Loading
↓
Metadata Extraction
↓
Chunking
↓
Embedding Generation
↓
Vector/Search Storage

The source documents are stored under `knowledge-base/` as Markdown files such as `01-returns-policy-current.md` and `09-trailplus-membership.md`. The ingestion logic in `src/ingestion/knowledgeBase.js` reads each Markdown file, parses frontmatter with `gray-matter`, and keeps both the document metadata and the Markdown content.

The repository uses frontmatter metadata such as:

- `document_id`
- `title`
- `status`
- `effective_date`
- `audience`
- `policy_authority`
- `supersedes`

Chunking is done by section heading: `chunkDocument()` splits the file by Markdown `##` headings and creates a search chunk per section, preserving the document source, title, heading, and metadata. The chunk content is the text under each heading.

Embeddings are generated in `src/scripts/indexKnowledgeBase.js` using `ai.models.embedContent()` with the model `gemini-embedding-001`. These embeddings are then inserted into the MongoDB collection `knowledge_chunks` in the `aster_row` database. The vector search is executed with MongoDB `$vectorSearch` using the index `vector_index` and the `embedding` field.

This project does use MongoDB and vector search, but it is not a generic production search platform; it is a lightweight repository-backed search index for the support agent.

### Retrieval pipeline

![Retrieval Pipeline](./retrieval.png)

The retrieval flow implemented by the project is:

User Question
↓
Search Query
↓
Query Embedding
↓
Similarity Search
↓
Candidate Chunks
↓
Metadata / Authority Filtering
↓
Relevant Context
↓
Gemini
↓
Grounded Answer

The retrieval code is in `src/tools/knowledgeSearch.js` and `src/retrieval/retrievalPolicy.js`.

The current runtime path is:

- build a text query from the user message
- generate an embedding for that query with `gemini-embedding-001`
- query MongoDB with `$vectorSearch`
- project a subset of chunk fields, including `content`, `source`, `documentId`, `title`, `heading`, and vector-search score
- filter the results using `filterAuthoritativeChunks()`

`retrievalPolicy.js` applies policy-level filtering by checking document metadata such as:

- `status` (`active`, `draft`, `superseded`)
- `policy_authority` (`official`, `none`)
- `audience` (`customer`, `internal`)

The project explicitly rejects non-authoritative, draft, internal, or superseded content. It also contains applicability logic in `src/retrieval/applicability.js`, but the active retrieval pipeline in `knowledgeSearch.js` uses authoritative filtering as its main gate before returning relevant context. The resulting accepted chunks are sent back to Gemini, which uses the retrieved sections to answer grounded questions and cite the source file and heading.

## Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| Programming language | JavaScript (ES modules) | Core application logic |
| Runtime | Node.js | Executes the CLI and agent logic |
| LLM | Gemini 3.6 Flash (`gemini-3.6-flash`) | Reasoning, intent detection, tool use, and final answer generation |
| Google GenAI SDK | `@google/genai` | Gemini API integration and embeddings |
| Embedding approach | Gemini Embedding API (`gemini-embedding-001`) | Query and document embedding generation |
| Retrieval approach | MongoDB Atlas vector search with `$vectorSearch` | Semantic similarity search across knowledge chunks |
| Storage | MongoDB (`aster_row`, `knowledge_chunks`) | Searchable knowledge index |
| Order data source | JSON file (`data/orders.json`) | Mock customer order lookup dataset |
| Environment configuration | `dotenv` | Reads `.env` values |
| Frontmatter parsing | `gray-matter` | Extracts metadata from Markdown knowledge-base files |
| Evaluation approach | Node.js case runner and custom assertions | Runs scenario-based evaluation against the agent |
| CLI | `node src/cli.js` | Interactive customer-support command-line interface |

## Project Structure

The repository structure in the current workspace is:

```text
server/
├── .env.example
├── .gitignore
├── README.md
├── agent.png
├── ingestion.png
├── retrieval.png
├── package.json
├── package-lock.json
├── data/
│   ├── orders-data-dictionary.md
│   └── orders.json
├── knowledge-base/
│   ├── 01-returns-policy-current.md
│   ├── 02-returns-policy-legacy.md
│   ├── 03-final-sale-and-promotions.md
│   ├── 04-damaged-or-wrong-items.md
│   ├── 05-domestic-shipping.md
│   ├── 06-international-shipping.md
│   ├── 07-warranty.md
│   ├── 08-order-changes-and-cancellations.md
│   ├── 09-trailplus-membership.md
│   ├── 10-gift-cards-and-price-adjustments.md
│   ├── 11-product-care.md
│   ├── 12-breeze-tumbler-product-card.md
│   ├── 13-support-escalation.md
│   └── 14-internal-content-migration-notes.md
├── src/
│   ├── agent/
│   │   └── agent.js
│   ├── cli.js
│   ├── config/
│   │   └── db.js
│   ├── evaluation/
│   │   ├── evaluationCases.js
│   │   ├── evaluator.js
│   │   └── runEvaluation.js
│   ├── ingestion/
│   │   ├── indexDocuments.js
│   │   └── knowledgeBase.js
│   ├── retrieval/
│   │   ├── applicability.js
│   │   └── retrievalPolicy.js
│   ├── scripts/
│   │   ├── indexKnowledgeBase.js
│   │   ├── inspectKnowledge-base.js
│   │   ├── testEmbeddings.js
│   │   ├── testOrderLookup.js
│   │   └── testRetrievalPolicy.js
│   └── tools/
│       ├── knowledgeSearch.js
│       └── orderLookup.js
└── node_modules/
```

Key directories and files:

- `data/` contains the mock order snapshot and the data dictionary.
- `knowledge-base/` contains the Markdown policy sources used for retrieval.
- `src/agent/agent.js` contains the agent orchestration and tool-calling loop.
- `src/tools/knowledgeSearch.js` implements retrieval over the knowledge base.
- `src/tools/orderLookup.js` implements the customer-safe order lookup.
- `src/retrieval/` contains authoritative filtering and applicability logic.
- `src/ingestion/` contains document loading and chunking logic.
- `src/evaluation/` contains evaluation cases and evaluator logic.
- `src/cli.js` launches the interactive CLI.
- `package.json` defines the startup and evaluation scripts.
- `.env.example` declares the environment variables used by the project.
- `.gitignore` excludes local environment and dependency files.

## Setup

Use the following steps from a clean clone of the repository:

1. Clone the repository.
2. Open the project folder.
3. Change into the `server` directory.
4. Install dependencies:

```powershell
cd server
npm install
```

5. Create a local environment file from the example:

```powershell
copy .env.example .env
```

6. Configure the required environment values in `.env`.
7. Ensure the MongoDB Atlas connection is reachable from your environment.
8. Run the agent:

```powershell
npm start
```

The project’s actual scripts in `package.json` are:

```json
"start": "node src/cli.js"
"evaluate": "node src/evaluation/runEvaluation.js"
```

This project does not include a local database bootstrap script or a production deployment configuration.

## Environment Variables

The repository includes `.env.example` with the following variables:

```env
GEMINI_API_KEY=
MONGODB_URI=
```

The current code uses the following environment variables and behavior:

- `GEMINI_API_KEY` is required for the Google GenAI client in `src/agent/agent.js`, `src/tools/knowledgeSearch.js`, and `src/scripts/indexKnowledgeBase.js`.
- `MONGODB_URI` is declared in `.env.example`, but the actual runtime connection in `src/config/db.js` is currently a hardcoded MongoDB Atlas URI rather than `process.env.MONGODB_URI`.

Important: real credentials must never be committed to the repository. Keep `.env` local and untracked.

## Running the Agent

Start the CLI agent with:

```powershell
npm start
```

This launches the interactive support agent in `src/cli.js`.

Example interactions based on the repository’s actual behavior:

Example 1: knowledge-base question

```text
You: How long does a regular customer have to return an unused backpack?
AGENT: Standard customers have 30 calendar days from delivery to request a return, subject to the item being unused and in resalable condition.
```

Example 2: order lookup

```text
You: Where is ORD-1007 and when should it arrive?
AGENT: ORD-1007 is shipped via UPS and is expected to arrive on August 22, 2026.
```

Example 3: multi-turn conversation

```text
You: Do you ship internationally?
AGENT: Aster & Row currently ships internationally only to Canada.

You: What about Canada, and how long does it take?
AGENT: Canadian orders generally arrive within 5–9 business days after dispatch, and import duties and taxes are not prepaid by Aster & Row.
```

Example 4: insufficient information / refusal to guess

```text
You: Are all fabrics and adhesives in your bags vegan?
AGENT: The supplied information is insufficient to confirm that, and I recommend human confirmation before making that claim.
```

The system is intentionally conservative: it does not guess when the information is missing or when the answer would require unsupported policy assumptions.

## Running the Evaluation

Run the evaluation suite with:

```powershell
npm run evaluate
```

This executes `src/evaluation/runEvaluation.js` and runs the cases defined in `src/evaluation/evaluationCases.js` against the agent session. The runner:

- creates an agent session
- sends each case’s user messages sequentially
- checks the final answer against expected requirements
- validates tool calls and arguments
- validates the `handoff` flag
- reports pass/fail and quota/error counts

The evaluation runner also supports running a single case by ID if a matching case exists. For example:

```powershell
npm run evaluate -- valid-order-lookup
```

The case definitions are in `src/evaluation/evaluationCases.js` and the assertion logic is in `src/evaluation/evaluator.js`.

## Evaluation Results

Baseline results were recorded during development but are not currently stored as a machine-readable artifact in the repository. The project does include an active evaluation suite and real evaluation cases, but the repository does not currently contain a persisted baseline CSV/JSON file with scored results.

A placeholder summary table is below so the results can be updated before submission:

| Category | Baseline | Final |
|---|---:|---:|
| Knowledge Retrieval | Not stored | TBD |
| Tool Calling | Not stored | TBD |
| Order Lookup | Not stored | TBD |
| Multi-Turn | Not stored | TBD |
| Privacy | Not stored | TBD |
| Prompt Injection | Not stored | TBD |
| Safe Abstention | Not stored | TBD |
| Source Conflict | Not stored | TBD |

The actual evaluation file contains scenario coverage for retrieval, conversation, tool use, privacy, prompt injection, and abstention, but the repository does not currently preserve the historical numeric scores.

The runner explicitly tracks quota issues: `runEvaluation.js` increments a `quota` counter when Gemini returns HTTP 429 and logs `Quota: ${quota}` in the summary. That behavior is visible in the code and also in the execution output of a sample evaluation run.

### Bug Diary

The project history and evaluation cases support the following reproduced issues.

### Bug 1 — Missing order ID

**Failure:**
The agent would sometimes be asked for an order status without the customer providing an order ID.

**Root Cause:**
The support logic needed to enforce the rule that an order lookup must only run with a valid order ID. The system instruction and the evaluation case explicitly require a missing ID to trigger a request for the ID rather than a guess.

**Fix:**
`order_lookup` was treated as a tool that requires a valid `order_id` and the agent instructions were tightened to ask for the order ID before any lookup.

**Regression Test:**
`missing-order-id` in `src/evaluation/evaluationCases.js`.

### Bug 2 — Cancelled order with stale ETA

**Failure:**
The mock order dataset contains stale carrier and estimated-delivery fields on cancelled orders, which could cause a naive answer to claim the shipment is still on track.

**Root Cause:**
The order data retains earlier `carrier` and `estimated_delivery` values after cancellation. The repository’s data dictionary explicitly states that when the order status is `cancelled` or `returned`, the agent must not tell the customer that it is still arriving based on stale fields.

**Fix:**
`src/tools/orderLookup.js` suppresses ETA output for orders whose status is `cancelled` or `returned` and returns only the safe status.

**Regression Test:**
`cancelled-order-stale-eta` in `src/evaluation/evaluationCases.js`.

### Bug 3 — Retrieved prompt injection

**Failure:**
A draft migration note contained a malicious instruction that tried to override policy and approve returns.

**Root Cause:**
The knowledge base contained internal, untrusted content in `14-internal-content-migration-notes.md`. That document is marked as `status: draft`, `audience: internal`, and `policy_authority: none`, which means it must not influence customer-facing answers.

**Fix:**
`retrievalPolicy.js` filters out non-authoritative and internal content, and the system prompt tells Gemini never to follow instructions embedded in retrieved documents. The evaluation case also expects the agent to reject the prompt-injection behavior.

**Regression Test:**
`retrieved-prompt-injection` in `src/evaluation/evaluationCases.js`.

### Bug 4 — Sensitive order data disclosure

**Failure:**
The order dataset includes email, shipping address, internal notes, and risk scores, which must not be exposed to the customer.

**Root Cause:**
The `orders.json` file contains internal and customer-sensitive fields. A naive or over-permissive tool could accidentally return them.

**Fix:**
`orderLookup.js` only returns a minimal safe subset, and `orders-data-dictionary.md` explicitly lists fields that must never be exposed. The agent system prompt also prohibits revealing internal notes, email, address, and risk information.

**Regression Test:**
`order-data-privacy` in `src/evaluation/evaluationCases.js`.

### AI Coding Tools

The project’s development history indicates GitHub Copilot was used as a coding assistant for documentation and implementation support. In this repository, it was useful for:

- boilerplate generation
- debugging and refactoring suggestions
- evaluation scaffolding
- README and project documentation assistance

One honest example of an incomplete or incorrect suggestion was a prototype approach that treated the `handoff` boolean as a substitute for correctness and relied too heavily on exact wording in evaluation assertions. The project’s actual evaluator is more conservative: it checks case-specific content requirements, source expectations, and safety constraints separately. This prevented false positives where the model could say the “right” thing in terms of handoff without truly satisfying the case requirements.

## Known Limitations

This implementation is intentionally limited and should not be treated as a production support system.

- The interface is CLI-only; there is no web app or UI layer.
- Conversation history is in memory only; it is not persisted across restarts.
- There is no production authentication or authorization layer for customer identity or order access.
- `order_lookup` is read-only and does not support cancellation, refund, replacement, or address-change actions.
- The agent recommends human assistance via a `handoff` flag, but it does not actually integrate with a live helpdesk or CRM.
- The system depends on a Gemini API key and is subject to API quota and rate-limit behavior.
- MongoDB connectivity is required at runtime and is not abstracted behind a local test setup.
- The repository includes a mock order dataset, not a real operational order backend.
- Retrieval quality and policy coverage depend on the knowledge-base documents and metadata quality.
- There is no production telemetry, monitoring, or automated continuous evaluation pipeline.
- The project is a classroom/internship assignment implementation, not a deployment-ready customer-support platform.

### Before Production

Before production use, the project would need improvements in several areas:

- customer authentication and authorization for order access
- real helpdesk or escalation integration
- stronger tool schemas and explicit validation for all operations
- more comprehensive evaluation beyond the current repository cases
- persistent conversation storage and session management
- monitoring, logging, and operational alerting
- rate limiting and retry/backoff around Gemini and MongoDB calls
- stronger security review of prompt, retrieval, and policy-handling behavior
- production deployment and environment separation

These are future improvements, not current features.

## Demo

### Demo Video

> Demo recording will be added before final submission.

The repository does not currently include a demo file. Intended locations for a short demonstration are:

```text
docs/demo.gif
docs/demo.mp4
```

GitHub may not play uploaded video inline in every context, so a GIF or a clickable thumbnail link can be used once the recording is added. Update the README to the final relative path when the demo file is placed in the repository.

