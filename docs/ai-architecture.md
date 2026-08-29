# RAILOPT-X — System Architecture & AI Provenance Guide

This document defines the authoritative architecture, mathematical formulations, and operational boundaries of all optimization, simulation, and decision-support components in RAILOPT-X (SIH Problem Statement 25022).

---

## 1. Component Truth Hierarchy & Nomenclature

To ensure scientific honesty, defensibility, and compliance with Indian Railways operational safety standards, all components are explicitly named and bounded:

| Component | Technical Classification | Role & Authority | Output Artifact |
| :--- | :--- | :--- | :--- |
| **ConflictRadar** | *Deterministic Trajectory Approximation* | 15-minute lookahead spatial-temporal clustering of block overlap | `PredictedConflict` |
| **CPSATScheduler** | *Constraint Programming (OR-Tools)* | Mathematical schedule optimization minimizing priority delay | `CandidateSchedule` |
| **FallbackCSP** | *Greedy Constraint Satisfaction* | High-speed fallback when solver timeout expires | `CandidateSchedule` |
| **SafetyValidator** | *Deterministic Hard Constraint Checker* | Zero-tolerance invariant check (180s headway, interlocking) | `List[SafetyViolation]` |
| **CandidateEvaluator** | *Digital Twin Branch Simulation* | 100% physically simulated counterfactual rollouts using engine physics | `DecisionEvaluation` |
| **DecisionExplainer** | *Rule-Based Explainable AI (XAI)* | Translates physical simulation metrics into defensible reasoning | `Recommendation` |
| **DelayPropagation** | *Heuristic Knock-On Estimator* | Non-authoritative downstream delay decay model | `DelayPropagationReport` |
| **Assistant** | *Tool-Using Dispatch Copilot* | Structured operational intent router (stems, telemetry queries) | Assistant Response |
| **Section Controller** | *Human Authority* | Final command decision (APPROVE / REJECT / OVERRIDE) | `AuditLogEntry` |

---

## 2. Unified Operational Objective Function

All optimization and evaluation engines use the single authoritative objective function $J$:

$$J = (T_{\text{delay}} \cdot W_{\text{delay}} \cdot P) + (D_{\text{max}} \cdot W_{\text{peak}}) + (C_{\text{conflicts}} \cdot K_{\text{penalty}}) + (T_{\text{travel}} \cdot W_{\text{travel}})$$

Where:
- $T_{\text{delay}}$ = Total schedule delay in minutes
- $W_{\text{delay}} = 1.0$ (standard delay weight)
- $P$ = Priority multiplier ($6 - \text{PriorityLevel}$, giving P5 trains highest penalty)
- $D_{\text{max}}$ = Maximum single-train delay in minutes
- $W_{\text{peak}} = 0.5$ (peak delay weight)
- $C_{\text{conflicts}}$ = Number of unresolved conflict incidents
- $K_{\text{penalty}} = 50.0$ (penalty per conflict)
- $T_{\text{travel}}$ = Total section traversal time in minutes
- $W_{\text{travel}} = 0.3$ (travel time efficiency weight)

### Hard Safety Gate
Any candidate schedule that violates interlocking constraints or 180s headway receives $J = 99999.0$ and is disqualified from selection.

---

## 3. Provenance & Audit Trail

Every recommendation carries cryptographic and execution lineage:
- `source_solver`: Solver algorithm name (e.g. `OR-Tools_CP-SAT`)
- `source_candidate_id`: ID of the simulated candidate branch (e.g. `CAND_001`)
- `evaluation_horizon_sec`: Physics simulation lookahead window ($900\text{s}$)
- `physical_validation_status`: `PASSED` (0 physical violations)
- `prediction_method`: `DETERMINISTIC_TRAJECTORY_APPROXIMATION`
- `entry_hash`: SHA-256 hash linked to previous audit ledger block for tamper evidence.
