# lore-graph

> A narrative exploration game where the world reveals itself through rumor, contradiction, and knowledge.

---

## Overview

**lore-graph** is an experimental narrative game set in a tavern. Players gather fragments of information by talking to NPCs — but no single conversation tells the full truth. Rumors are partial, sometimes contradictory, and always incomplete. As conversations accumulate, a knowledge graph emerges, and the world's lore slowly surfaces from the noise.

The core challenge: piecing together a coherent picture of a world that refuses to explain itself.

---

## Core Concepts

### Fragmented Knowledge
No NPC has the full picture. Each conversation yields a shard of information — a name, a rumor, a half-remembered event. Players must collect and connect fragments over time.

### Rumors vs. Facts
NPCs speak from belief, not truth. What they say is generated from a structured world model, but filtered through the lens of their character and knowledge. The **source of truth is the graph** — not the dialogue.

### Knowledge Graph
All extracted information is stored as a graph of entities and relationships. The graph evolves as new information arrives, and contradictions are tracked explicitly rather than resolved silently.

### NPC-Driven Exploration
NPCs don't deliver exposition — they reflect the world as they understand it. Talking to the right people (or the same person twice) can unlock new nodes in the graph and surface hidden connections.

---

## Architecture

```
┌─────────────────────────────────────────┐
│              Game Client                │  Player interface, dialogue UI
├─────────────────────────────────────────┤
│              NPC Mind                   │  Character behavior, belief state
├─────────────────────────────────────────┤
│              Lore Engine                │  Extraction, contradiction handling,
│                                         │  world model management
├─────────────────────────────────────────┤
│   LLM Adapter (OpenAI / Ollama)         │  Language generation and parsing
├─────────────────────────────────────────┤
│              Graph DB (Neo4j)           │  Persistent knowledge graph
└─────────────────────────────────────────┘
```

- **LLM Layer** — Handles dialogue generation and structured information extraction via OpenAI API or local Ollama models.
- **Lore Engine** — The core of the system. Receives extracted entities/relations, manages the world model, detects contradictions, and exposes query interfaces.
- **Graph DB** — Stores the canonical world state as a property graph. Nodes are entities (people, places, events); edges are relationships.
- **Game Client** — The player-facing interface. Renders conversations, surfaces discovered knowledge, and manages game flow.

---

## Monorepo Structure

```
lore-graph/
├── apps/
│   ├── game-client/       # Frontend game interface
│   └── backend/           # API server, orchestration layer
│
└── packages/
    ├── llm-adapter/       # Unified interface for OpenAI and Ollama
    ├── lore-engine/       # World model, extraction, contradiction logic
    ├── graph-db/          # Graph DB client and schema definitions
    └── npc-mind/          # NPC character state, memory, belief modeling
```

| Package | Responsibility |
|---|---|
| `llm-adapter` | Abstracts LLM providers; handles prompt templates and structured output parsing |
| `lore-engine` | Core world model logic; ingests facts, tracks contradictions, answers queries |
| `graph-db` | Neo4j client wrapper, schema, and migration utilities |
| `npc-mind` | Per-NPC belief state, knowledge scope, and dialogue personality |
| `game-client` | Player UI, conversation rendering, knowledge map visualization |
| `backend` | REST/WebSocket API, session management, event routing |

---

## Getting Started

> Setup instructions coming soon. The project is in early development.

```bash
# Clone the repo
git clone https://github.com/your-org/lore-graph.git
cd lore-graph

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Set OPENAI_API_KEY or OLLAMA_BASE_URL

# Start development
bun run dev
```

Prerequisites: Node.js 20+, Bun, Neo4j (local or cloud), and either an OpenAI API key or a running Ollama instance.

---

## Future Ideas

- **NPC Memory** — NPCs remember past conversations and update their beliefs accordingly.
- **Contradiction Resolution** — Players can actively confront NPCs with conflicting information and observe how they respond.
- **Belief Drift** — World model updates propagate back to NPCs, shifting what they believe over time.
- **Lore Archaeology** — Surfacing buried or forgotten facts as the graph grows dense enough to infer them.
- **Multi-session Persistence** — The knowledge graph persists across play sessions, rewarding long-term exploration.

---

## Philosophy

The world exists independently of what NPCs say about it. Dialogue is generated *from* the world model, not the other way around. This separation means the game can be genuinely surprising — not because it's random, but because the truth was always there, waiting to be assembled.

---

*Built with OpenAI / Ollama · Neo4j · ClaudeCode*
