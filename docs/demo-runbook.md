# RAILOPT-X 2.0 — Evaluator Demonstration Runbook
**SIH PS-25022: Intelligent Real-Time Train Traffic Controller & Digital Twin**

---

## 1. Quick Start & Launch Instructions

### Prerequisites
- Python 3.11+ with `.venv` installed
- Node.js 18+ and npm

### Starting the Servers
1. **Backend Server** (FastAPI at `http://127.0.0.1:8000`):
   ```bash
   .\.venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 127.0.0.1 --port 8000
   ```
2. **Frontend UI** (Vite at `http://127.0.0.1:5173`):
   ```bash
   npm run dev
   ```
3. Open `http://127.0.0.1:5173` in your web browser.

---

## 2. 6-Step Golden Demonstration Script

The top navigation ribbon contains a 1-click **DEMO** orchestrator buttons: `[1. Normal]`, `[2. Disrupt]`, `[3. Radar]`, `[4. CP-SAT]`, `[5. What-If]`, `[6. Benchmark]`.

### Step 1: Nominal Corridor Digital Twin (`1. Normal`)
- **Action**: Click `1. Normal` or press `Space` to run simulation.
- **Observable Twin Behavior**:
  - The live corridor displays active train movements across the 435km section from New Delhi (NDLS) to Kanpur (CNB).
  - Vande Bharat Express (`T22436`), Gomti Express (`T12420`), and Freight rake (`T04403`) move with authentic tractive physics and 4-aspect signal interlocking.
  - Punctuality OTP is 100%, and Section Traffic Status reads `NOMINAL TIMETABLE FLOW`.

### Step 2: Injected Disruption (`2. Disrupt`)
- **Action**: Click `2. Disrupt` in the header ribbon.
- **Observable Twin Behavior**:
  - Injects a severe 15-minute traction disturbance (OHE overhead line voltage sag) on `T22436`.
  - Train speed drops and delay begins accumulating.
  - Section state transitions to `DEGRADED (1 DISRUPTIONS ACTIVE)`.

### Step 3: Proactive Conflict Radar (`3. Radar`)
- **Action**: Click `3. Radar` (or press `O` to open Decision Review).
- **Observable Twin Behavior**:
  - Conflict Radar scans 15 minutes ahead into the corridor.
  - Detects a bottleneck conflict at Aligarh single-line junction (`BLK_ALJN_TDL_SINGLE`).
  - Radar highlights the involved trains and displays time-to-conflict with zero artificial alarmism.

### Step 4: CP-SAT Optimization & Decision Review (`4. CP-SAT`)
- **Action**: Click `4. CP-SAT`.
- **Observable Twin Behavior**:
  - Google OR-Tools CP-SAT solver evaluates possible dispatch actions (Hold in Loop vs Mainline Run-through).
  - Generates recommended decision: Divert freight train `T04403` into `BLK_ALJN_LOOP_UP` for 240 seconds to grant precedence to high-priority express `T22436`.
  - Displays mathematical objective score $J$, evaluation horizon (1800s), and counterfactual options.
  - Click `APPROVE DISPATCH ACTION`: The loop routing action is cryptographically signed and executed in the physical interlocking.

### Step 5: What-If Sandbox Laboratory (`5. What-If`)
- **Action**: Click `5. What-If` in the Command Rail or header.
- **Observable Twin Behavior**:
  - Spins up parallel simulation clones comparing **Baseline FCFS**, **Priority Heuristic**, and **CP-SAT Optimum**.
  - Visualizes projected delay savings ($\ge 5.4$ min) and conflict prevention with zero mutation of the live operational twin.

### Step 6: Full Benchmark Suite & Audit Ledger (`6. Benchmark`)
- **Action**: Click `6. Benchmark` and navigate to `Audit Ledger`.
- **Observable Twin Behavior**:
  - Comprehensive benchmark suite validates safety invariants: **0 Headway Violations**, **0 Block Collisions**.
  - Audit Ledger verifies SHA-256 tamper-evident hash chain integrity: `CHAIN INTEGRITY VERIFIED (TAMPER: NONE)`.

---

## 3. Global Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Ctrl + K` / `Cmd + K` | **Command Palette** | Instant search for any train, block, conflict, or command |
| `Space` | **Toggle Simulation** | Play / Pause discrete-event physics engine |
| `R` | **Reset Simulation** | Reset corridor to nominal T+0s initial state |
| `O` / `A` | **Decision Review** | Jump directly to active AI dispatch recommendation |
| `W` | **What-If Lab** | Jump to sandbox multi-branch scenario comparison |
| `Esc` | **Clear Selection** | Deselect active entity |
