# RAILOPT-X FRONTEND 2.0: Operations Control Center Architecture Handbook
**SIH Problem Statement 25022 — Precision Engineering & UI/UX Blueprint**

---

## 1. Architectural Philosophy & Mental Model

```
                 RAILOPT-X DIGITAL TWIN (v1.0 FROZEN)
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     REST API CONTRACT                     WEBSOCKET BUS (/ws/live)
     • /api/topology                       • INITIAL_STATE
     • /api/state                          • STATE_UPDATE (0.5s ticks)
     • /api/optimize (CP-SAT)              • SIM_EVENT (Transitions)
     • /api/disruptions                    • OPTIMIZER_TRACE (Candidates)
     • /api/recommendations/action         • RECOMMENDATION_CREATED
     • /api/what-if/simulate               • DECISION_APPROVED
     • /api/benchmarks/run
     • /api/audit
                               │
                               ▼
               FRONTEND DOMAIN STATE DISPATCHER
                               │
       ┌───────────────┬───────┴───────┬───────────────┐
       ▼               ▼               ▼               ▼
    NX PANEL       KPI RAIL       TELEPRINTER     DECISION &
   INTERLOCKING   SPLIT-FLAP      REASONING      AUDIT LEDGER
  (Canvas + SVG) (Mechanical)    (Typewriter)    (SHA-256)
       │               │               │               │
       └───────────────┼───────────────┘               │
                       ▼                               ▼
               ATTENTION ENGINE               DECISION RIPPLE
             (Proximity & Route)            (Signal Green Wave)
```

---

## 2. 10-Sprint Engineering Roadmap & Traceability Matrix

| Sprint | Subsystem / Milestone | Deliverables & Behavioral Guarantees | Status |
|---|---|---|:---:|
| **Sprint 1** | **Architecture Audit & Contract Mapping** | Deep domain entity mapping, normalized API client, role context handling, zero-fabrication contract. | **COMPLETE** |
| **Sprint 2** | **Schematic NX Panel Interlocking Canvas** | Dynamic block circuits (UP/DOWN/Loops/Single-Line), 3-aspect signal heads, dynamic topology scaling from `/api/topology`. | **COMPLETE** |
| **Sprint 3** | **Attention Field Interaction Engine** | Spatial cursor proximity, progressive route reveal ribbon, conflict node pulsing, contextual metadata tooltip. | **IN_PROGRESS** |
| **Sprint 4** | **Real-Time Event-Driven Animation System** | Deterministic train position math, speed vectors, block occupancy lighting, live simulation ticker. | **IN_PROGRESS** |
| **Sprint 5** | **Mechanical Split-Flap Telemetry Rail** | 3D mechanical digit flips, dynamic Throughput ($tr/hr$), Avg Delay, OTP %, verified Safety Invariants proof. | **COMPLETE** |
| **Sprint 6** | **AI Teleprinter & CP-SAT Search Tracing** | Candidate evaluations stream ($J$), rejection reasons, optimal convergence, dynamic Counterfactual modal. | **IN_PROGRESS** |
| **Sprint 7** | **Human-in-the-Loop Controller Workflow** | Approve/Reject/Override actions, cryptographic audit persistence, animated Signal Green Decision Ripple. | **COMPLETE** |
| **Sprint 8** | **What-If Simulation Sandbox** | Isolated disruption branching, dynamic delay propagation, live delta comparison with zero phantom fallbacks. | **PARTIAL** |
| **Sprint 9** | **Automated SIH Evaluator Demo Orchestrator** | 6-step state-aware guided walkthrough (Normal $\rightarrow$ Disruption $\rightarrow$ Radar $\rightarrow$ Approve $\rightarrow$ What-If $\rightarrow$ Benchmark). | **IN_PROGRESS** |
| **Sprint 10** | **Production Build, Linter & Accessibility** | 0 linter warnings, 0 TypeScript errors, clean bundle ($<270\text{ kB}$), `prefers-reduced-motion` compliance. | **UNVERIFIED (Requires Local Run)** |

---

## 3. UI Semantic Color & Design Tokens

```css
:root {
  --occ-bg: #050B11;             /* Obsidian Deep OCC Console Background */
  --occ-panel: #0A131D;          /* Structural Panel Surface */
  --occ-border: #162434;         /* Inactive Circuit Border */
  --occ-cyan: #00D4FF;           /* Reserved Route & High-Speed Telemetry */
  --occ-green: #00E676;          /* Clear Signal Aspect & Safety Certified */
  --occ-amber: #FFB300;          /* Cautionary Aspect & Train Waiting */
  --occ-red: #FF1744;            /* Occupied Block, Danger, Active Conflict */
  --occ-purple: #E040FB;         /* Premium Superfast Train Class (P5) */
  --occ-orange: #FF9100;         /* Heavy Freight Train Class (P1–P2) */
}
```

---

## 4. Source of Truth & Zero-Fabrication Invariants

1. **No Static Operational Hardcoding**:
   - KPIs initialize to `null` (`"—"`) until verified telemetry arrives from `/api/state` or WebSocket `STATE_UPDATE`.
   - Dwell times and network block capacities derive dynamically from `train.stops` and `len(engine.network.blocks)`.
   - Safety invariant verification provenance displays exact evaluated metrics ($24/24$ Invariants Verified, $100\%$).
2. **Authentic Mathematical Trace**:
   - Teleprinter logs mirror real solver candidate searches and validation steps via `OPTIMIZER_TRACE` events.
   - If no logs exist, displays `"AWAITING MATHEMATICAL SOLVER TRACE / SIMULATION DISRUPTION"`.
3. **Resilient Connection Lifecycle**:
   - Clear UI state badges: `LIVE TELEMETRY` (Green pulse) $\leftrightarrow$ `RECONNECTING...` (Amber) $\leftrightarrow$ `OFFLINE` (Red).
