# India Nippon Electricals Limited (INEL) - Backend Microservices

This backend is architected as an **independent Microservices Architecture** with a unified **API Gateway**. Each functional tab/module is isolated into its own microservice so individual developers can build, test, and deploy their features independently without merge conflicts or local port contention.

---

## 🏗 Architecture & Tab Ownership

```
backend/
├── gateway/                        # API Gateway (Port 5000 - Proxies to all services)
├── services/
│   ├── auth-service/               # Tab: Auth & Enterprise Users Directory (Port 5001)
│   ├── process-audit-service/      # Tab: Process Audit Observation (Port 5002)
│   ├── ihlr-service/               # Tab: In-House Line Rejection / Scrap / RCA (Port 5003)
│   └── tryout-service/             # Tab: Try Out Status / Tool & Die Trials (Port 5004)
├── shared/                         # Shared utilities (DB pool, JWT, responses, error handler)
├── database/                       # SQL schemas and seed migrations
└── package.json                    # Root workspace orchestrator
```

### Module & Port Mapping

| Developer / Tab Assignment | Microservice Directory | Port | Key Endpoints |
| :--- | :--- | :--- | :--- |
| **Unified Entry Point** | `gateway/` | `5000` | Reverse proxy `/api/*` to microservices |
| **Developer 1 (Auth & Users)** | `services/auth-service/` | `5001` | `/api/auth/login`, `/api/users` (CRUD) |
| **Developer 2 (Process Audit)** | `services/process-audit-service/` | `5002` | `/api/process-audit/dashboard`, `/requests`, `/notifications` |
| **Developer 3 (IHLR)** | `services/ihlr-service/` | `5003` | `/api/ihlr/dashboard`, `/line-rejections`, `/scrap` |
| **Developer 4 (Try Out Status)** | `services/tryout-service/` | `5004` | `/api/tryout-status/dashboard`, `/trials` |

---

## 🚀 How to Run

### Option 1: Run All Services Together (Full System Test)
In `c:\TodoProject\backend`, run:
```bash
npm run dev
```
This uses `concurrently` to spin up the **API Gateway** and **all 5 microservices** simultaneously with colored console output in a single terminal.

---

### Option 2: Develop Single Tab / Microservice Independently
If you are assigned to a specific tab, you can develop completely independently without needing to run other services:

#### Developer for Process Audit Tab:
```bash
cd services/process-audit-service
npm run dev
```
*(Or from root backend: `npm run dev:process-audit`)*

#### Developer for IHLR Tab:
```bash
cd services/ihlr-service
npm run dev
```
*(Or from root backend: `npm run dev:ihlr`)*

#### Developer for Try Out Status Tab:
```bash
cd services/tryout-service
npm run dev
```
*(Or from root backend: `npm run dev:tryout`)*

#### Developer for Auth & User Management:
```bash
cd services/auth-service
npm run dev
```
*(Or from root backend: `npm run dev:auth`)*

---

## 🌐 Frontend Compatibility (Zero Configuration Changes Required)
The **API Gateway** listens on **Port 5000**, which matches the default frontend API base URL (`http://localhost:5000/api`). 
Frontend developers do not need to change any API URLs:
- `/api/auth/*` &rarr; routed to `http://localhost:5001`
- `/api/users/*` &rarr; routed to `http://localhost:5001`
- `/api/process-audit/*` &rarr; routed to `http://localhost:5002`
- `/api/ihlr/*` &rarr; routed to `http://localhost:5003`
- `/api/tryout-status/*` &rarr; routed to `http://localhost:5004`

If an individual microservice is restarting or not running, the Gateway returns a graceful JSON `503 Service Unavailable` explaining which microservice is offline, preventing frontend crash loops.

---

## 🗄 Database & Offline Resilience
Each microservice connects to the MySQL database `inel_todo` via the shared connection pool (`backend/shared/db.js`). If MySQL is offline in a developer's local environment, all services have built-in mock fallbacks so the UI remains fully functional and testable!
