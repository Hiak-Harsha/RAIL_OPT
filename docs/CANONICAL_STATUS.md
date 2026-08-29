# RAILOPT-X — Canonical Capability Status & Ground Truth Baseline
**Baseline Established:** August 29, 2026  
**Reference Documents:** `docs/AUDIT_AND_DELIVERY_2026-08-26.md`, `docs/feature-contract-audit.md`, `docs/requirements-matrix.md`, `docs/master-audit.md`, `docs/verification-report.md`, `README.md`

---

## 1. Ground Truth & Provenance Constraints

Per the honesty standard established in `docs/AUDIT_AND_DELIVERY_2026-08-26.md`, the following claims are explicitly scoped:

| Claim | Ground Truth Reality | Canonical Descriptor |
| :--- | :--- | :--- |
| **"Geographic Railway Track Map"** | The track display is an SVG schematic projection derived from linear block progression and line class, not surveyed GIS/GPS coordinates. | **Schematic Operational View** |
| **"Authentic / Real Recorded Train Audio"** | Real locomotive stems and interlocking audio loops are packaged and played via Web Audio API with stereo spatial panning relative to camera position (`AudioSpatializer.ts`). Spoken PA dispatch uses the Web Speech API with automatic synthesis recovery and audio ducking. | **Asset-Driven & Spatially-Panned Audio Engine** |
| **"Real-Time Physical Accuracy"** | Discrete-event kinematic model (acceleration, deceleration, gradient resistance, interlocking block occupancy, headway separation). It is an operational traffic simulator, not an engineering-grade finite-element locomotive dynamics simulator. | **Discrete-Event Railway Traffic & Interlocking Simulator** |
| **"OR-Tools CP-SAT"** | Uses Google OR-Tools CP-SAT discrete-interval formulation with deterministic CSP heuristic fallback when solver is unavailable or times out. Provenance is transparently tagged in response payload. | **CP-SAT Interval Scheduler with CSP Fallback** |

---

## 2. Capability Status Matrix

### Legend
- `VERIFIED-LIVE`: Personally executed, tested, and traced in running code and passing test suites in this environment.
- `VERIFIED-DOC-ONLY`: Documented in previous baseline docs, functional in codebase, but not yet individually re-exercised in this live session.
- `CONTRADICTED`: Inconsistent between docs/UI and backend implementation, or broken in live execution.

---

### Core Simulation & Interlocking
| Capability | Stated Source / Endpoint | Status | Evidence / Finding |
| :--- | :--- | :--- | :--- |
| Discrete-Event Tick Physics | `backend/simulator/engine.py` (`tick`) | `VERIFIED-LIVE` | 112 pytest suite passing, deterministic fast-forward verified. |
| Loop Precedence Physical Movement | `engine.py` (`apply_controller_action`) | `VERIFIED-LIVE` | `test_loop_precedence_physical.py` & `test_loop_precedence_routing.py` pass. |
| 4-Aspect Signal Propagation | `engine.py` (`_update_signals`) | `VERIFIED-LIVE` | Aspect progression tested in `test_signals_and_dwell.py`. |
| Discrete Disruptions Injection | `POST /api/disruptions` | `VERIFIED-LIVE` | `test_disruptions.py` passes with block closure & train breakdown. |
| Dynamic Train Entry by Timetable | `engine.py` (`_update_train`) | `VERIFIED-LIVE` | Schedule activation verified in `test_simulation_truth.py`. |

---

### Explainability & AI Optimization
| Capability | Stated Source / Endpoint | Status | Evidence / Finding |
| :--- | :--- | :--- | :--- |
| Train Hold Wait Reasons | `backend/simulator/railway/wait_reason.py` | `VERIFIED-LIVE` | Structured `WaitReason` model with severity, rendered live by `WhyPanel.tsx` in `ContextInspector`. |
| Conflict Explanations | `backend/domain/conflict_explanation.py`, `conflict_radar.py` | `VERIFIED-LIVE` | Typed `ConflictExplanation` with mathematical root causes and candidate resolution tradeoffs verified by `tests/ai/test_conflict_explanation.py`. |
| Recommendation Rationales | `backend/domain/conflict_explanation.py`, `WhyPanel.tsx` | `VERIFIED-LIVE` | Typed `RecommendationRationale` and unified `WhyPanel.tsx` component integrated across `AIDecisionReviewCenter.tsx`, `RecommendationDrawer.tsx`, and `ContextInspector.tsx`. |
| Google OR-Tools CP-SAT Solver | `backend/optimizer/solvers/cpsat_solver.py` | `VERIFIED-LIVE` | `test_small_network_cpsat.py` passes; fallback transparently reports CSP status. |
| Conflict Lookahead Radar | `backend/ai/prediction/conflict_radar.py` | `VERIFIED-LIVE` | 15-minute lookahead tested in `test_prediction_and_xai.py`. |

---

### Security, Roles & Governance
| Capability | Stated Source / Endpoint | Status | Evidence / Finding |
| :--- | :--- | :--- | :--- |
| Role Selection Context | `src/services/permissions.ts` | `VERIFIED-LIVE` | 4 roles defined with 8-action matrix synchronized with backend. |
| Frontend Role UI Gating | `src/App.tsx`, `OCCHeader.tsx` | `VERIFIED-LIVE` | All actions gated with required-role tooltips matching `ROLE_PERMISSIONS`. |
| Backend Authorization Enforcement | `backend/services/rbac.py`, `app.py` | `VERIFIED-LIVE` | Authoritative `enforce_permission()` guards all mutating/privileged routes; verified by `tests/api/test_rbac_enforcement.py` (5/5 passed). |
| SHA-256 Hash Chained Audit Trail | `backend/services/audit.py` | `VERIFIED-LIVE` | `test_persisted_audit_fixture.py` passes; live `/api/audit/verify` returns `is_tamper_free: true` for all 223 entries. |

---

### Digital Twin, UI & Audio Experience
| Capability | Stated Source / Endpoint | Status | Evidence / Finding |
| :--- | :--- | :--- | :--- |
| Authoritative Shared Corridor Topology | `src/visual/topology/CorridorGraph.ts` | `VERIFIED-LIVE` | Single source of truth for both 2D and 3D renderers, parsed dynamically from backend TrackBlock[] and Station[] models without arbitrary box literals. Verified by `tests/test_corridor_graph_topology.py`. |
| 2D Interlocking Multi-Layer Engine | `src/visual/render2d/NXTrackCanvas2D.tsx` | `VERIFIED-LIVE` | Modular layer separation (`TrackLayer`, `SignalLayer`, `TrainLayer`, `ConflictOverlay`, `LabelLayer`) with dynamic LOD & 1D/2D label collision avoidance. |
| 3D Digital Twin Stage (WebGL) | `src/visual/render3d/DigitalTwin3DStage.tsx`, `RollingStock3DCanvas.tsx` | `VERIFIED-LIVE` | Hardware-accelerated Three.js pipeline (`SceneManager`, `TrackBuilder`, `SignalBillboard`, `TrainRenderer`, `CameraDirector`) featuring Driver CAB_POV first-person view, follow, orbit, live signals, and state-driven brake/beacon/door postures. |
| Spatial Railway Audio Engine | `src/audio/RailwayAudioEngine.ts`, `AudioSpatializer.ts` | `VERIFIED-LIVE` | Real locomotive audio loops with stereo panning and distance attenuation relative to active camera position, and automatic audio ducking during dispatcher speech synthesis. |
| Dynamic Voiceover Engine | `src/audio/VoiceOverEngine.ts`, `useSimulationAudio.ts` | `VERIFIED-LIVE` | Chromium GC-proof utterance retention, English voice auto-selection, auto-resume watchdog, and discrete conflict alert PA synthesis with phonetic callsigns. |
| Interactive Landing Cinematic | `src/screens/LandingCinematic/LandingCinematic.tsx` | `VERIFIED-LIVE` | 6 interactive story beat navigation jumps, audio unlock CTA banner, expanded 450px track stage, and Before vs After comparison proof card. |
| Split-Flap KPI Rail | `src/components/SplitFlap/SplitFlapRail.tsx` | `VERIFIED-LIVE` | Mechanical split-flap animation with live KPI data binding. |
| WebSocket Telemetry Stream | `backend/websocket/server.py` (`/ws/live`) | `VERIFIED-LIVE` | `test_ws_live_contract.py` passes (10Hz telemetry updates). |
| Command Palette | `src/components/CommandPaletteModal.tsx` | `VERIFIED-LIVE` | Keyboard shortcut `Ctrl+K` triggers search and entity selection. |

---

## 3. Test & Verification Summary
- **Python Backend Test Suite**: **112 / 112 passed (100%)** via `.venv\Scripts\pytest.exe`.
- **Frontend Type-Check & Production Build**: **`tsc -b && vite build` passed (0 errors)**.
- **Latest Archive**: `C:\Users\madha\Downloads\RAILOPT_X_SIH_PS_25022_RESTORED_FINAL_v3.zip` (0.67 MB, 253 clean files).
