# RAILOPT-X — Autonomous Railway Traffic Flow Optimization & Live OCC

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r185-black?logo=three.js&logoColor=white)](https://threejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![OR-Tools](https://img.shields.io/badge/Google-OR--Tools-4285F4?logo=google&logoColor=white)](https://developers.google.com/optimization)
[![Tests](https://img.shields.io/badge/Tests-112%20Passed-brightgreen)](tests/)

> **Next-Generation Railway Operations Control Center (OCC) Digital Twin** uniting deterministic discrete-event physics, Google OR-Tools CP-SAT mathematical optimization, hardware-accelerated 3D WebGL visualization with first-person driver cab views, and explainable AI dispatch support.

---

## 📸 Application Preview & Visual Interface

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  RAILOPT-X OCC CONSOLE  •  NEW DELHI (NDLS) ── KANPUR CENTRAL (CNB)  [435 KM CORRIDOR]       │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│   [ 3D HARDWARE DIGITAL TWIN & DRIVER'S CAB POV ]                                            │
│   ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│   │  [CAM: CAB POV] [FOLLOW TRAIN] [360° ORBIT] [FLYTHROUGH]          [CAB: 22436 VB]     │   │
│   │                                                                                      │   │
│   │       ══════════════╦═══════════════════════╦═══════════════                         │   │
│   │                     ║  [● GREEN]            ║  [● RED]                               │   │
│   │    ►► [LOCO WAP-7]  ╩═══════════════════════╩═══════════════                         │   │
│   │                                                                                      │   │
│   │   [CAB SPEED: 130.0 km/h] [BLOCK: BLK_GZB_04] [ASPECT: CLEAR]                        │   │
│   └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                              │
│   [ MODULAR 2D INTERLOCKING SCHEMATIC & TIME-DISTANCE GANTT ]                                 │
│   NDLS (KM 0) ─────── GZB (KM 28) ─────── ALJN (KM 131) ════ TDL (KM 209) ─────── CNB (435)  │
│    ├── UP Main (130 km/h)  ───► [12004 SHTB] ───► [22436 Vande Bharat]                       │
│    └── Single-Line Section ════ [CONVERGING CONFLICT DETECTED: -41.8m DELAY PREVENTED]       │
│                                                                                              │
│   [ EXPLAINABLE AI DECISION REVIEW (WHYPANEL) ]                                              │
│   ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│   │  WHY: Priority train P1 (22436) converging with P3 freight on single-line section.   │   │
│   │  WHAT: Hold Freight at Loop Block 14 for 180s. Mainline clear for Vande Bharat.      │   │
│   │  HOW: CP-SAT mathematical solver verified 0 invariant violations • Saved 41.8 mins.  │   │
│   └──────────────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌟 Core Features & Capabilities

### 1. 🎮 3D Hardware Digital Twin & Driver Cab Perspective
- **Three.js WebGL Engine (`render3d/`)**: Real-time rendering of trackbeds, ballast, concrete sleepers, steel running rails, turnout switches, and OHE catenary masts.
- **Driver `CAB_POV` Mode**: Immersive first-person view from inside the locomotive cab with speed vibrations and telemetry HUD.
- **Dynamic Camera Director**: Seamless switching between `CAB_POV`, `FOLLOW_TRAIN`, `360° ORBIT`, `FLYTHROUGH`, and `OVERVIEW`.
- **Physical Rolling Stock Consists**: High-intensity forward headlight beams, state-driven red rear brake lights, flashing amber roof hazard beacons on held trains, and platform passenger boarding indicators.
- **3D Multi-Aspect Signal Billboard**: Physical 4-aspect signal masts with live LED aspect lenses and directional illumination.

### 2. 🗺️ High-Performance 2D Modular Interlocking Canvas
- **7-Layer SVG Architecture**: Clean separation between `TrackLayer`, `SignalLayer`, `TrainLayer`, `ConflictOverlay`, `LabelLayer`, `AttentionEngine`, and `DecisionRipple`.
- **Dynamic Level-of-Detail (LOD)**: Smoothly transitions from macro corridor overviews (0–435 km) to micro interlocking station throat layouts (<15 km).
- **Collision-Free Label Management**: Dynamic 1D/2D spatial sorting prevents text overlap on dense station trackage.

### 3. 🧠 Mathematical Optimization & Explainable AI (XAI)
- **Google OR-Tools CP-SAT Optimizer**: Formulates corridor traffic dispatch as an exact constraint satisfaction and scheduling problem.
- **`WhyPanel` (WHY $\to$ WHAT $\to$ HOW)**: Translates solver equations into transparent, human-readable operational rationales.
- **Counterfactual Alternative Comparison**: Evaluates and displays competing dispatch options (*"Why not hold the other train?"*).
- **Deterministic Conflict Radar**: 15-minute predictive lookahead for headway contentions, station platform conflicts, and single-line bottlenecks.

### 4. 🎙️ Spatial Railway Audio & Spoken PA Voiceover
- **Camera-Relative Spatial Panning (`AudioSpatializer.ts`)**: Left/right stereo panning and inverse-distance attenuation based on camera focus.
- **Real Mechanical Cues**: Relay clicks, route-locking chimes, teleprinter chatter, and class-specific locomotive audio loops.
- **Dynamic Web Speech Dispatcher Alerts**: Discrete, spoken PA announcements with phonetic train callsigns and automatic audio ducking.

### 5. 🛡️ Role-Based Access Control (RBAC) & SHA-256 Audit Trail
- **4 Dedicated Roles**: Section Controller, Chief Controller, Safety Auditor, and Station Master.
- **Cryptographic Audit Ledger**: Every recommendation approval, rejection, or manual override is sealed in a SHA-256 tamper-evident hash chain.

### 6. 🎬 Interactive Cinematic Landing Experience
- **6 Interactive Story Beats**: Normal Flow $\to$ Bottleneck $\to$ Conflict Radar $\to$ Crisis $\to$ CP-SAT Solver $\to$ Solution Proof.
- **Side-by-Side Outcome Proof**: Before vs After metric comparison card proving cascading delay prevention.

---

## 🏗️ System Architecture

```
                                    RAILOPT-X PLATFORM
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
       FASTAPI BACKEND              OR-TOOLS CP-SAT              REACT 19 FRONTEND
    ┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
    │ Discrete-Event Sim   │     │ Constraint Optimizer │     │ 3D WebGL Digital Twin│
    │ Kinematic Physics    │◄───►│ Exact Interval Sched │◄───►│ 2D Interlocking SVG  │
    │ 4-Aspect Signaling   │     │ Counterfactual Search│     │ WhyPanel (XAI)       │
    │ RBAC Authorization   │     │ Deterministic CSP    │     │ Spatial Audio Engine │
    └──────────────────────┘     └──────────────────────┘     └──────────────────────┘
               │                                                         │
               └─────────────────────── WebSocket /ws/live ──────────────┘
                                    (10 Hz Telemetry Stream)
```

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend Framework** | React 19, TypeScript, Vite 8, Tailwind CSS v4 |
| **3D Graphics Engine** | Vanilla Three.js r185 (WebGL, Custom Shaders & Lighting) |
| **Audio Processing** | Web Audio API (`AudioSpatializer`, `StereoPannerNode`), Web Speech API |
| **Backend API** | FastAPI, Uvicorn, WebSockets |
| **Mathematical Solver**| Google OR-Tools (CP-SAT Constraint Programming Solver) |
| **Simulation Core** | Python 3.11+ Discrete-Event Kinematic Engine |
| **Icons & Design** | Lucide React, Space Grotesk & JetBrains Mono Typography |
| **Deployment** | Vercel (Frontend), Docker (Full Stack Containerization) |

---

## 🚀 Quick Start & Local Execution

### Prerequisites
- **Node.js**: v18.0 or higher
- **Python**: v3.10 or higher
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/Hiak-Harsha/RAIL_OPT.git
cd RAIL_OPT
```

### 2. Start Backend Simulator
```bash
# Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Launch FastAPI Server on port 8000
python -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start Frontend Dashboard
```bash
# In a new terminal window:
npm install
npm run dev
```

Open **[`http://localhost:5173`](http://localhost:5173)** in your browser.

---

## 🌐 Deploy to Vercel (1-Click Deployment)

This repository includes [`vercel.json`](vercel.json) pre-configured for instant deployment:

1. Go to **[vercel.com/new](https://vercel.com/new)**.
2. Select and import **`Hiak-Harsha/RAIL_OPT`**.
3. Click **Deploy**. Vercel will build and launch your production site with automated SSL and global CDN.

---

## 🧪 Test Suite & Verification

The system includes automated tests covering physics, CP-SAT optimization, RBAC, and UI:

```bash
# Run backend test suite (112 test cases)
pytest tests/ -v

# Run frontend type-checking and production build
npm run build
```

- **Backend Status**: `112 / 112 passed (100%)`
- **Frontend Status**: `0 errors, production bundle generated cleanly`

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👥 Contributors & Acknowledgements

Developed for the **Smart India Hackathon (SIH)** — Problem Statement **25022**.  
Dedicated to modernizing high-density railway corridor operations through autonomous intelligence and safety-first human-in-the-loop dispatch.
