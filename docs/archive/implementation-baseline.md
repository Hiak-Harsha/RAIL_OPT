# RAILOPT-X 2.0 — Implementation Baseline & Source Audit

**Document Date:** August 29, 2026  
**Auditor / Lead Engineer:** RAILOPT-X Digital Twin Engineering Team  
**Problem Statement:** SIH PS-25022 (Real-Time High-Density Train Dispatch & Conflict Resolution)

---

## 1. End-to-End Source Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             SIMULATION BACKEND                              │
│                                                                             │
│  [RailwaySimulationEngine] (engine.py)                                       │
│    ├── Network Graph (synthetic_section.json)                                │
│    ├── Physics & Interlocking (4-Aspect Signals, TrackBlocks, Stations)     │
│    ├── Train State (WAP-7, WAG-9, MEMU, Maintenance)                         │
│    └── What-If Isolated Cloner (what_if.py)                                 │
│                                                                             │
│  [AI / Prediction / Optimization]                                           │
│    ├── ConflictRadar (conflict_radar.py) — 15m Lookahead                    │
│    ├── CandidateEvaluator (evaluator.py) — J Objective & Physical Branches  │
│    ├── DecisionOrchestrator (decision_orchestrator.py)                       │
│    ├── DecisionExplainer (explainer.py) — Machine-Checkable EvidenceFacts    │
│    └── AuditLogger (audit.py) — Tamper-Evident SHA-256 Chaining             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                        FastAPI & WebSocket Broadcaster
                         (/ws/live, /api/state, /api/topology)
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                             FRONTEND ARCHITECTURE                           │
│                                                                             │
│  [OperationalStore.tsx] — Single Source of Truth                            │
│    ├── Subscribes to /ws/live with monotonic sequence checks                │
│    ├── Owns Trains, Blocks, Signals, Conflicts, Recommendations, KPIs        │
│    ├── Manages User Role (Controller | Supervisor | Admin | Analyst)        │
│    └── Owns Candidate Preview & What-If Branch Isolation                    │
│                                                                             │
│  [Visual & Spatial Rendering Pipeline]                                       │
│    ├── RailTopology.ts — Continuous Edge + sAlongEdgeM to 2D/3D Transform    │
│    ├── NXTrackCanvas.tsx — Macro (435km), Meso (80km), Micro (20km throat)   │
│    ├── StylizedRollingStock.tsx — Semantic LOD 0/1/2 Class Formations       │
│    └── AudioDirector.ts — Spatialized, Velocity-Modulated Sound (Opt-In)     │
│                                                                             │
│  [Operator Control Center (OCCShell.tsx)]                                    │
│    ├── OPERATE Mode — Clean operational dashboard without clutter           │
│    ├── INVESTIGATE Mode — Interactive EvidenceFact spotlighting             │
│    ├── FUTURES Mode — Multi-branch side-by-side comparison                  │
│    └── REPLAY Mode — Cryptographic timeline rewind                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. API Endpoints & WebSocket Event Contracts

| Path | Protocol | Purpose | Payload Summary |
| :--- | :--- | :--- | :--- |
| `/api/health` | GET | Health & clock status | `{"status": "HEALTHY", "sim_time_sec": 0.0, "is_running": true}` |
| `/api/topology` | GET | Static railway network | `TrackTopology` (Stations, Blocks, Signals, Platforms) |
| `/api/state` | GET | Authoritative full snapshot | `OperationalSnapshot` (Trains, Blocks, KPIs, Conflicts, Recs) |
| `/api/control` | POST | Simulation run/pause/reset | `{"action": "START" \| "PAUSE" \| "SET_SCALE", "scale": 1.0}` |
| `/api/decision` | POST | Controller action execution | `{"recommendation_id": "...", "action": "APPROVE" \| "OVERRIDE"}` |
| `/api/disruptions/inject` | POST | Inject physical disruption | `{"type": "SIGNAL_FAILURE", "block_id": "BLK_..."}` |
| `/api/what-if/evaluate` | POST | Evaluate candidate schedules | `DecisionEvaluation` with `compute_J()` scores |
| `/api/branches/{id}/diff` | GET | Compare branch to live twin | `ScenarioMetricsDiff` (delay saved, conflict delta) |
| `/ws/live` | WS | Monotonic stream & deltas | `{"type": "INITIAL_STATE" \| "STATE_UPDATE", "data": ...}` |

---

## 3. UI Control & Surface Wiring Inventory

| UI Surface / Component | Control / Feature | Baseline Status | Source Evidence / Migration Path |
| :--- | :--- | :--- | :--- |
| `OCCShell.tsx` | View Switching (`theater`, `control`, `review`, `what-if`, `analytics`, `audit`) | **Working** | Subscribes to `activeTab` in `OperationalStore` |
| `App.tsx` | Telemetry & Simulation State | **Partly Wired** | Duplicated local `useState` migrated to `OperationalStore` |
| `NXTrackCanvas.tsx` | 2D Track Canvas | **Working** | Consumes topology and trains; upgraded to `RailTopology` projection |
| `NXTrackCanvas.tsx` | Signal Aspects | **Partly Wired** | Was deriving aspects locally; updated to consume authoritative `Signal` entities |
| `NXTrackCanvas.tsx` | Causal Lens Overlay | **Working** | Renders animated SVG causal arcs between contending trains |
| `FutureWorldsOverlay.tsx` | Candidate Schedule Cards | **Partly Wired** | Card buttons wired to `previewCandidate(id)` & `applyCandidate(id)` |
| `LandingCinematic.tsx` | Problem-Story Replay | **Working** | Labeled as `PRESENTATION SCENARIO` with toggle to live replay |
| `RailwayAudioEngine.ts` | Sound Synthesis | **Partly Wired** | Migrated to `AudioDirector` with `public/audio/manifest.json` and strict opt-in |
| `AIDecisionReviewCenter.tsx` | Evidence Fact Spotlight | **Working** | Clickable `EvidenceFact` elements focus conflicting trains/blocks on canvas |

---

## 4. Asset Inventory & Provenance

| Asset Name / Key | Type | License / Source | Size / Polycount | Fallback Strategy |
| :--- | :--- | :--- | :--- | :--- |
| `WAP-7 Express Rake` | 2D/3D Rolling Stock Profile | RAILOPT-X Original / MIT | Vector / Lightweight LOD | Semantic 2D silhouette (`StylizedRollingStock`) |
| `WAG-9 Freight Rake` | 2D/3D Rolling Stock Profile | RAILOPT-X Original / MIT | Vector / Lightweight LOD | Box wagon formation silhouette |
| `MEMU Commuter Unit` | 2D/3D Rolling Stock Profile | RAILOPT-X Original / MIT | Vector / Lightweight LOD | 3-car EMU silhouette |
| `Track Maintenance Vehicle` | 2D/3D Rolling Stock Profile | RAILOPT-X Original / MIT | Vector / Lightweight LOD | Utility yellow consist |
| `rail_rumble_loop` | Audio Ambience | CC0 Public Domain / Synthetic | 128 kbps / Seamless | Low-pass Web Audio noise generator |
| `relay_click_oneshot` | Audio Infrastructure | CC0 Public Domain / Synthetic | 64 kbps / 40 ms | Biquad relay click synthesizer |
| `warning_horn_oneshot` | Audio Alert | CC0 Public Domain / Synthetic | 128 kbps / 350 ms | Dual-tone sine oscillator fallback |

---

## 5. Baseline Limitations & Verification

- **Baseline Tests**: 56 passed, 2 skipped across optimization, safety invariants, physics, and Golden Episode integration.
- **Identified Defect 1 (Resolved)**: `LOOP_PRECEDENCE` was previously simulated as a plain delay hold; now validated via explicit `LoopPrecedenceAction` route allocation.
- **Identified Defect 2 (Resolved)**: `src/App.tsx` owned redundant WebSocket and state hooks; now unified into `OperationalStore.tsx`.
