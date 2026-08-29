# RAILOPT-X: UI Definition of Done & Operational Integrity Standard

Every frontend component, visualization, and interaction in the RAILOPT-X Operations Control Center (OCC) satisfies the following strict operational and engineering standards:

---

## 1. Functional Grounding & Truth in Telemetry

- [x] **Real Backend State**: Every gauge, number, and status indicator maps to authentic simulation, optimization, or safety validation state.
- [x] **Authoritative Control Path**: All simulation controls (`START`, `PAUSE`, `RESET`, `SET_SCALE`) execute via backend API endpoints (`/api/simulation/control`) with immediate authoritative state synchronization.
- [x] **No Fabricated Fallbacks**: All metric fields show authentic values or explicit `—` / `UNAVAILABLE` states. Defaults like hardcoded delay savings or assumed `OPTIMAL` statuses are forbidden.
- [x] **Honest Null-State Semantics**: Unmeasured metrics (e.g., acceptance rate with 0 decisions, live throughput with 0 arrivals) display `N/A` or `0.0` rather than misleading values.

---

## 2. Spatial Digital Twin & NX Track Canvas 2.0

- [x] **Continuous Motion Lerp Engine**: Sub-second physics lerp ($60\text{ fps}$) smoothing train motion between $0.5\text{s}$ WebSocket telemetry ticks.
- [x] **Multi-Entity Spatial Attention Field**: Proximity-weighted detection across Trains, Interlocking Signals, Track Blocks, Stations, and Single-Line Conflicts.
- [x] **Multi-Candidate Ghost Schedule Routes**: Visualizes CP-SAT solver candidate schedule options ($C001$ Selected Optimum, $C002$ Conflict/Headway Risk, $C003$ Loop Precedence) with $J$-cost metrics on SVG tracks.
- [x] **Causal Decision Ripple Shockwaves**: Propagates decision approval waves along the causal chain ($Train \rightarrow Block \rightarrow Signal \rightarrow Opposing Train$).
- [x] **Persistent Contextual Inspector**: Dedicated inspector overlay providing deep telemetry, route progress, signal aspect, and 1-click What-If sandbox simulation.

---

## 3. Engineering & Build Compliance

- [x] **Zero Build Errors & Warnings**: Complete TypeScript strict type checking and `oxlint` compliance.
- [x] **Role-Based Access Control (RBAC)**: Operator roles (`Controller`, `Supervisor`, `Admin`, `Analyst`) guarding simulation actions and safety overrides.
- [x] **Resilient Connectivity**: Primary WebSocket channel with automatic heartbeat, reconnect backoff, and lightweight REST state polling fallback.
