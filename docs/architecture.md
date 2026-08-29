# RAILOPT-X 2.0 — System Architecture & Digital Twin Specification
**SIH Problem Statement PS-25022: Intelligent Real-Time Train Traffic Controller & Digital Twin**

---

## 1. Executive Summary

**RAILOPT-X 2.0** is an explainable, safety-governed railway operations digital twin engineered for high-density railway corridors (demonstrated on the Northern Railway **New Delhi – Kanpur (NDLS–CNB)** corridor, 435 km). 

The platform bridges real-time discrete-event physics simulation, multi-aspect signal interlocking, proactive conflict radar, constraint-satisfaction mathematical optimization (Google OR-Tools CP-SAT with priority-dispatch heuristics), tamper-evident cryptographic audit trails, and multi-LOD spatial visualization.

---

## 2. End-to-End System Topology

```
+----------------------------------------------------------------------------------------------------+
|                                    RAILOPT-X 2.0 DIGITAL TWIN                                      |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  +-------------------------+     +--------------------------+     +-----------------------------+  |
|  |     PHYSICS ENGINE      | --> |    CONFLICT RADAR        | --> |      SOLVER PIPELINE        |  |
|  | (Davis Eq, Headway,     |     | (Deterministic Lookahead |     | (CP-SAT Multi-Objective     |  |
|  |  Gradient, Interlock)   |     |  15-min Horizon)         |     |  Min Delay + Priority)      |  |
|  +-------------------------+     +--------------------------+     +-----------------------------+  |
|               |                                                                  |                 |
|               v                                                                  v                 |
|  +-------------------------+                                      +-----------------------------+  |
|  |   INTERLOCKING STATE    |                                      |      SAFETY VALIDATOR       |  |
|  | (4-Aspect Signals,      |                                      | (Zero Headway Violations,   |  |
|  |  Route Locking, Loops)  |                                      |  Zero Block Collisions)     |  |
|  +-------------------------+                                      +-----------------------------+  |
|               |                                                                  |                 |
|               +-----------------------------+------------------------------------+                 |
|                                             |                                                      |
|                                             v                                                      |
|                             +-------------------------------+                                      |
|                             |      FASTAPI SERVER (8000)    |                                      |
|                             |  - Monotonic Sequence Engine  |                                      |
|                             |  - /ws/live Telemetry Stream  |                                      |
|                             |  - What-If Isolated Clones    |                                      |
|                             |  - SHA-256 Tamper Audit Log   |                                      |
|                             +-------------------------------+                                      |
|                                             |                                                      |
|                     +-----------------------+-----------------------+                              |
|                     | WebSocket /ws/live (Monotonic Sequence)       | REST /api/state              |
|                     v                                               v                              |
|  +----------------------------------------------------------------------------------------------+  |
|  |                                  FRONTEND LAYER (Vite + React)                               |  |
|  |                                                                                              |  |
|  |  +----------------------------+  +---------------------------+  +-------------------------+  |  |
|  |  |   OPERATIONAL STORE        |  |   RAIL TOPOLOGY MAPPING   |  |     AUDIO DIRECTOR      |  |  |
|  |  | (Single Source of Truth,   |  | (Continuous Chainage,     |  | (Spatial Attenuation,   |  |  |
|  |  |  What-If Branch State)     |  |  Turnouts, 7 Camera Modes)|  |  Physics Pitch, Opt-in) |  |  |
|  |  +----------------------------+  +---------------------------+  +-------------------------+  |  |
|  |                 |                               |                                |           |  |
|  |                 v                               v                                v           |  |
|  |  +----------------------------------------------------------------------------------------+  |  |
|  |  |                     OPERATIONS CONTROL CENTER (OCC) INTERFACE                          |  |  |
|  |  |  - NX Track Canvas (Multi-LOD 0/1/2 Rolling Stock Consists: WAP-7, Vande Bharat, WAG-9) |  |  |
|  |  |  - AI Decision Review Center (Counterfactuals, Objective J, Horizon, Provenance)      |  |  |
|  |  |  - What-If Laboratory (Multi-Branch Parallel Clone Comparison)                         |  |  |
|  |  |  - Traffic Teleprinter (Cryptographic Dispatch Event Ledger)                           |  |  |
|  |  +----------------------------------------------------------------------------------------+  |  |
|  +----------------------------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Mathematical Formulation

### 3.1 Objective Function ($J$)
The optimization engine minimizes a weighted objective function $J$ penalizing total weighted delay, high-priority service disruption, and switch changes across the horizon:

$$J = \sum_{t \in \mathcal{T}} w_t \cdot \Delta_t + \sum_{(t_i, t_j) \in \mathcal{C}} \Pi_{i,j} \cdot \mathbf{1}_{\{\text{Crossing Delay}\}} + \lambda \sum_{s \in \mathcal{S}} \text{SwitchOverhead}(s)$$

Where:
- $\mathcal{T}$: Set of active trains in corridor
- $w_t$: Priority weight ($w = 5.0$ for High-Speed Vande Bharat, $w = 4.0$ for Rajdhani/Shatabdi, $w = 2.0$ for Express, $w = 1.0$ for Freight)
- $\Delta_t$: Cumulative schedule delay in minutes
- $\Pi_{i,j}$: Headway penalty for crossing moves
- $\lambda$: Route stability penalty preventing unnecessary oscillating dispatch orders

### 3.2 Invariant Constraints
1. **Block Exclusion**: $\forall b \in \mathcal{B}, \sum_{t \in \mathcal{T}} \mathbf{1}_{\{t \text{ occupies } b\}} \le 1$
2. **Dynamic Headway**: $t_{\text{entry}}(t_2, b) - t_{\text{exit}}(t_1, b) \ge H_{\text{min}} \quad (H_{\text{min}} = 180\,\text{s})$
3. **Loop Capacity**: $\text{Occupancy}(\text{Station Loop } s) \le \text{Capacity}(s)$
4. **Speed Limits**: $v(t, b) \le \min(v_{\text{max}}(t), v_{\text{limit}}(b), v_{\text{tsr}}(b))$

---

## 4. Subsystems Breakdown

### 4.1 Physics Engine (`backend/simulator/engine.py`)
- **Tractive Physics**: Accelerations calculated via gradient sensitivity $\theta$, train mass $M$, and train-class specific deceleration parameters.
- **Interlocking**: 4-Aspect automatic block signaling (Green $\rightarrow$ Double Yellow $\rightarrow$ Yellow $\rightarrow$ Red) based on forward section occupancy.
- **Deterministic Cloning**: The `clone()` API produces isolated sandbox replicas for zero-side-effect What-If evaluation.

### 4.2 Realtime Transport (`/ws/live`)
- Emits atomic snapshots with strictly monotonic `sequence` counters and `topology_revision`.
- Sequence gap detection in `OperationalStore.tsx` automatically triggers delta recovery.

### 4.3 Spatial Web Audio (`src/audio/AudioDirector.ts`)
- Muted by default with an accessible top-bar toggle.
- Synthesizes 3-phase VVVF inverter traction harmonics, wheel joint cadence ($f = v / L_{\text{joint}}$), pneumatic air brake exhaust, and mechanical interlocking relay clicks.
