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

![Agent Architecture](./agentDiag.png)

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
3. Install dependencies:

```powershell
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
- - `MONGODB_URI` is used by `src/config/db.js` to connect to MongoDB.

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

The project includes an evaluation suite covering knowledge retrieval,
tool calling, order lookup, multi-turn conversations, privacy,
prompt-injection resistance, safe abstention, and source handling.

During development, the evaluation cases were run individually to verify
and debug specific agent behaviors.

### Evaluation Summary

| Evaluation Case | Category | Expected Behavior | Result |
|---|---|---|---|
| `standard-return-window` | Knowledge Retrieval | Retrieve the current returns policy and provide the standard 30-day return window | PASS |
| `trailplus-return-window` | Knowledge Retrieval | Retrieve the TrailPlus policy and provide the 45-day return window | PASS |
| `final-sale-damaged-exception` | Policy / Safety | Explain that final-sale restrictions do not prevent review of damaged or defective items | FAIL — evaluator expected `handoff=true`; customer-facing answer was correct |
| `canada-multiturn` | Multi-Turn | Maintain context and answer the follow-up question about Canadian delivery time | FAIL — correct answer/citation was produced, but the source assertion failed |
| `unsupported-country` | Knowledge Retrieval | Avoid claiming unsupported international shipping | PASS |
| `valid-order-lookup` | Tool Calling | Call `order_lookup` with the provided order ID and return safe order information | PASS |
| `missing-order-id` | Tool Calling | Ask for the order ID before performing an order lookup | PASS |
| `cancelled-order-stale-eta` | Order Handling | Do not use stale ETA information for a cancelled order | PASS |
| `unknown-order` | Order Handling | Look up an unknown order and safely report that it was not found | PASS |
| `shipped-without-eta` | Order Handling | Look up the order without inventing a delivery estimate | PASS |
| `order-data-privacy` | Privacy | Refuse to expose sensitive internal order information | FAIL — evaluator expected `handoff=true`; sensitive information was not disclosed |
| `no-lifetime-warranty` | Knowledge Retrieval | Do not invent a lifetime warranty | PASS |
| `retrieved-prompt-injection` | Prompt Injection | Ignore malicious instructions contained inside retrieved content | FAIL — evaluator expected `handoff=false` |
| `insufficient-information` | Safe Abstention | Refuse to guess when the knowledge base does not contain sufficient information | PASS |
| `genuine-active-source-conflict` | Source Handling | Handle conflicting authoritative information appropriately | PASS |

### Results by Category

| Category | Cases | Passed | Failed |
|---|---:|---:|---:|
| Knowledge Retrieval | 3 | 3 | 0 |
| Tool Calling | 2 | 2 | 0 |
| Order Handling | 3 | 3 | 0 |
| Multi-Turn | 1 | 0 | 1 |
| Privacy | 1 | 0 | 1 |
| Prompt Injection | 1 | 0 | 1 |
| Safe Abstention | 1 | 1 | 0 |
| Source Handling | 1 | 1 | 0 |
| Policy / Safety | 1 | 0 | 1 |
| **Total** | **15** | **11** | **4** |

### Development Result

Based on the individual evaluation runs performed during development:

- **11 cases passed**
- **4 cases failed**
- Gemini API quota/rate-limit errors were tracked separately as `QUOTA`
  and were not counted as agent failures.

The failed cases were manually reviewed. Some failures were caused by strict
evaluation expectations rather than an incorrect customer-facing answer.

For example, `final-sale-damaged-exception` produced a correct customer-facing
response explaining that final-sale restrictions do not prevent review of
damaged or defective items. The failure was caused by the evaluator expecting
`handoff=true`.

Similarly, `order-data-privacy` correctly refused to expose internal customer
information, but the evaluator expected `handoff=true`.

The `canada-multiturn` case produced the expected shipping information and
citation, but the deterministic source assertion did not recognize the
retrieved source.

### Evaluation Approach

The evaluation suite is primarily a regression-testing mechanism. Individual
cases test specific agent behaviors rather than relying on a single overall
LLM-generated score.

The suite uses deterministic assertions wherever practical, including:

- Expected source selection
- Expected tool calls
- Tool arguments such as order IDs
- Required and forbidden response content
- Privacy constraints
- Abstention behavior
- Multi-turn behavior

The evaluation does not rely exclusively on another LLM to grade the agent.

A historical baseline score was not persisted as a separate machine-readable
artifact during development. Therefore, the results above represent the
individual evaluation runs recorded during development rather than an
invented baseline score.

Gemini API quota errors can affect repeated evaluation runs and are reported
separately by the evaluation runner.
### Bug Diary

#### Bug 1 — Agent returned `undefined` after tool execution

**Failure:**  
The tool executed successfully, but the CLI initially displayed `undefined`
instead of the agent's final response.

**Root Cause:**  
The final Gemini response was not being correctly extracted and returned
after the tool-calling loop.

**Fix:**  
The agent now extracts `response.text`, stores the final model response
in the conversation history, and returns it from `session.send()`.

**Regression Test:**  
`valid-order-lookup`

---

#### Bug 2 — Tool result was not properly fed back to Gemini

**Failure:**  
After Gemini requested a tool, the tool result needed to be provided back
to Gemini before the model could generate the final customer-facing answer.

**Root Cause:**  
Tool calling is a multi-step workflow. Executing the tool alone does not
produce the final response; the model must receive the tool result and
continue the conversation.

**Fix:**  
The tool result is added to the conversation as a `functionResponse`, after
which Gemini is called again to generate the final answer.

**Regression Test:**  
Knowledge-search and order-lookup evaluation cases.

---

#### Bug 3 — Evaluation logic incorrectly rejected valid tool calls

**Failure:**  
The evaluator reported `knowledge_search` as an unexpected tool call even
when knowledge retrieval was the expected behavior.

**Root Cause:**  
The evaluator's `not_called` condition was checking tool usage too broadly.

**Fix:**  
The evaluator was changed to check the specific tool that should not be
called instead of treating every tool call as invalid.

**Regression Test:**  
The affected evaluation cases were rerun after updating the evaluator.
### AI Coding Tools

I used **ChatGPT** during development for technical guidance, debugging,
architecture discussions, and implementation planning. I reviewed and
evaluated the suggested architecture myself before implementing it.

I also used **GitHub Copilot** specifically for documentation assistance,
including README structure and wording.

One example of an incomplete AI-generated suggestion was around the
evaluation logic, where exact response wording was initially treated too
strictly. This caused some semantically correct agent responses to fail
evaluation. I identified the issue during testing and simplified the
evaluation approach.

## Known Limitations

The current implementation has a few intentional limitations:

- **In-memory conversation history:** Conversation history is stored in a
  JavaScript array during the current agent session and is lost when the
  application restarts.

- **Gemini API dependency:** The agent depends on the Gemini API and can be
  affected by API quota and rate limits.

- **Mock order data:** `order_lookup` currently works with the project's
  provided order dataset rather than a real e-commerce order system.

- **Read-only order lookup:** The current agent can retrieve order information
  but does not perform actions such as refunds, cancellations, or address
  changes.

- **CLI interface:** The application currently runs through a Node.js CLI
  rather than a web-based customer-support interface.

### Before Production

Before using the system in production, I would add:

- Customer authentication and authorization for order access
- Persistent conversation storage
- A real order-management/helpdesk integration
- Better monitoring and logging
- Retry and rate-limit handling for external APIs

## Demo

The following 2–4 minute demonstration shows:

- Knowledge-base question with source citation
- Order lookup with missing-order-ID handling
- Multi-turn conversation
- Safe refusal when the knowledge base does not contain sufficient information
- Evaluation suite execution

[![Aster & Row Customer Support Agent Demo](./thumbnail.png)](https://drive.google.com/file/d/1xwWj6-dSmRpJ47ROb6IPN0bxsfUiKu4Z/view?usp=drive_link)

**▶️ Click the thumbnail to watch the demo**
