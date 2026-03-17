# Building an ontology-aware AI agent application layer

**An Ontology-Aware AI Agent requires four tightly integrated systems: a graph-grounded reasoning backend, a streaming chat interface, interactive knowledge visualization, and entity-linked provenance.** This framework synthesizes research across 8 technical domains into a production-ready architecture for React 18 + TypeScript frontend and Python + FastAPI backend, sitting atop an existing Open Ontology infrastructure. The core design principle — borrowed from Palantir's Ontology-Augmented Generation pattern — treats the ontology as the single source of truth for all AI-generated claims, making every response traceable, verifiable, and trustworthy for domain experts.

---

## 1. System architecture and data flow

The architecture follows a three-tier model: a React chat+visualization client, a FastAPI orchestration layer, and the existing Ontology Manager as the knowledge backbone. The critical insight from surveying products like Stardog Voicebox and Neo4j GraphRAG is that **hybrid retrieval** (combining structured graph traversal with vector similarity search) consistently outperforms either approach alone — Data.world benchmarks show **3× accuracy improvement** over vector-only RAG.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        REACT 18 + TYPESCRIPT                        │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────┐ │
│  │  Chat Panel   │  │  Graph Canvas     │  │  Entity Detail Panel  │ │
│  │  (assistant-ui)│  │  (Sigma.js/WebGL) │  │  (shadcn/ui Sheet)   │ │
│  │  + AI SDK     │  │  + Graphology     │  │  HoverCard / Sheet   │ │
│  └──────┬───────┘  └────────┬─────────┘  └──────────┬────────────┘ │
│         │   Zustand (shared entity highlight state)  │              │
│         └──────────────────┬─────────────────────────┘              │
│                            │ SSE (Data Stream Protocol)             │
├────────────────────────────┼────────────────────────────────────────┤
│                    FASTAPI + LANGGRAPH                               │
│  ┌─────────────────────────┴──────────────────────────────────────┐ │
│  │              LangGraph Agent (Stateful Graph)                   │ │
│  │  ┌──────────┐ ┌──────────────┐ ┌────────────┐ ┌─────────────┐ │ │
│  │  │ Query    │ │ SPARQL       │ │ Entity     │ │ Schema      │ │ │
│  │  │ Classify │ │ Generator    │ │ Lookup     │ │ Introspect  │ │ │
│  │  └──────────┘ └──────────────┘ └────────────┘ └─────────────┘ │ │
│  │  ┌──────────┐ ┌──────────────┐ ┌──────────────────────────────┐│ │
│  │  │ Graph    │ │ Vector       │ │ Response Synthesizer          ││ │
│  │  │ Traverse │ │ Search       │ │ (Instructor + Pydantic)       ││ │
│  │  └──────────┘ └──────────────┘ └──────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────-┤
│                    ONTOLOGY MANAGER (EXISTING)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐│
│  │ SPARQL/Query │  │ Entity API   │  │ Schema/Ontology Definitions ││
│  │ Endpoint     │  │ (CRUD)       │  │ (Classes, Properties, Rels) ││
│  └──────────────┘  └──────────────┘  └────────────────────────────┘│
└────────────────────────────────────────────────────────────────────-┘
```

**Data flow for a typical query** proceeds as follows: the user types a natural language question in the chat panel. The React frontend streams it via POST to the FastAPI `/api/chat` endpoint. LangGraph's stateful agent classifies the query type (entity lookup, relationship exploration, aggregation, or general question), routes to the appropriate tool nodes, executes SPARQL queries or graph traversals against the Ontology Manager, assembles context, and streams back an annotated response via SSE. The response contains interleaved text deltas and structured entity data parts, which the frontend renders as rich text with clickable entity mentions, optional inline graph visualizations, and expandable evidence sections.

---

## 2. Backend agent framework with LangGraph

**LangGraph is the recommended orchestration layer**, used in production at LinkedIn, Uber, and 400+ companies. It models the agent as a directed graph where nodes are Python functions (reasoning steps, tool calls) and edges carry conditional routing logic. For ontology reasoning, this architecture excels because it supports stateful multi-turn exploration ("Tell me about X" → "What relates to X?" → "Compare X and Y") with persistent state across turns.

The agent state captures conversation history, ontology context, query results, and extracted entities:

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional

class OntologyAgentState(TypedDict):
    messages: list                    # Conversation history
    ontology_context: str             # Cached schema context
    query_results: list               # Raw query results
    referenced_entities: list         # Entities found in current turn
    reasoning_steps: list[str]        # Explainable reasoning chain
    subgraph: Optional[dict]          # Extracted subgraph for visualization
```

Five core agent tools interface with the Ontology Manager. The **SPARQL generation tool** injects the ontology schema (serialized as Turtle) into the LLM prompt and generates constrained queries — following Ontotext's proven pattern of restricting queries to schema-defined classes and properties with automatic retry on malformed SPARQL. The **entity lookup tool** resolves entities by ID or label, returning properties, relationships, and hierarchy position. The **graph traversal tool** navigates relationships (subclasses, instances, incoming/outgoing links). The **schema introspection tool** lets the agent dynamically discover available classes, properties, and constraints. The **hybrid search tool** combines SPARQL for structured queries with vector embeddings for fuzzy semantic matching.

**PydanticAI deserves serious consideration** as an alternative to LangGraph, particularly given the FastAPI backend. Built by the Pydantic team, it offers native type-safe dependency injection (ideal for injecting OntologyManager dependencies), structured output as a first-class feature via `output_type`, and graph support. The choice between LangGraph and PydanticAI should depend on team familiarity and complexity requirements — LangGraph offers more mature orchestration features (human-in-the-loop, durable execution, checkpointing), while PydanticAI offers simpler, more Pythonic patterns that align naturally with FastAPI conventions.

### Conditional routing for query classification

The agent's entry node classifies incoming queries and routes them to appropriate strategies:

```python
def route_query(state: OntologyAgentState) -> str:
    """Route to appropriate tool based on query analysis."""
    last_msg = state["messages"][-1]
    # LLM-based classification into query types:
    # - "sparql" for structured queries ("How many X are related to Y?")
    # - "entity_lookup" for direct lookups ("Tell me about Entity X")
    # - "traversal" for relationship exploration ("What connects A to B?")
    # - "hybrid" for complex questions requiring both approaches
    return classify_query(last_msg)

graph = StateGraph(OntologyAgentState)
graph.add_node("classify", route_query)
graph.add_node("sparql_node", execute_sparql_query)
graph.add_node("entity_lookup_node", lookup_entity)
graph.add_node("traversal_node", traverse_relationships)
graph.add_node("hybrid_node", hybrid_search)
graph.add_node("synthesize", generate_annotated_response)
graph.add_conditional_edges("classify", route_query)
# All query nodes feed into synthesis
for node in ["sparql_node", "entity_lookup_node", "traversal_node", "hybrid_node"]:
    graph.add_edge(node, "synthesize")
```

---

## 3. Structured output with entity annotations

Making the LLM produce responses that annotate referenced ontology entities is the linchpin connecting natural language output to the knowledge graph. Research reveals four viable patterns, with **inline structured output** being the recommended approach.

The core Pydantic model defines a response that includes both natural language text and entity references:

```python
from pydantic import BaseModel, Field
from enum import Enum

class EntityType(str, Enum):
    CLASS = "class"
    PROPERTY = "property"
    INSTANCE = "instance"
    RELATIONSHIP = "relationship"

class EntityReference(BaseModel):
    entity_id: str = Field(description="Unique URI/ID in the ontology")
    entity_label: str = Field(description="Human-readable label")
    entity_type: EntityType
    confidence: float = Field(ge=0, le=1)
    span_start: int | None = Field(None, description="Character offset in answer text")
    span_end: int | None = Field(None, description="Character offset in answer text")

class OntologyAgentResponse(BaseModel):
    answer_text: str = Field(description="Complete natural language answer")
    referenced_entities: list[EntityReference]
    evidence_subgraph: dict | None = Field(None, description="Nodes/edges used")
    sparql_queries_used: list[str] = Field(default_factory=list)
    reasoning_steps: list[str]
    confidence: float = Field(ge=0, le=1)
```

The **Instructor library** (11k+ GitHub stars, 3M+ monthly downloads) provides the most reliable mechanism for extracting structured output. It wraps any LLM provider, applies Pydantic validation, and automatically retries on validation failures. OpenAI's native Structured Outputs with `strict: true` achieves **100% schema compliance** on complex JSON schemas, compared to under 40% without it. For production use, the recommended pattern is a **two-pass approach**: the first pass generates the answer using agent tools (SPARQL, graph traversal), and the second pass annotates the answer with validated entity references using Instructor.

An alternative **inline marker pattern** instructs the LLM to embed entity tags directly in text — `[[onto:Class42|Protein|class]]` — which a regex parser extracts into structured EntityReference objects. This pattern is simpler to implement but slightly less reliable than dedicated structured output. Post-generation, all entity IDs must be validated against the ontology to catch hallucinated references — following OntoGPT's SPIRES methodology of grounding extracted terms via string similarity against known ontology terms.

---

## 4. Frontend chat UI with assistant-ui and Vercel AI SDK

**assistant-ui is the recommended chat UI library** — it is the most popular dedicated AI chat component library for React, YC-backed, used by LangChain and Stack AI, and officially recommended by the LangGraph team. Built on shadcn/ui and Radix UI primitives, it provides composable, accessible components with WAI-ARIA compliance — critical for non-technical domain experts.

The architecture pairs assistant-ui's visual components with Vercel AI SDK's streaming infrastructure:

```typescript
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";

export default function OntologyChat() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({ api: "/api/chat" }),
  });
  
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={35}>
          <Thread />  {/* Chat panel */}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={40}>
          <GraphCanvas />  {/* Knowledge graph */}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={25}>
          <EntityDetailPanel />  {/* Entity cards */}
        </ResizablePanel>
      </ResizablePanelGroup>
    </AssistantRuntimeProvider>
  );
}
```

Vercel AI SDK's **parts-based message rendering** is the key to embedding entity annotations within chat messages. Each message contains a `parts` array with typed entries — `text`, `tool-invocation`, and custom `data-*` parts. Custom `data-entity` parts carry structured entity annotation data streamed from the backend, enabling real-time entity highlighting as text arrives. The SDK's **Data Parts** feature streams arbitrary typed structured data from server to client, which is exactly what's needed for interleaving text tokens with entity metadata.

For **state management**, Zustand (lightweight, hook-based) manages cross-component state like the currently hovered entity, selected entity, and visible subgraph — state that must be shared between the chat panel, graph canvas, and entity detail panel. AI SDK v5+ supports decoupled state that integrates with external stores, so Zustand handles the app-wide coordination while `useChat` handles message-specific state.

Key UI patterns for non-technical domain experts include suggested action buttons below messages (pre-formulated ontology queries), typing indicators with skeleton screens during streaming, progressive disclosure of entity details (inline mention → hover preview → click-to-expand), and friendly error states with retry buttons rather than technical error messages.

---

## 5. Streaming architecture with SSE

**Server-Sent Events over WebSocket** is the recommended streaming approach. LLM chat is fundamentally a request→streaming-response pattern, and SSE is simpler, auto-reconnects, works through all proxies and CDNs, and is the protocol used by OpenAI, Anthropic, and the Vercel AI SDK. FastAPI 0.135.0+ includes native SSE support via `EventSourceResponse`.

The critical design challenge is **streaming both text tokens and structured entity data in a single response**. The solution uses the Vercel AI SDK's Data Stream Protocol, which interleaves text deltas with custom data events:

```python
from fastapi import FastAPI
from starlette.responses import StreamingResponse
import json, uuid

@app.post("/api/chat")
async def chat_stream(request: ChatRequest):
    async def generate():
        msg_id = str(uuid.uuid4())
        text_id = str(uuid.uuid4())
        
        yield sse({"type": "start", "messageId": msg_id})
        yield sse({"type": "text-start", "id": text_id})
        
        full_text = ""
        async for token in agent.astream(request.messages):
            full_text += token
            yield sse({"type": "text-delta", "id": text_id, "delta": token})
        
        yield sse({"type": "text-end", "id": text_id})
        
        # Stream entity annotations after text completes
        entities = await extract_and_validate_entities(full_text)
        for entity in entities:
            yield sse({"type": "data-entity", "data": entity.dict()})
        
        # Stream evidence subgraph
        subgraph = await extract_evidence_subgraph(entities)
        yield sse({"type": "data-subgraph", "data": subgraph})
        
        yield sse({"type": "finish", "messageId": msg_id})
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "x-vercel-ai-ui-message-stream": "v1",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )

def sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"
```

On the React side, the AI SDK's `useChat` hook automatically parses these events. Custom `data-entity` and `data-subgraph` parts arrive as typed message parts that custom renderers transform into clickable entity mentions and inline graph visualizations. For production, heartbeat pings every 10 seconds keep connections alive through proxies, and client disconnect detection saves compute resources by stopping generation when users navigate away.

---

## 6. Knowledge graph visualization embedded in chat

The research compared seven graph visualization libraries across React integration quality, performance, interactivity, layout algorithms, and ontology fitness. The recommendation is a **dual-library approach**: **Sigma.js** (`@react-sigma/core`) for the main interactive graph canvas, and optionally **React Flow** for small inline mini-graphs within chat bubbles.

**Sigma.js excels for this use case** because its WebGL rendering handles hundreds to thousands of nodes smoothly, the Graphology data model maps naturally to knowledge graphs (typed nodes, typed edges, properties), and the `@react-sigma/core` package provides idiomatic React hooks. Cytoscape.js is the strongest alternative if the application needs advanced graph algorithms (community detection, shortest paths, centrality measures) — it offers **10+ built-in layout algorithms** and can run headless for layout calculation, piping results to Sigma for rendering.

**Embedding graphs within chat messages** follows a constrained interaction model:

```
┌──────────────────────────────────────┐
│ AI Response Bubble                    │
│ "Here's the relationship between      │
│  [Entity A] and [Entity B]:"         │
│                                       │
│ ┌──────────────────────────────────┐ │
│ │  Mini-Graph (360×220px)          │ │
│ │  Force-directed, 5-15 nodes      │ │
│ │  Read-only, click nodes for      │ │
│ │  entity details       [Expand ↗] │ │
│ └──────────────────────────────────┘ │
│                                       │
│ Based on [E1] Compound X and its     │
│ relationship to [E2] Target Y...     │
└──────────────────────────────────────┘
```

Mini-graphs inside chat bubbles are constrained to **360×220 pixels**, read-only (no drag/zoom), with single-click opening entity cards. An "Expand" button opens the full graph canvas with the relevant subgraph pre-loaded. Subgraph extraction uses **entity-centric ego networks**: BFS from mentioned entities to 1-2 hop neighbors, merged into a single subgraph with force-directed layout.

**Bidirectional entity highlighting** — the hallmark feature connecting text to graph — works through shared Zustand state. Hovering an entity mention in chat text dispatches a `hoveredEntityId` to the store; the graph canvas listens and applies a glow/size-increase effect to the matching node. Conversely, hovering a graph node highlights the corresponding text spans with a background color. This creates an intuitive visual link between narrative and structure that domain experts can explore naturally.

```typescript
// Shared state for bidirectional highlighting
interface EntityHighlightState {
  hoveredEntityId: string | null;
  selectedEntityId: string | null;
  visibleSubgraphNodeIds: Set<string>;
  setHovered: (id: string | null) => void;
  setSelected: (id: string | null) => void;
}

const useEntityHighlightStore = create<EntityHighlightState>((set) => ({
  hoveredEntityId: null,
  selectedEntityId: null,
  visibleSubgraphNodeIds: new Set(),
  setHovered: (id) => set({ hoveredEntityId: id }),
  setSelected: (id) => set({ selectedEntityId: id }),
}));
```

---

## 7. Entity cards with three-tier progressive disclosure

Entity detail panels follow a three-tier interaction model inspired by Google Knowledge Panels and Wikipedia hovercards, adapted for ontology objects:

**Tier 1 — Hover preview** (200–300ms delay): A shadcn/ui `HoverCard` showing entity name, type badge, one-line description, and a small thumbnail. Sized at **280–320px wide**, it answers "Is this the entity I'm thinking of?" without interrupting reading flow. The 200ms delay prevents accidental triggers while keeping exploration fluid — Wikipedia's research found this delay optimal for reducing unintended activations.

**Tier 2 — Click-to-expand side panel**: A shadcn/ui `Sheet` sliding from the right at **400–480px wide**, containing the full entity card: name, type badge, description, structured properties (key-value pairs), incoming and outgoing relationships (grouped by predicate type), and provenance metadata. Relationships are themselves clickable, enabling **entity-to-entity navigation** via a stack-based pattern with breadcrumb trail.

**Tier 3 — Full entity view**: A full-screen dialog or dedicated route for complete entity exploration including edit capabilities, full relationship graph, history/audit trail, and cross-references.

The entity card component uses a **compound component pattern** for maximum composability:

```tsx
<EntityCard entityId={selectedEntityId}>
  <EntityCard.Header>
    <EntityCard.TypeBadge />     {/* "Person", "Organization", "Compound" */}
    <EntityCard.Name />
    <EntityCard.Actions />       {/* Pin, Share, Copy ID */}
  </EntityCard.Header>
  <EntityCard.Description />
  <EntityCard.Properties>
    <EntityCard.Property label="Created" value="2024-03-15" />
    <EntityCard.Property label="Status" value="Active" />
  </EntityCard.Properties>
  <EntityCard.Relationships>
    <EntityCard.RelationshipGroup label="Reports to" direction="outgoing">
      <EntityCard.RelatedEntity entityId="..." onClick={navigateToEntity} />
    </EntityCard.RelationshipGroup>
  </EntityCard.Relationships>
  <EntityCard.Provenance />
</EntityCard>
```

**shadcn/ui is the recommended component foundation** — its copy-paste model gives full styling control, Tailwind CSS integration keeps design consistent, and Radix UI primitives underneath handle focus management, keyboard navigation, and screen reader support automatically. The specific components needed are `HoverCard`, `Sheet`, `Dialog`, `Card`, `Badge`, `Tabs`, `ScrollArea`, and `Resizable` (via react-resizable-panels).

---

## 8. Provenance and citation patterns for trustworthy AI

Trust is the make-or-break feature for domain expert adoption. Research across Perplexity AI, ChatGPT, and academic studies reveals that **the mere presence of citations creates trust** — but for domain experts working with ontology data, citations must link to ontology objects rather than web URLs. This represents a novel adaptation of established citation patterns.

The recommended **entity-linked citation system** uses distinct markers for different provenance types:

- `[E1]` links to a specific ontology entity (a node in the knowledge graph)
- `[R1]` links to a specific relationship (an edge between two entities)
- `[I1]` marks inferred knowledge derived through multi-hop reasoning

Each marker is rendered as a clickable superscript that, on hover, shows entity type, key properties, and last-updated timestamp. On click, it opens the Tier 2 entity card. This follows Perplexity's proven pattern of inline footnote numbers with hover-to-preview — adapted from web sources to ontology objects.

**"Show Evidence" expandable sections** beneath AI claims reveal the subgraph that grounded each statement. These sections contain a compact graph visualization (5–10 nodes) showing the entities and relationships the agent traversed. Color-coded confidence badges distinguish three tiers: **green** for claims directly supported by ontology data (direct entity property lookup), **yellow** for claims inferred through multi-hop reasoning (traversing multiple relationships), and **red/orange** for low-confidence or uncertain claims requiring domain expert verification.

Additional trust signals for non-technical users include **data freshness indicators** ("Based on data updated 3 hours ago"), **reasoning type labels** ("Direct lookup" vs. "Multi-hop inference" vs. "Aggregated"), and an **audit trail button** that reveals the full provenance chain: User Query → Identified Entities → SPARQL Query → Retrieved Subgraph → Generated Claim. This pattern draws from both Microsoft GraphRAG's TextUnit provenance (tracing LLM statements to source text) and Palantir's end-to-end observability with fine-grained logging for every AI action.

---

## 9. Lessons from similar products and open-source projects

Eight products and multiple open-source projects were surveyed. The most instructive models are:

**Palantir AIP** is the closest architectural analog. Its core principle — the ontology as central data model mapping raw data to real-world entities with typed relationships — mirrors the Open Ontology infrastructure. Palantir coined "Ontology-Augmented Generation" (OAG) to distinguish their approach from generic RAG: rather than chunking documents into vectors, OAG assembles ontology subgraphs as structured context for LLM prompts. Their **Actions as control plane** pattern, where AI agents propose changes for human review, is essential for enterprise trust. Their integrated evaluation framework (AIP Evals) for testing agents across LLMs should be replicated.

**Neo4j GraphRAG** provides the most mature open-source foundation for graph-based retrieval. Their `neo4j-graphrag-python` package implements the full pipeline: document parsing, entity extraction, knowledge graph construction, and hybrid retrieval (graph traversal + vector search + full-text search). The key pattern is **vector similarity as entry point → graph traversal for context enrichment → subgraph assembly → LLM generation**.

**Microsoft GraphRAG** contributes the concept of hierarchical community detection and dual query modes (global search using community summaries for holistic questions, local search from specific entities for detailed questions). This maps well to domain expert workflows: "Give me an overview of this domain" (global) vs. "What specifically connects Entity A to Entity B?" (local).

**Stardog's Voicebox** demonstrates the NL→concept mapping→KG query→grounded answer pipeline with claims of "hallucination-free" responses through strict KG grounding. Their use of **fine-tuned open-source models** rather than off-the-shelf LLMs (trained with Databricks Mosaic AI) suggests that domain-specific fine-tuning significantly improves ontology query accuracy.

**Diffbot's approach** — a small reasoning model backed by a massive knowledge graph — validates the architecture of separating reasoning from knowledge. Their fine-tuned Llama 3.3 model queries the KG at inference time, achieving **81% on FreshQA** (beating ChatGPT and Gemini), with every factual statement matched to a supporting source passage.

Among open-source projects, **Graphiti** (by Zep) stands out for its prescribed+learned ontology model where entity and edge types are defined via Pydantic models, combined with incremental graph construction and temporal tracking — directly applicable to evolving domain ontologies.

---

## 10. Recommended technology stack and implementation phases

### Complete technology stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Agent Orchestration** | LangGraph ≥0.2.x | Stateful multi-turn reasoning, conditional routing, human-in-the-loop |
| **LLM Integration** | LangChain Core ≥0.3.x | OntotextGraphDBGraph, GraphCypherQAChain, model adapters |
| **Structured Output** | Instructor ≥1.x + Pydantic ≥2.8 | Validated entity-annotated responses with retry logic |
| **Web Framework** | FastAPI ≥0.135 | Native SSE, Pydantic integration, async support |
| **Chat UI** | assistant-ui + AI SDK 5/6 | Composable chat components, streaming, accessibility |
| **Graph Visualization** | Sigma.js 3.x + @react-sigma/core 4.x + Graphology | WebGL performance, knowledge graph data model |
| **UI Components** | shadcn/ui (Radix UI + Tailwind) | Entity cards, panels, popovers, accessible primitives |
| **State Management** | Zustand 5.x | Cross-component entity highlight state |
| **Layout** | react-resizable-panels | Three-panel responsive layout |

### Four-phase implementation roadmap

**Phase 1 — Foundation (Weeks 1–3)**: Stand up the FastAPI streaming endpoint with LangGraph agent skeleton. Implement two core tools (entity lookup and SPARQL generation). Build the basic chat UI with assistant-ui and SSE streaming. Define the Pydantic response models with entity annotations.

**Phase 2 — Entity intelligence (Weeks 4–6)**: Implement structured output with Instructor for entity-annotated responses. Build the three-tier entity card system (HoverCard, Sheet, Dialog). Add entity mention detection in chat text with clickable highlights. Wire up bidirectional highlighting via Zustand.

**Phase 3 — Graph visualization (Weeks 7–9)**: Integrate Sigma.js graph canvas with Graphology data model. Implement subgraph extraction (ego networks from mentioned entities). Build inline mini-graph components for chat messages. Add the resizable three-panel layout.

**Phase 4 — Trust and polish (Weeks 10–12)**: Implement entity-linked citation system ([E1], [R1] markers). Build "Show Evidence" expandable sections with mini-graph evidence viewers. Add confidence badges, data freshness indicators, and audit trail. Implement suggested actions, error handling, and mobile responsiveness.

---

## Conclusion

The most important architectural decision in this framework is **not** which agent framework or visualization library to choose — it is the commitment to treating the ontology as the authoritative source for all AI-generated claims. Every other decision flows from this principle. LangGraph provides the stateful reasoning engine to query the ontology across multiple turns. Instructor and Pydantic enforce structured output that maps natural language to ontology entities. Sigma.js renders those entities as interactive, explorable graphs. The entity-linked citation system makes every claim verifiable.

The key novel insight from this research is the **Ontology-Augmented Generation** pattern (distinct from generic RAG): rather than treating the knowledge graph as just another retrieval source, the ontology's schema, class hierarchy, and relationship types should actively constrain and structure the agent's reasoning. The agent should not just *search* the ontology — it should *think in terms of* the ontology. This means injecting ontology schema into system prompts, constraining SPARQL generation to known predicates, validating entity references post-generation, and using the ontology's own structure to determine what information to display in entity cards and graph visualizations.

For non-technical domain experts, the system's success ultimately depends on two things: **can they trust the answers?** (solved by provenance, citations, and confidence indicators) and **can they explore further?** (solved by entity cards, graph visualization, and bidirectional highlighting). Build for trust first, exploration second, and the conversational interface becomes the natural language gateway to structured knowledge that domain experts have always needed.