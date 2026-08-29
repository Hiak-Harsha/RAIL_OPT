# RAILOPT-X 2.0 — Remediation Baseline & Source Audit
**SIH Problem Statement PS-25022: Intelligent Real-Time Train Traffic Controller & Digital Twin**
**Audit Timestamp:** 2026-08-29T01:05:00+05:30

---

## 1. End-to-End Data Path Audit

```text
backend simulator/network/interlocking (backend/simulator/engine.py)
   ↳ FastAPI state/topology endpoints + /ws/live (backend/api/app.py)
      ↳ frontend canonical store (src/state/OperationalStore.tsx)
         ↳ renderer/camera/audio/UI actions (src/components/OCC/, src/visual/, src/audio/)
```

---

## 2. Evidence-Based Audit of 9 Specific Statements

### Statement 1: `App.tsx` Phase Initialization
- **Statement**: `src/App.tsx` starts with `appPhase = "occ"`, so `LandingCinematic` is not a landing experience. Reachable only via command palette.
- **Source Evidence**: [`src/App.tsx`](file:///c:/Users/madha/Desktop/RAILOPT_X_SIH_PS_25022_enhanced/src/App.tsx#L31):
  ```typescript
  const [appPhase, setAppPhase] = useState<"cinematic" | "coldOpen" | "occ">("occ");
  ```
- **Status**: **CONFIRMED (working as authored, but misses first-run landing discoverability)**.
- **Remediation Plan**: Introduce a persistent first-run landing choice modal:
  `[Watch 75-second problem story] [Enter live operations] (Remember my choice; replay in header)`.

---

### Statement 2: `LandingCinematic.tsx` Data Source
- **Statement**: `LandingCinematic.tsx` plays `src/data/gridlockSequence.ts`, a 20-second authored fixture not sourced from the live simulator.
- **Source Evidence**: [`src/screens/LandingCinematic/LandingCinematic.tsx`](file:///c:/Users/madha/Desktop/RAILOPT_X_SIH_PS_25022_enhanced/src/screens/LandingCinematic/LandingCinematic.tsx#L2):
  ```typescript
  import { GRIDLOCK_KEYFRAMES, resolveFrameAt, type SequenceFrame } from "../../data/gridlockSequence";
  ```
- **Status**: **CONFIRMED (fixture only)**.
- **Remediation Plan**: Clearly label `gridlockSequence` as `PRESENTATION SCENARIO`, and support live replay mode driven by backend simulation episode playback.

---

### Statement 3: `gridlockSequence.ts` Solver Claim
- **Statement**: `gridlockSequence.ts` contains curated candidate plans and labels one `RAILOPT-X Optimal`; it must never be portrayed as live CP-SAT evidence.
- **Source Evidence**: [`src/data/gridlockSequence.ts`](file:///c:/Users/madha/Desktop/RAILOPT_X_SIH_PS_25022_enhanced/src/data/gridlockSequence.ts#L105-L115):
  ```typescript
  { id: "P3_CPSAT", name: "RAILOPT-X Optimal", strategy: "Dynamic Precedence + 4-min Loop Hold", ... }
  ```
- **Status**: **CONFIRMED (fixture only, needs truthful wording)**.
- **Remediation Plan**: Relabel fixture candidate to `Presentation Scenario Optimum` and enforce that `BEST EVALUATED PLAN` is reserved exclusively for live evaluated backend branches with solver timestamp, horizon, and objective score $J$.

---

### Statement 4: Duplicate State & Transport Architecture
- **Statement**: `src/App.tsx` maintains its own fetch/WebSocket/polling/state while `src/main.tsx` also mounts `OperationalStoreProvider`.
- **Source Evidence**: [`src/App.tsx`](file:///c:/Users/madha/Desktop/RAILOPT_X_SIH_PS_25022_enhanced/src/App.tsx#L33-L49,L240-L399) defines parallel `useState` hooks for `trains`, `blocks`, `kpis` and parallel `new WebSocket(WS_BASE)`.
- **Status**: **CONFIRMED (partly working, duplicate architecture)**.
- **Remediation Plan**: Eliminate duplicate WebSocket and state holders in `App.tsx`; consume canonical `useOperationalStore()`.

---

### Statement 5 & 6: Audio Pipeline & Assets
- **Statement**: `public/audio` contains only `manifest.json`; `RailwayAudioEngine.ts` references missing `/audio/*.ogg` paths; `AudioDirector.ts` is procedural oscillator synth.
- **Source Evidence**: [`src/audio/RailwayAudioEngine.ts`](file:///c:/Users/madha/Desktop/RAILOPT_X_SIH_PS_25022_enhanced/src/audio/RailwayAudioEngine.ts#L6-L13):
  ```typescript
  const ASSETS: Record<Cue, string> = { relay: "/audio/relay-click.ogg", alert: "/audio/controller-alert.ogg", ... };
  ```
- **Status**: **CONFIRMED (partly working, procedural fallback active, audio files missing)**.
- **Remediation Plan**: Bundle authentic, clean, lightweight audio samples (`.ogg`/`.mp3`) in `public/audio/`, update `AudioDirector.ts` to subscribe directly to `OperationalStore`, and test audio decoding in CI.

---

### Statement 7: 3D Train Models & glTF Pipeline
- **Statement**: `package.json` has no Three.js or model loader; `public` has no `.glb`/`.gltf` model assets. `StylizedRollingStock.tsx` is an SVG fallback.
- **Source Evidence**: [`package.json`](file:///c:/Users/madha/Desktop/RAILOPT_X_SIH_PS_25022_enhanced/package.json#L12-L30) lacks `@react-three/fiber` / `three`.
- **Status**: **CONFIRMED (partly working with 2D SVG fallback, 3D glTF pipeline missing)**.
- **Remediation Plan**: Add Three.js / lightweight WebGL model pipeline with low-poly `.glb` models in `public/models/` for Micro LOD, preserving `StylizedRollingStock.tsx` as fast 2D fallback.

---

### Statement 8: Geometry & Topology Mapping
- **Statement**: `RailTopology.ts` and `TrackGeometryGraph.ts` use fixed `Y_UP_MAIN`, `Y_UP_LOOP`, etc.
- **Source Evidence**: [`src/visual/TrackGeometryGraph.ts`](file:///c:/Users/madha/Desktop/RAILOPT_X_SIH_PS_25022_enhanced/src/visual/TrackGeometryGraph.ts#L27-L31) and [`src/visual/RailTopology.ts`](file:///c:/Users/madha/Desktop/RAILOPT_X_SIH_PS_25022_enhanced/src/visual/RailTopology.ts#L48-L52).
- **Status**: **CONFIRMED (partly working with lane projection)**.
- **Remediation Plan**: Map geometry directly from backend track network graph with continuous centerlines and turnout tangents.

---

### Statement 9: Loop Precedence Physical Interlocking
- **Statement**: `engine.apply_controller_action()` uses fallback search and immediate relocation without complete interlocking proof.
- **Source Evidence**: [`backend/simulator/engine.py`](file:///c:/Users/madha/Desktop/RAILOPT_X_SIH_PS_25022_enhanced/backend/simulator/engine.py#L210-L235).
- **Status**: **CONFIRMED (partly working)**.
- **Remediation Plan**: Validate approach edge connectivity, loop capacity, switch lock state, and signal authority before loop entry.

---

## 3. Feature Readiness Matrix

| Feature Subsystem | Status | User-Visible Route to Exercise |
| :--- | :--- | :--- |
| **Discrete Physics Simulation** | `working` | OCC Top Bar `[Play/Pause]`, `[1. Normal]` |
| **Conflict Radar (Lookahead)** | `working` | Top Ribbon `[3. Radar]`, `AIDecisionReviewCenter` |
| **CP-SAT Optimizer & Scoring** | `working` | Top Ribbon `[4. CP-SAT]`, `AIDecisionReviewCenter` |
| **SHA-256 Audit Ledger** | `working` | Navigation Rail `[Audit Log]` |
| **What-If Isolated Branch Clones** | `working` | Navigation Rail `[What-If Lab]` |
| **Landing Problem Story** | `partly working` | Command Palette (`Ctrl+K`) $\rightarrow$ `action_cinematic_replay` |
| **Loop Precedence Interlocking** | `partly working` | Review Center `[Approve Dispatch Action]` |
| **3D Rolling Stock Pipeline** | `partly working` (2D SVG) | NX Track Canvas (LOD 0/1/2) |
| **Authentic Railway Sound** | `partly working` (Procedural) | OCC Header Audio Toggle |
| **Unified Store Architecture** | `partly working` | `OperationalStore.tsx` |
