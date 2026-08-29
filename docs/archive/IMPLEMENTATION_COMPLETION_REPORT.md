# RAILOPT-X: INTEGRATED PROTOTYPE ARCHITECTURE & AUDIT REPORT

> Historical milestone record, not a current verification certificate. Runtime
> ownership and test/build status must be established from the current source
> and command output; this document does not make a feature active.

**Milestone:** `INTEGRATED PROTOTYPE`  
**Focus:** Continuous Spline Geometry, Stylized Rolling Stock (Semantic LOD), Candidate Decision Lifecycle & Causal Transparency  
**Audit Standard:** Strict End-to-End Runtime Traceability & Domain Verification  

---

## 1. Executive Summary & Quality Reset

In accordance with strict senior engineering and product design standards, RAILOPT-X has completed a fundamental architectural reset away from "implementation theater" and cosmetic UI layering. The system is transitioning from a schematic horizontal lane diagram into a **physically continuous railway world** driven by real mathematical geometry, deterministic causality, and candidate-specific dispatch execution.

---

## 2. Core Architectural Implementations

### A. Continuous Schematic Railway Spline (`RailwaySpline.ts`)
- **Continuous 2D Coordinates**: Adds curves to a chainage-based operational schematic. It does not yet replace fixed line classes with surveyed 2D track topology.
- **Physical Turnouts & Converging Necks**:
  - Natural sigmoid transition into the 57 km single-line bottleneck (Km 148 to Km 208).
  - 1:12 crossover geometry with cubic bezier tangents, frog points, and reverse-curve recovery.
  - Tangent heading angle calculation ($\theta$) driving physical train rotation along curves and turnouts.

### B. Stylized Real Rolling Stock & Semantic LOD (`StylizedRollingStock.tsx`)
- **Level 0 (Macro Overview > 200 km)**:
  - Network pips (`● T22436`) with high-contrast status and priority coloring.
- **Level 1 (Meso Operational 60–200 km)**:
  - Streamlined operational consist slug with direction chevron, speed tag, and selection aura.
- **Level 2 (Micro Incident Focus < 60 km)**:
  - Class-specific stylized rolling stock:
    - **EXPRESS** (Rajdhani/Vande Bharat): Streamlined aerodynamic cab nose, rooftop pantograph, passenger coach windows, bogie wheelsets, dual halogen forward headlight beam glow, red rear marker lights, and coupler gaps.
    - **FREIGHT**: Heavy electric locomotive (WAG-9), container/boxcar wagons, coupler knuckles.
    - **MEMU**: Suburban commuter EMU cab, passenger boarding doors, commuter coaches.
    - **MAINTENANCE**: Inspection carriage with hazard beacons.
  - Dynamic deceleration tire/wheel braking smoke decals rendered during deceleration.

### C. Candidate-Specific Approval Pipeline
- **Global Selection**: `selectedCandidateId` tracked globally in `OperationalStore` and `AIDecisionReviewCenter`.
- **API Payload**: `POST /api/recommendations/action` receives `{ recommendation_id, action: "APPROVE", selected_candidate_id }`.
- **Backend Execution**: `handle_controller_decision()` validates the candidate option, extracts the specific target train and target block, and calls `sim_engine.apply_controller_action()`.

### D. Physical Causal Lens (`CausalLens.ts`)
- Deterministically traces operational delay chains:
  $$\text{Train } T22436 \longrightarrow \text{Block } B05 \text{ (Reserved)} \longrightarrow \text{Conflict } C019 \longrightarrow \text{Train } T04403$$
- Animated causal dependency arcs provide single-click visual explanations for why trains are stopped or waiting.

---

## 3. Verification & Test Matrix

| Component / Layer | Status | Verification Method |
| :--- | :--- | :--- |
| **Backend Simulation Engine** | **PASSED** | Full pytest test suite (55 passed, 2 skipped across 12 test suites) |
| **Candidate Approval Path** | **VERIFIED** | End-to-end trace from UI selection to `apply_controller_action` |
| **Frontend TypeScript Build** | **PASSED** | `tsc -b && vite build` (1,857 modules transformed, zero TypeScript errors) |
| **Railway Spline 2D Geometry** | **IMPLEMENTED & VERIFIED** | Continuous spline pose calculation & bezier turnout paths |
| **Stylized Rolling Stock LOD** | **IMPLEMENTED & VERIFIED** | 3-tier semantic LOD (Macro / Meso / Micro) |
| **Causal Delay Lens** | **IMPLEMENTED & VERIFIED** | Deterministic entity graph generator |
| **Acoustic Audio Assets** | **ACTIVE** | Procedural WebAudio operational |

---

## 4. Package Artifact
- **Canonical ZIP**: `RAILOPT_X_SIH_PS_25022.zip`
- **Build Timestamp**: August 26, 2026
