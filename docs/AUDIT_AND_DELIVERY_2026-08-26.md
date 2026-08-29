# Runtime audit and delivery record

## Evidence-based findings

- The corridor renderer is a multi-lane projection, not a geographic railway map. Its coordinates are derived from block progression and line class. It should be described as a **schematic operational view**.
- A runtime rendering defect treated `current_position_km` (distance within the active block) as absolute corridor chainage. This made train motion and focus inaccurate after the first block. Snapshots now publish `corridor_position_km`, calculated from the topology, and the primary operational canvas uses that value.
- Candidate futures existed as UI labels, but the What-If function did not consume its `candidate_actions` argument and recommendation approval could reduce a selected candidate to a generic hold. That broke the claimed candidate-specific execution path.
- Audio is Web Audio synthesis (`OscillatorNode`) rather than recordings. It is an asset-ready sound architecture, not realistic train audio. No licensed recordings are packaged.
- The archive has no installed frontend dependencies and the host test runner cannot currently see the globally installed Python packages. A clean verification therefore requires the documented dependency installation first.

## Delivered correction: one executable candidate path

The runtime now has one authoritative chain:

`conflict prediction → evaluator candidate actions → isolated physics preview → operator selection → exact candidate application → simulation event → state snapshot/outcome`

- `RailwaySimulationEngine.preview_candidate_actions` clones both network and state, applies the exact evaluated actions, and returns sampled train block, position, speed and status frames.
- `RailwaySimulationEngine.apply_candidate_actions` is the sole vocabulary adapter from candidate actions to interlocking actions and emits `CANDIDATE_PLAN_APPLIED`.
- `GET /api/recommendations/{id}/preview?candidate_id=...` serves only a safety-valid candidate belonging to that live recommendation.
- `POST /api/what-if/candidate` now evaluates controller-supplied candidate actions as a distinct cloned **physics branch**, alongside the baseline, priority, and CP-SAT schedule comparisons. It never relabels a solver result as a controller future.
- Approval rejects an unknown or unsafe selected candidate and executes the candidate's evaluated action list rather than re-deriving a generic display action.
- The future panel fetches and labels the physical preview. It also disables approval for an unsafe candidate.

## Deliberately not claimed

This delivery does not claim geographic track geometry, licensed train recordings, or a completed clean build in this machine state. Those need respectively surveyed topology/coordinates, licensed asset files, and a functioning dependency install.

## Required audio assets

Use rights-cleared, loopable WAV/OGG files: electric/diesel idle and traction (per class), wheel-on-rail, flange, brake release, point machine, signal relay, station ambience, and a short non-alarming controller alert. Add attribution/licence records with each file. Do not label oscillator synthesis as a real train recording.
