# ⚡ Kahn Engine

> **Visual Workflow Orchestrator & Execution Engine**<br />
> *Built for Webster 2026 by Team `<SYNTAXRUSH>` (Team ID: 233)*

---

[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-High--Performance-000000?style=flat&logo=fastify&logoColor=white)](https://fastify.dev/)
[![React Flow](https://img.shields.io/badge/@xyflow/react-Canvas%20UI-FF0072?style=flat)](https://reactflow.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Node%20pg-336791?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
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
**Kahn Engine** pairs a **visual drag-and-drop canvas (React Flow)** with **DAG validation (Kahn’s Algorithm)** and a **Fastify API**. Workflow definitions and execution history are persisted in PostgreSQL. Workflow execution currently runs asynchronously in the API process; BullMQ/Redis workers and automatic retry/DLQ handling are not implemented. Real-time logs and per-node statuses are sent to connected clients using **Server-Sent Events (SSE)**.

---

## 🏗️ Architecture & System Design

### End-to-End Ingestion & Execution Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer / UI
    participant Client as React Flow Canvas
    participant Gateway as Fastify API Gateway
    participant DB as PostgreSQL (parameterized SQL)
    participant Engine as In-process Execution Engine
    participant SSE as In-process SSE Streamer

    Dev->>Client: Construct Workflow & Trigger Connections
    Client->>Client: In-Memory Cycle Detection (Kahn's Algorithm)
    Client->>Gateway: POST /api/v1/workflows (Save DAG)
    Gateway->>DB: Persist Workflow Schema (JSONB Nodes & Edges)
    
    rect rgb(240, 248, 255)
    Note over Gateway,Engine: Ingestion and execution
    alt Webhook or manual trigger
        Gateway->>Gateway: Validate Ingestion Payload
        Gateway->>DB: Persist execution (status: queued)
        Gateway-->>Client: 202 Accepted (execution_id)
        Gateway->>Engine: Start asynchronous workflow run
    end
    end

    rect rgb(255, 250, 240)
    Note over Engine,SSE: In-process execution and telemetry
    Engine->>Engine: Compute topological order (DAG sort)
    loop Node Execution Loop
        Engine->>Engine: Execute Node (HTTP / Transform / Delay)
        Engine->>SSE: Emit Event (RUNNING / SUCCESS / FAILED)
        SSE-->>Client: Live SSE Broadcast (Logs & Status)
    end
    Engine->>DB: Persist run history and timestamps
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

    class WorkflowExecutor {
        +computeTopologicalOrder(graph)
        +executeStepwise(order)
    }

    class TelemetryStreamer {
        +connect(clientId)
        +broadcastStatus(runId, status)
        +streamLogs(runId, logPayload)
    }

    WorkflowSchema --> NodeDef : contains
    FastifyApiGateway --> WorkflowExecutor : starts asynchronously
    WorkflowExecutor --> TelemetryStreamer : broadcasts events
```

---

## ⚡ Core Features

### 1. 🎨 Visual Flow Builder
- Interactive drag-and-drop node graph canvas built on `@xyflow/react`.
- Supports 5 primary operational node types:
  - **Webhook Trigger**: External HTTP POST entrypoints.
  - **Cron Trigger**: Dispatches the downstream workflow on its configured cron schedule and timezone.
  - **HTTP Request**: REST API connector with configurable methods, headers, and payloads.
  - **Transform**: In-memory JavaScript/JSON transformation routines.
  - **Delay**: Configurable pauses and rate dampeners.
- **Client-Side Cycle Detection**: Prevents cyclical loop edge creation before persisting data to the database.

### 2. 🧮 Deterministic Execution Engine
- Dual-pass execution validation powered by **Kahn's Algorithm** (Topological Sort).
- Strictly calculates parent-child dependency orders in linear time: $\mathcal{O}(V + E)$.
- Guarantees child tasks only trigger once upstream prerequisite nodes resolve with verified outputs.

### 3. 🗃️ Durable Execution History
- Workflow definitions, execution records, node results, and execution logs are stored in PostgreSQL.
- Database-backed history remains available after the API process restarts.
- Distributed retries, a dead-letter queue, and worker heartbeat recovery are not implemented.

### 4. 📡 Real-Time Telemetry & Log Streaming
- Zero-database read overhead: Replaces wasteful client polling intervals with **Server-Sent Events (SSE)**.
- Telemetry events stream to connected clients over the API process's Server-Sent Events endpoint.
- Comprehensive per-node state tracking: `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`.

---

## ⚖️ Engineering Trade-offs & Production Defenses

| Dimension | The Naive Way | Smart Engineering (Kahn Engine) | Why It Wins |
| :--- | :--- | :--- | :--- |
| **Graph Validation & Ordering** | Recursive graph traversals on live HTTP requests. | **Kahn’s Algorithm (Topological Sort)** running double-pass validation (client-side pre-check + server-side in-memory array mapping). | Guarantees deterministic $\mathcal{O}(V + E)$ execution order and rejects circular dependencies at the gateway before wasting worker compute resources. |
| **Task Execution & Recovery** | Running multi-step tasks synchronously in the request handler. | Execution is started asynchronously in the API process, and execution state is persisted in PostgreSQL. | Keeps the request path responsive and retains run history; a separate durable queue and automatic recovery are not yet available. |
| **Telemetry & Log Streaming** | Client HTTP short-polling (`setInterval`). | **Unidirectional Server-Sent Events (SSE)** streamed by the API process. | Streams live execution updates to connected clients; SSE subscriber state is process-local. |
| **Ingestion Concurrency** | Waiting for the entire workflow run to finish before responding. | API persists the run and returns `202` before starting its in-process execution. | Avoids holding the HTTP request open for the full run; the response time is not guaranteed to be under 10ms. |

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
- **Schedules**: Cron trigger definitions and time zones persist in `workflow_schedules`; the server restores and runs enabled schedules with `node-cron`

### Distributed Queue & State
- **Task Queue**: BullMQ/Redis integration is planned but not implemented
- **Event Streaming**: Server-Sent Events (SSE) via Fastify SSE plugin

### Storage & Schema
- **Database**: PostgreSQL 16
- **Database access**: Parameterized SQL through a shared `pg` connection pool
- **Workflow tables**: `workflows`, `workflow_executions`, `node_executions`, `workflow_schedules`, `integration_connections`, and `execution_logs`
- **OAuth credentials**: Existing encrypted token payloads remain in the separate `integration_sessions` table; connection metadata never stores tokens
- **Schema files**: Individual table definitions are in `server/src/db/schema/`, named after each table. Apply database changes through the versioned migrations in `server/src/db/migrations/`.

---

## 📂 Repository Directory Layout

```text
kahn-engine/
├── client/                      # Frontend application
│   └── src/
├── server/
│   ├── src/
│   │   ├── db/                  # PostgreSQL pool, repositories, migrations
│   │   ├── engine/              # Workflow executor and integrations
│   │   ├── routes/              # Fastify API routes
│   │   ├── services/            # Supporting services
│   │   └── index.js             # Backend entry point
│   └── .env.example
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) `>= 20.x`
- PostgreSQL (Redis is not required by the current implementation)
- `npm` or `pnpm`

### 2. Infrastructure Setup
Start a PostgreSQL instance and create a database for the backend.

### 3. Environment Variables
Copy `server/.env.example` to `server/.env` (or provide the values in the server process environment). Add `sslmode=require` to `DATABASE_URL` for hosted databases. Generate the OAuth session key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kahn_engine?schema=public"

SESSION_ENCRYPTION_KEY="64-character hexadecimal key"

# Server
PORT=4000
HOST="0.0.0.0"
```

### 4. Database Migration
```bash
npm run db:migrate --prefix server
```

Pending SQL migrations are also applied at server startup. Run the backend and frontend:

```bash
npm run dev --prefix server
npm run dev --prefix client
```

Workflows, execution records, node results, cron schedule definitions, integration status, and encrypted OAuth sessions persist in PostgreSQL. On startup, the server restores enabled cron triggers and runs each workflow in the API process. The scheduler is process-local, so run a single server instance to avoid duplicate cron executions; a distributed scheduler/worker is needed before scaling the API horizontally. The SSE subscriber registry and GitHub polling cursor also remain process-local runtime state. Verify workflow persistence by creating a workflow with `POST /api/v1/workflows`, restarting the server, then retrieving it with `GET /api/v1/workflows/:id`. Live GitHub and Gmail requests still use their external APIs and require their OAuth credentials. BullMQ is not implemented.

Before the canvas dispatches a test run, every node must have a saved configuration and pass node-specific checks. The backend repeats configuration checks along with graph shape and cycle validation; invalid runs return HTTP 400 with per-node `nodeErrors`. This validates configured values, not external service availability or OAuth connectivity. Scheduled executions record both the intended cron time and the actual dispatch time in their trigger payload so scheduling lag can be distinguished from downstream node or email-provider latency.

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

**Response:**
```json
{
  "success": true,
  "executionId": "exec_8f93c02b",
  "status": "PENDING",
  "enqueuedAt": "2026-10-21T12:00:00.000Z"
}
```

### 2. Live Telemetry SSE Stream
Stream real-time step outputs and statuses from the API process:
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
