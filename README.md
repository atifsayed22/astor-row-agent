# Aster & Row Customer Support Agent

An AI-powered customer support agent for Aster & Row that answers customer questions using a grounded knowledge base and performs order lookups through MongoDB.

The agent uses Gemini for reasoning and tool selection. It can search company knowledge for policies and product information, look up customer orders, maintain multi-turn conversation context, and avoid inventing information when the available data is insufficient.

---

## Features

- Knowledge-base question answering
- Retrieval-grounded responses for Aster & Row policies and product information
- Order lookup through MongoDB
- Gemini function/tool calling
- Multi-turn conversation sessions
- Prompt-injection resistance for retrieved documents
- Source attribution for knowledge-base answers
- Protection of internal order information
- Abstention when available information is insufficient
- Evaluation suite covering retrieval, tool use, privacy, security, and reliability

---

## Architecture

The application uses a tool-calling agent architecture.

```mermaid
flowchart TD
    A[Customer] --> B[CLI]
    B --> C[Agent Session]

    C --> D[Gemini LLM]

    D -->|Knowledge question| E[knowledge_search]
    D -->|Order question| F[order_lookup]

    E --> G[Knowledge Base]
    G --> H[Retrieval and Filtering]

    F --> I[MongoDB]

    H --> D
    I --> D

    D --> J[Final Customer Response]
    J --> B
    B --> A