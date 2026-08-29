# RAILOPT-X — Known Limitations & Architectural Boundaries

This document provides an honest, rigorous specification of the current operational boundaries and architectural scope of RAILOPT-X (SIH PS-25022).

---

## 1. Track Layout & GIS Cartography
- **Schematic Representation**: The 2D NX track overview and 3D rolling stock views render an operational schematic diagram with true kilometer chainages and topology links, rather than a georeferenced GIS map.
- **Corridor Scope**: Optimized specifically for the New Delhi (NDLS) to Kanpur Central (CNB) 435-kilometer high-density railway corridor, featuring the double-line mainline, station loops, and the Aligarh–Tundla single-line bottleneck section.

---

## 2. Audio Synthesis
- **Procedural Web Audio Engine**: Audio cues (relay clicks, acoustic track hum, teleprinter rattle, alert chirps, horn blasts) are generated procedurally via the Web Audio API (`OscillatorNode`, `BiquadFilterNode`, `GainNode`) and synchronized to state machine transitions, supplemented by optional fallback audio assets.

---

## 3. Optimization & Solver Fallback
- **Primary Solver**: Google OR-Tools CP-SAT discrete-interval scheduler with strict headway, block occupancy, and priority constraints.
- **Fallback Behavior**: If Google OR-Tools is not installed or the CP-SAT solve window exceeds deadline, the system automatically falls back to the pure-Python CSP interval scheduler (`CPSATScheduler._solve_fallback_csp()`), logging the solver status transparently without fabrication.

---

## 4. Scalability Limits
- **Real-Time Physics Horizon**: The continuous physics engine (`RailwaySimulationEngine.tick()`) updates train positions, braking curves, and 4-aspect signal progressions at 1.0s to 10.0s time scale for up to 50 active trains concurrently with <10ms tick latency.
- **Lookahead Prediction**: The Conflict Radar scans 15 minutes (900 seconds) into the future using deterministic trajectory projection.
