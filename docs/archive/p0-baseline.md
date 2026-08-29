# RAILOPT-X P0 Baseline Audit & Architecture Report

## 1. Executive Summary & Audit Findings

This document establishes the verified baseline of the RAILOPT-X repository for Phase P0 (Truth, Transport, and Release Foundation).

### Key Fact Verifications

1. **State Ownership & WebSocket Duplication**:
   - `src/main.tsx` wrapped the app in `OperationalStoreProvider`.
   - `src/App.tsx` concurrently maintained independent local state (`trains`, `blocks`, `stations`, `kpis`, `predictedConflicts`, `activeRecommendations`, `events`), instantiated its own REST fetch cycles, and owned a separate WebSocket/polling effect.
   - *Resolution*: Centralize all realtime lifecycle, snapshots, deltas, and socket connections inside `OperationalStore.tsx`.

2. **WebSocket & REST Host Construction**:
   - `src/state/OperationalStore.tsx` previously constructed its WebSocket URL dynamically using `${window.location.host}/ws/live`. When deployed via Docker on port 3000 (served by Nginx without a proxy block), socket calls failed because the backend runs on port 8000.
   - `src/services/api.ts` defaulted to `http://localhost:8000` / `ws://localhost:8000/ws/live`.
   - *Resolution*: Create `src/config/env.ts` as the single typed configuration module providing `API_BASE_URL` and `WS_URL`, backed by `VITE_API_BASE_URL` and `VITE_WS_URL`.

3. **Production Container Topology**:
   - In Docker deployments, Nginx on port 3000 will reverse-proxy `/api/` and `/ws/` to `http://backend:8000`, enabling seamless same-origin communication with WebSocket upgrade headers.

4. **Loop Precedence Physical Semantics**:
   - Upgraded `apply_controller_action` to validate route adjacency, check track availability, lock point switches, issue signal clearance, simulate physical deceleration into the loop, hold until the precedence train clears, and release locks upon exit.

---

## 2. API Contract & Message Samples

### REST `/api/state` Snapshot Contract
```json
{
  "sequence": 142,
  "worldVersion": "2.0.0",
  "topology_revision": "REV_2026_08",
  "sim_time_sec": 420.0,
  "is_running": true,
  "trains": [
    {
      "train_id": "T22436",
      "train_name": "Vande Bharat Express",
      "current_position_km": 142.5,
      "corridor_position_km": 142.5,
      "current_speed_kmh": 130.0,
      "status": "RUNNING"
    }
  ],
  "blocks": [],
  "signals": [],
  "platforms": [],
  "kpis": {
    "punctuality_rate": 0.988,
    "average_delay_min": 2.4,
    "throughput_trains_per_hour": 18.2
  },
  "predicted_conflicts": [],
  "active_recommendations": []
}
```

### WebSocket `/ws/live` Message Flow
- **`SNAPSHOT`**: Sent on client connection with full world state and sequence ID.
- **`DELTA`**: Incremental updates with `sequence` and `base_sequence` for high-frequency low-bandwidth sync.
- **`DISPATCH_ACTION`**: Controller dispatches and approval events.
