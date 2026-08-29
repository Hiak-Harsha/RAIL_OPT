# RAILOPT-X 2.0 — Active Runtime & Architecture Map

## Repository Forensic Audit

**Analysis Date:** August 26, 2026  
**Architecture Standard:** Target single source of truth (`OperationalSnapshot` + `OperationalEvent`)

> Audit correction: `App.tsx` currently owns the active websocket, controls and
> view state. `OperationalStore.tsx` is a migration target and must not be
> described as canonical until `App.tsx` consumes it and its parallel state is removed.

---

## 1. Core Runtime Component Map

| Component / File | Source of Truth | Mutations / Action | Emitted Event | UI Visual Effect | Tests | Runtime Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`backend/simulator/engine.py`** | `RailwayState` | `step()`, `apply_controller_action()`, `inject_disruption()` | `TRAIN_DEPARTED`, `TRAIN_BRAKING`, `BLOCK_OCCUPIED`, `SIGNAL_*` | Live physical world simulation | `tests/test_simulator.py` | **ACTIVE (CANONICAL)** |
| **`backend/simulator/episodes.py`** | `EPISODES` dictionary | `load_operational_episode()` | `SIM_RESET`, `EPISODE_LOADED` | Deterministic scenario setup | `tests/test_episodes.py` | **ACTIVE (CANONICAL)** |
| **`backend/services/conflict_radar.py`** | `TrajectoryGenerator` | `predict_conflicts()` | `CONFLICT_PREDICTED`, `CONFLICT_RESOLVED` | Conflict radar indicators & focus | `tests/test_conflict_radar.py` | **ACTIVE (CANONICAL)** |
| **`backend/services/evaluator.py`** | Simulator state clone | `evaluate_candidate_schedules()` | `PLAN_GENERATED`, `PLAN_PREVIEW_COMPLETE` | Counterfactual candidate options | `tests/test_evaluator.py` | **ACTIVE (CANONICAL)** |
| **`backend/services/decision_orchestrator.py`** | CP-SAT + Explainer | `handle_predicted_conflict()` | `DECISION_APPROVED`, `MANUAL_INTERVENTION_REQUIRED` | AI Review Center recommendations | `tests/test_orchestrator.py` | **ACTIVE (CANONICAL)** |
| **`backend/services/what_if_simulator.py`** | Cloned Engine | `run_what_if_analysis()` | `WHAT_IF_BRANCH_COMPLETED` | What-If Lab comparative matrix | `tests/test_what_if.py` | **ACTIVE (CANONICAL)** |
| **`backend/services/signal_aspect_engine.py`** | Block reservations | `determine_aspect()` | `SIGNAL_ASPECT_CHANGED` | Color aspect halos & markers | `tests/test_signals.py` | **ACTIVE (CANONICAL)** |
| **`frontend/src/state/OperationalStore.tsx`** | Backend WebSocket / REST | Migration implementation | N/A | Not yet consumed by `App.tsx` | N/A | **INACTIVE / MIGRATION TARGET** |
| **`frontend/src/components/NXPanel/NXTrackCanvas.tsx`** | `OperationalSnapshot` | Camera zoom, train/conflict selection | Triggers `FocusManager` | Dual-scale track rendering | `src/__tests__/nx.test.tsx` | **ACTIVE (CANONICAL)** |
| **`frontend/src/screens/TrafficTheater/TrafficTheaterScreen.tsx`** | `OperationalStore` | Play, Pause, Jump, Scale, Episode | Dispatches simulation commands | Realtime Traffic Theater HUD | `src/__tests__/theater.test.tsx` | **ACTIVE (CANONICAL)** |
| **`frontend/src/components/AIDecisionReviewCenter.tsx`** | `recommendation` | Selects candidate, previews branch, approves | `/api/recommendations/action` | Interactive branch preview | `src/__tests__/ai.test.tsx` | **ACTIVE (CANONICAL)** |
| **`frontend/src/visual/motion.css`** | Motion Engine | CSS Keyframes & Spotlights | N/A | Semantic railway transitions | Build pipeline | **ACTIVE (CANONICAL)** |

---

## 2. Duplicate / Retired Implementations Remediated

1. **`RailwayContext.tsx`**: Cleanly re-exports `OperationalStore` (Zero duplicate WebSocket or polling threads).
2. **`useRealtimeState.ts`**: Subscribes directly to `OperationalStore` state stream.
3. **Signal Derivation**: Removed local client-side fake signal heuristics; all UI components source directly from `SignalAspectEngine` and `snapshot.signals[]`.
4. **Hardcoded Stations**: Not yet removed. `NXTrackCanvas` retains a demo fallback for the optional cinematic; this must be explicitly labelled or removed during runtime migration.
