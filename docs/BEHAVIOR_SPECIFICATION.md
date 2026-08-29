# RAILOPT-X: Behavioral Specification & Operational State Machine

**Problem Statement 25022 — Railway Dispatch & AI Optimization**

---

## 1. Executive Operational Overview

RAILOPT-X operates as a **Human-in-the-Loop AI Dispatch Support System** for high-density railway corridors. This document defines the exact step-by-step state transitions, invariants, and failure mitigations.

---

## 2. Core Operational Scenarios

### Scenario 1: Nominal Train Movement & Proactive Crossing Optimization
**Context:** Nominal timetable running on the New Delhi (NDLS) to Kanpur Central (CNB) corridor.

1. **Lookahead Scanning:** `ConflictRadar` projects deterministic trajectories across `lookahead_sec = 900s`.
2. **Detection:** When two trains are projected to occupy conflicting single-line blocks or violate the 180s headway invariant, an authoritative `PredictedConflict` incident is created.
3. **Automated Re-scheduling:** `DecisionOrchestrator` invokes `CPSATScheduler` to compute the optimal conflict resolution schedule.
4. **Physical Twin Verification:** The optimizer schedule is executed in an isolated branch of `RailwaySimulationEngine` via `CandidateEvaluator`, verifying strict safety invariants at every step.
5. **Evidence Generation:** `DecisionExplainer` constructs machine-checkable `EvidenceFact` records backing every claim.
6. **Controller Review:** The frontend renders `SafeRecommendationPanel` with green verification borders and delay savings.
7. **Execution:** Upon controller approval, the hold action is applied; the train transitions to `WAITING` with an active hold countdown. When the clearance headway elapses, the train accelerates and resumes cruising.

---

### Scenario 2: Unsolvable Invariant Violation / All Candidates Unsafe
**Context:** Multi-train convergence in a single-line block or severe disruption where all candidate branches violate safety invariants.

1. **Safety Gating:** `CandidateEvaluator` detects invariant violations across all candidate branches.
2. **Rejection:** `DecisionOrchestrator` catches the all-unsafe state, skips generating a false recommendation, and emits `MANUAL_INTERVENTION_REQUIRED`.
3. **Controller Escalation:** The frontend displays `ManualInterventionRequired` with high-visibility red styling and clear reasoning.
4. **Mandatory Justification:** The Section Controller selects an operational action (e.g. `HOLD_PRIMARY`, `REDUCE_SPEED`) and enters a mandatory justification.
5. **Audit Logging:** The override action and controller rationale are permanently recorded into the SHA-256 cryptographic audit ledger.

---

### Scenario 3: WebSocket Disconnection & State Resynchronization
**Context:** Network latency or disconnect during live OCC operations.

1. **Disconnection Detection:** The frontend detects WebSocket closure and transitions status to `DISCONNECTED` / `CONNECTING`.
2. **Exponential Backoff:** The client initiates reconnection attempts with exponential backoff (1s, 2s, 4s, 8s, up to 30s).
3. **State Resync:** Upon successful connection, `fetchState()` and `fetchTopology()` are immediately called to perform a full state resynchronization, preventing stale displays.
4. **Polling Fallback:** If WebSocket remains unreachable after 10 retries, polling fallback engages every 2.0s to maintain continuous monitoring.

---

## 3. Safety Invariants (Non-Negotiable)

1. **Headway Separation:** Minimum 180 seconds between consecutive trains entering the same track block.
2. **Single-Line Mutual Exclusion:** Simultaneous opposing movements on single-line sections are strictly prohibited.
3. **Speed Enforcement:** Train speed cannot exceed block speed limits or train physical capability.
4. **Signal Interlocking:** Trains must come to a complete halt before red signals; progression follows 4-aspect progression (`GREEN → DOUBLE_YELLOW → YELLOW → RED`).
