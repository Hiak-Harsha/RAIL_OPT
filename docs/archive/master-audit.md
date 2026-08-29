# RAILOPT-X Master Comprehensive Audit & Traceability Matrix

## 1. System Overview & Architecture Flow

```
┌─────────────────────────────────────────────────────────┐
│                  RAILWAY DIGITAL TWIN                   │
│   Topology ←→ Simulation ←→ Signals ←→ Trains          │
│                         │                               │
│                         ▼                               │
│                  REAL-TIME STATE                        │
└─────────────────────────┬───────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
       CONFLICT RADAR             USER VIEW
              │
              ▼
       AI / OPTIMIZATION
              │
              ▼
      CANDIDATE FUTURES
         │     │     │
         ▼     ▼     ▼
       PLAN A PLAN B PLAN C
         │     │     │
         └─────┼─────┘
               ▼
       PHYSICAL EVALUATION
               │
               ▼
             SAFETY
               │
               ▼
           EXPLANATION
               │
               ▼
        HUMAN DECISION
               │
               ▼
           EXECUTION
               │
               ▼
        LIVE SIMULATION
               │
          ┌────┴────┐
          ▼         ▼
       METRICS    AUDIT
                    │
                    ▼
                  REPLAY
```

## 2. Backend Endpoint Matrix & Status

| Endpoint | Method | Purpose | Role Auth | State Change | Status |
|---|---|---|---|---|---|
| `/api/health` | GET | Server & engine health check | Public | None | **PASS** |
| `/api/state` | GET | Authoritative simulation snapshot | Public | None | **PASS** |
| `/api/topology` | GET | Authoritative corridor graph topology | Public | None | **PASS** |
| `/api/simulation/control` | POST | Advance, pause, scale, reset simulation | Controller, Supervisor, Admin | Mutates `sim_engine.state` | **PASS** |
| `/api/scenarios` | GET | List pre-configured scenarios | Public | None | **PASS** |
| `/api/scenarios/{id}/load`| POST | Deterministically load scenario | Controller, Supervisor, Admin | Resets & loads network | **PASS** |
| `/api/disruptions` | POST | Inject real block closure or delay | Supervisor, Admin | Adds active disruption | **PASS** |
| `/api/recommendations/action`| POST| Approve, reject, or override candidate | Controller, Supervisor, Admin | Executes physical action & audit entry | **PASS** |
| `/api/what-if/candidate` | POST | Physical branch divergence evaluation | Public | Creates branch clone | **PASS** |
| `/api/branches/{id}/diff`| GET | Branch delta metrics vs live twin | Public | None | **PASS** |
| `/api/audit` | GET | Fetch immutable decision audit trail | Analyst, Admin | None | **PASS** |
| `/api/audit/verify` | GET | Cryptographic SHA-256 chain verification| Analyst, Admin | None | **PASS** |
| `/api/benchmarks` | GET | Algorithm comparison (FCFS, CSP, CP-SAT)| Analyst, Admin | Computes benchmarks | **PASS** |
| `/ws/live` | WebSocket | High-frequency telemetry stream (10Hz)| Public | Broadcasts state | **PASS** |

## 3. Canonical Roles & Permissions Matrix

- **Controller**: Realtime monitoring, AI recommendation review, What-If candidate preview, approval of standard operational actions (`HOLD`, `REROUTE`, `LOOP_PRECEDENCE`).
- **Supervisor**: Everything in Controller + Disruption injection, Manual Overrides, Emergency Movement authorizations.
- **Analyst**: Read-only operational context, Performance Benchmarks, Post-incident Replay, Audit trail verification.
- **Admin**: Full system permissions, scenario director override, configuration reset.

## 4. Verification Test Status

- **Total pytest tests**: 85 passed, 2 skipped (100% green).
- **TypeScript build**: 0 errors (`tsc -b && vite build` built in <3s).
- **Packaging gates**: 12/12 gates passed.
