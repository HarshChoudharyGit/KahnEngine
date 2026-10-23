# ⚡ Kahn Engine

> **Deterministic, High-Throughput Visual Workflow Orchestrator & Distributed Execution Engine**  
> *Built for Webster 2026 by Team `<SYNTAXRUSH>` (Team ID: 233)*

---

[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-High--Performance-000000?style=flat&logo=fastify&logoColor=white)](https://fastify.dev/)
[![React Flow](https://img.shields.io/badge/@xyflow/react-Canvas%20UI-FF0072?style=flat)](https://reactflow.dev/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Redis%20Queue-CC3534?style=flat&logo=redis&logoColor=white)](https://bullmq.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma%20ORM-336791?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-Pub%2FSub%20%26%20Heartbeats-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)
[![SSE](https://img.shields.io/badge/Telemetry-Server--Sent%20Events-00ADD8?style=flat)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

---

## 👥 Team Information — `<SYNTAXRUSH>`
- **Team ID**: `233`
- **Competition**: Webster 2026
- **Members**:
  - **Harsh Choudhary** — `20244071` | ECE | Discord: `syntaxbuilder2006_76484`
  - **Mohit Bagri** — `20244107` | ECE | Discord: `james107f`
  - **Shiwansh Dwivedi** — `20244152` | ECE | Discord: `shero0123`

---

## 📌 Executive Summary & Problem Statement

In modern cloud infrastructures and microservice automation, engineering teams frequently rely on multi-step computational pipelines that depend on external systems, APIs, and scheduled events. Executing these workflows using hardcoded scripts, nested cron daemons, or ad-hoc background jobs introduces severe operational risks:

1. **Repetitive Computational Loops ("Temporal Loops")**: Developers are trapped in brittle, manual execution and debugging loops for routine pipeline tasks and asynchronous runs.
2. **Lack of Visual & Deterministic Orchestration**: Hardcoded scripts obscure task dependencies and dynamic branching, making it nearly impossible to detect circular execution cycles ($O(\infty)$ loops) prior to production deployment.
3. **Brittle Failure Handling & Thundering Herds**: Unhandled network timeouts, downstream rate-limiting, and lack of exponential backoff retry policies cause cascading pipeline halts without automatic recovery or state preservation.
4. **Zero Visibility & Telemetry Blindness**: Standard background workers provide no live per-node execution telemetry, leaving engineers blind to stalled, queued, or failing nodes in active runs.

### 💡 The Solution: Kahn Engine
**Kahn Engine** is an event-driven, distributed workflow orchestration platform. It pairs a **visual drag-and-drop canvas (React Flow)** with an **in-memory DAG cycle detector (Kahn’s Algorithm)**, an ultra-fast **Fastify API gateway (<10ms acknowledgment)**, and a **decoupled BullMQ/Redis worker cluster**. Real-time execution logs and per-node statuses are pushed unidirectionally to client browsers via **Server-Sent Events (SSE)**, completely eliminating database poll thrashing.

---

## 🏗️ Architecture & System Design

### End-to-End Ingestion & Execution Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer / UI
    participant Client as React Flow Canvas
    participant Gateway as Fastify API Gateway
    participant DB as PostgreSQL (Prisma)
    participant Queue as Redis (BullMQ Queue)
    participant Worker as Distributed Worker
    participant SSE as SSE Streamer (Redis Pub/Sub)

    Dev->>Client: Construct Workflow & Trigger Connections
    Client->>Client: In-Memory Cycle Detection (Kahn's Algorithm)
    Client->>Gateway: POST /api/v1/workflows (Save DAG)
    Gateway->>DB: Persist Workflow Schema (JSONB Nodes & Edges)
    
    rect rgb(240, 248, 255)
    Note over Gateway,Queue: Ingestion Phase (<10ms)
    alt Webhook or Cron Trigger
        Gateway->>Gateway: Validate Ingestion Payload
        Gateway->>Queue: Push Job (execution_id, status: PENDING)
        Gateway-->>Client: 202 Accepted (execution_id)
    end
    end

    rect rgb(255, 250, 240)
    Note over Queue,Worker: Decoupled Execution & Telemetry
    Queue->>Worker: Pop Job from Queue
    Worker->>Worker: Compute Topological Order (DAG Sort)
    loop Node Execution Loop
        Worker->>Worker: Execute Node (HTTP / Transform / Delay)
        Worker->>SSE: Emit Event (RUNNING / SUCCESS / FAILED)
        SSE-->>Client: Live SSE Broadcast (Logs & Status)
        opt Node Failure
            Worker->>Worker: Exponential Backoff Retry + Jitter
            alt Retries Exhausted
                Worker->>Queue: Route to Dead-Letter Queue (DLQ)
            end
        end
    end
    Worker->>DB: Commit Full Run History & Timestamps (SUCCESS / FAILED)
    end
```

---

## 🧩 System Class & Module Architecture

```mermaid
classDiagram
    class WorkflowSchema {
        +String id
        +String name
        +List~NodeDef~ nodes
        +List~EdgeDef~ edges
    }

    class NodeDef {
        <<Abstract>>
        +String id
        +String type
        +Point position
        +execute(context) Promise~Result~
    }

    class WebhookTriggerNode {
        +String webhookUrl
    }
    class CronTriggerNode {
        +String cronExpression
        +Map payload
    }
    class TransformNode {
        +String script
        +Map mapping
    }
    class HttpRequestNode {
        +String method
        +String url
        +Map headers
        +Map body
        +RetryPolicy retryPolicy
    }
    class DelayNode {
        +Number duration
    }

    NodeDef <|-- WebhookTriggerNode
    NodeDef <|-- CronTriggerNode
    NodeDef <|-- TransformNode
    NodeDef <|-- HttpRequestNode
    NodeDef <|-- DelayNode

    class FastifyApiGateway {
        +listen(port)
        +handleWebhookTrigger()
        +handleCronTrigger()
    }

    class QueueBroker {
        +pushJob(jobPayload)
        +popJob()
        +pushToDLQ(failedJob)
    }

    class Worker {
        +computeTopologicalOrder(graph)
        +executeStepwise(order)
        +heartbeat()
    }

    class TelemetryStreamer {
        +connect(clientId)
        +broadcastStatus(runId, status)
        +streamLogs(runId, logPayload)
    }

    WorkflowSchema --> NodeDef : contains
    FastifyApiGateway --> QueueBroker : enqueues
    QueueBroker --> Worker : processes
    Worker --> TelemetryStreamer : publishes events
```

---

## ⚡ Core Features

### 1. 🎨 Visual Flow Builder
- Interactive drag-and-drop node graph canvas built on `@xyflow/react`.
- Supports 5 primary operational node types:
  - **Webhook Trigger**: External HTTP POST entrypoints.
  - **Cron Trigger**: Automated temporal runs via standard cron syntax.
  - **HTTP Request**: REST API connector with configurable methods, headers, and payloads.
  - **Transform**: In-memory JavaScript/JSON transformation routines.
  - **Delay**: Configurable pauses and rate dampeners.
- **Client-Side Cycle Detection**: Prevents cyclical loop edge creation before persisting data to the database.

### 2. 🧮 Deterministic Execution Engine
- Dual-pass execution validation powered by **Kahn's Algorithm** (Topological Sort).
- Strictly calculates parent-child dependency orders in linear time: $\mathcal{O}(V + E)$.
- Guarantees child tasks only trigger once upstream prerequisite nodes resolve with verified outputs.

### 3. 🛡️ Resilient Fault Tolerance & DLQ
- Configurable **Exponential Backoff with Random Jitter** prevents thundering herd crashes against upstream third-party APIs.
- **Dead-Letter Queue (DLQ)** isolation: Unrecoverable failures are quarantined without terminating parallel pipeline branches.
- **Worker Heartbeat Tracking**: Workers emit regular heartbeats to Redis; stalled or aborted tasks are transparently rescheduled on healthy worker instances.

### 4. 📡 Real-Time Telemetry & Log Streaming
- Zero-database read overhead: Replaces wasteful client polling intervals with **Server-Sent Events (SSE)**.
- Telemetry events stream directly from BullMQ worker output hooks through Redis Pub/Sub directly to the browser UI.
- Comprehensive per-node state tracking: `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`.

---

## ⚖️ Engineering Trade-offs & Production Defenses

| Dimension | The Naive Way | Smart Engineering (Kahn Engine) | Why It Wins |
| :--- | :--- | :--- | :--- |
| **Graph Validation & Ordering** | Recursive graph traversals on live HTTP requests. | **Kahn’s Algorithm (Topological Sort)** running double-pass validation (client-side pre-check + server-side in-memory array mapping). | Guarantees deterministic $\mathcal{O}(V + E)$ execution order and rejects circular dependencies at the gateway before wasting worker compute resources. |
| **Task Execution & Recovery** | Running multi-step tasks inside standard `async`/`await` blocks on the main web thread; fails instantly on timeouts. | **Decoupled BullMQ worker queueing** with configurable exponential backoff, jitter, and Dead-Letter Queue (DLQ) isolation. | Isolates task failures, buffers load spikes safely in Redis, and prevents downstream cascading crashes. |
| **Telemetry & Log Streaming** | Client HTTP short-polling (`setInterval`), flooding the database with redundant read queries. | **Unidirectional Server-Sent Events (SSE)** streaming backed by Redis Pub/Sub. | Eliminates read-query overhead, reduces network roundtrip costs, and maintains real-time responsiveness at scale. |
| **Ingestion Concurrency** | Synchronously waiting for entire pipeline execution to complete before responding to HTTP callers. | **Non-blocking API Gateway**: Validates payload and acknowledges request in **<10ms** with an `execution_id`. | Absorbs high-volume traffic bursts without blocking HTTP event loops or exceeding client timeouts. |

---

## 🛠️ Technology Stack Breakdown

### Frontend
- **Framework**: React 18+ with TypeScript
- **Flow Canvas**: `@xyflow/react` (React Flow)
- **Data & Cache Management**: `@tanstack/react-query`
- **Styling**: TailwindCSS / Vanilla CSS with modern Glassmorphism

### Backend & API
- **Web Framework**: Fastify (Node.js) for high-throughput, low-overhead HTTP routing
- **Graph & Math Utilities**: `graphlib` + Custom Kahn's Topological Sorter
- **Scheduler**: `node-cron` for parsing cron patterns and dispatching jobs

### Distributed Queue & State
- **Task Queue**: `BullMQ` (Redis-backed concurrency control, stalled job recovery, and retries)
- **Pub/Sub & Heartbeats**: Redis 7.x
- **Event Streaming**: Server-Sent Events (SSE) via Fastify SSE plugin

### Storage & Schema
- **Database**: PostgreSQL 16
- **ORM**: Prisma ORM with connection pooling & JSONB document schemas

---

## 📂 Repository Directory Layout

```text
kahn-engine/
├── apps/
│   ├── client/                  # Frontend Web Application
│   │   ├── src/
│   │   │   ├── components/      # UI components & Canvas custom nodes
│   │   │   │   ├── nodes/       # Webhook, Cron, HTTP, Transform, Delay
│   │   │   │   └── canvas/      # React Flow canvas wrapper & toolbar
│   │   │   ├── hooks/           # useSSETelemetry, useWorkflowGraph
│   │   │   ├── utils/           # Client-side Kahn's cycle detector
│   │   │   └── App.tsx
│   │   └── package.json
│   │
│   ├── server/                  # Fastify API Gateway
│   │   ├── src/
│   │   │   ├── routes/          # /api/v1/workflows, /api/v1/webhooks
│   │   │   ├── controllers/     # Workflow & Ingestion controllers
│   │   │   ├── plugins/         # SSE streaming, Prisma, Redis plugins
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── worker/                  # Decoupled BullMQ Background Worker
│       ├── src/
│       │   ├── engine/          # TopologicalSorter, GraphRunner
│       │   ├── executors/       # Node execution handlers & retries
│       │   ├── queues/          # BullMQ queue & DLQ handlers
│       │   └── worker.ts
│       └── package.json
│
├── packages/
│   └── shared/                  # Common TypeScript interfaces & schemas
│       ├── src/
│       │   ├── types.ts         # NodeDef, EdgeDef, ExecutionStatus
│       │   └── validation.ts    # Graph validation logic
│       └── package.json
│
├── prisma/
│   └── schema.prisma            # PostgreSQL schemas (Workflow, Run, Log)
├── docker-compose.yml           # PostgreSQL & Redis container config
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) `>= 20.x`
- [Docker](https://www.docker.com/) & Docker Compose (for PostgreSQL & Redis)
- `npm` or `pnpm`

### 2. Infrastructure Setup (Docker)
Start PostgreSQL and Redis in the background:
```bash
docker-compose up -d
```

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kahn_engine?schema=public"

# Redis & Queues
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379

# Server
PORT=4000
HOST="0.0.0.0"
CORS_ORIGIN="http://localhost:5173"
```

### 4. Database Migration
```bash
npx prisma migrate dev --name init
```

### 5. Running the Application
Run services concurrently in development mode:

```bash
# Terminal 1: Fastify API Gateway
npm run dev --workspace=@kahn/server

# Terminal 2: BullMQ Distributed Worker
npm run dev --workspace=@kahn/worker

# Terminal 3: React Flow Frontend
npm run dev --workspace=@kahn/client
```

---

## 📡 API Reference & Integration Points

### 1. Webhook Ingestion
Trigger an existing active workflow by its unique ID:
```http
POST /api/v1/webhooks/:workflowId HTTP/1.1
Content-Type: application/json

{
  "event": "user.signup",
  "userId": "usr_99812",
  "email": "dev@syntaxrush.internal"
}
```

**Response (Fast Ack <10ms):**
```json
{
  "success": true,
  "executionId": "exec_8f93c02b",
  "status": "PENDING",
  "enqueuedAt": "2026-10-21T12:00:00.000Z"
}
```

### 2. Live Telemetry SSE Stream
Stream real-time step outputs and statuses directly from the worker:
```http
GET /api/v1/telemetry/stream/:executionId HTTP/1.1
Accept: text/event-stream
```

**SSE Event Payloads:**
```text
event: node_status
data: {"nodeId": "webhook_1", "status": "SUCCESS", "timestamp": 1729512001}

event: node_log
data: {"nodeId": "http_request_2", "level": "INFO", "message": "Invoking upstream target: https://api.service.io/v1/sync"}

event: node_status
data: {"nodeId": "http_request_2", "status": "RUNNING", "timestamp": 1729512002}
```

---

## 📄 License & Attribution

Developed for **Webster 2026** by **Team `<SYNTAXRUSH>` (Team ID: 233)**.  
Licensed under the [MIT License](LICENSE).
