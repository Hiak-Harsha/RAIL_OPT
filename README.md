# RAILOPT-X 2.0 — Railway Operations Intelligence Studio

**Smart India Hackathon (SIH) — Problem Statement 25022**  
*Next-Generation High-Density Corridor Dispatch Support & Real-Time Conflict Resolution*

---

## 🚆 System Architecture & Product Surfaces

RAILOPT-X 2.0 transforms conventional railway dispatch dashboards into an **Interactive Operational Digital Twin** uniting deterministic optimization, digital twin branch execution, explainable AI, and cryptographic auditability.

```
                                  RAILOPT-X 2.0
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
             TRAFFIC WORLD        FUTURE WORLDS          AI COMMAND
             (Live Twin)         (Branching Twin)       (XAI Review)
                    │                    │                    │
                    └────────────────────┼────────────────────┘
                                         ▼
                                REPLAY & PERFORMANCE
```

### 1. Traffic World (Living Digital Twin)
- **Local Viewport Window (60–100 km)**: Eliminates 435km spatial compression with dynamic local coordinate reprojection.
- **Corridor Minimap**: Full NDLS ── CNB overview strip with click-to-jump window navigation.
- **4-Aspect Signaling Engine**: Physically verified aspect progression (`GREEN → DOUBLE_YELLOW → YELLOW → RED`).
- **Kinematic Train Signatures**: Length-scaled rakes, acceleration wakes, target-speed ribbons, and braking countdown zones.
- **"WHY IS THIS TRAIN WAITING?"**: Direct interactive breakdown of operational hold causes with click-to-locate navigation.

### 2. Future Worlds (Physical Branching Simulation)
- **Multi-Factor Scenario Composer**: Inject simultaneous disruptions (`SIGNAL_FAILURE`, `PLATFORM_UNAVAILABLE`, `WEATHER_RESTRICTION`, `BLOCK_CLOSURE`).
- **Physical Twin Validation**: Clones the running simulation engine to execute branches physically without metric clamping.
- **Side-by-Side Comparison**: Status Quo FCFS vs Priority Heuristic vs RAILOPT-X CP-SAT Optimal.

### 3. AI Command & Decision Review
- **15-Minute Lookahead Conflict Radar**: Proactively predicts crossing overlaps and headway contentions.
- **OR-Tools CP-SAT Optimizer**: Computes mathematically optimal dispatch schedules.
- **Candidate Physical Evaluator**: Validates strict safety invariants across all candidate branches.
- **Clickable AI Evidence Facts**: Machine-checkable `EvidenceFact` elements that frame involved trains/blocks on the NX canvas upon clicking.
- **Safety Gating**: If all candidate branches violate safety invariants, the system emits `MANUAL_INTERVENTION_REQUIRED` with a dedicated red override panel rather than displaying an invalid recommendation.

### 4. Cryptographic Replay & Audit
- **SHA-256 Hash Chaining**: Every controller decision and manual override rationale is permanently sealed into an immutable audit ledger.

---

## 🚀 Running the Project

### A. Fast Development Mode (Recommended for Hot-Reloading)

```powershell
# 1. Start Backend API
.venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 --reload

# 2. In a separate terminal, start Frontend (Vite)
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### B. Docker Production Deployment

```powershell
# Build and run backend + frontend services
docker compose down
docker compose build --no-cache
docker compose up -d
```

Open `http://localhost:3000` in your browser.

---

## 🧪 Testing & Verification

### Backend Automated Test Suite
```powershell
.venv\Scripts\python.exe -m pytest tests/ -v
```
- **56 Passed, 2 Skipped** (58 total tests covering OR-Tools CP-SAT, closed-loop candidate evaluation, physics, runtime interlocking, and Episode 03 Golden Episode end-to-end integration).

### Frontend Production Build
```powershell
npm run build
```
- **0 errors**.

### Documentation & Artifact Validation
```powershell
.venv\Scripts\python.exe scripts/validate_docs.py
```

---

## 📦 Packaging & Artifact Gate
```powershell
.venv\Scripts\python.exe scripts/package_zip.py
```
- Verifies a 10-point Artifact Gate ensuring complete inclusion of `src/`, `backend/`, `tests/`, `docs/`, `Dockerfile.frontend`, `pytest.ini`, and valid POSIX paths.

Generates canonical [`RAILOPT_X_SIH_PS_25022.zip`](file:///c:/Users/madha/Desktop/SIH_PS_25022/RAILOPT_X_SIH_PS_25022.zip) and timestamped release archives.
