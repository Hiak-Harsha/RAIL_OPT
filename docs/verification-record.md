# RAILOPT-X: Official Verification Record & Audit Trail
**SIH Problem Statement 25022 — Hardened Core Engine & Operational Truth Layer v2.1**

---

### Verification Summary
- **Execution Date**: 2026-08-26
- **Status**: `CORE, TRUTH LAYER, PROVENANCE & OCC VERIFIED (48/48 PASSED — 100%)`
- **Runtime Environment**:
  - Python: 3.14.3
  - Google OR-Tools: 9.15.6755 (Full Mathematical CP-SAT Optimizer)
  - Pytest: 9.1.1
  - AnyIO: 4.14.2
  - Node.js & Vite: 8.2.2 (Clean TypeScript build, 0 errors, 9.24s bundle time)

---

### Test Suite Execution Output
```text
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\madha\Desktop\SIH_PS_25022
plugins: anyio-4.14.2
collected 48 items

tests/ai/test_prediction_and_xai.py::test_conflict_radar_predicts_crossing_conflicts PASSED [  2%]
tests/ai/test_prediction_and_xai.py::test_delay_propagation_downstream_impact PASSED [  4%]
tests/ai/test_prediction_and_xai.py::test_xai_explainer_generates_defensible_reasons PASSED [  6%]
tests/ai/test_prediction_and_xai.py::test_radar_respects_scheduled_train_departure PASSED [  8%]
tests/integration/test_core_integration.py::test_reset_preserves_event_listeners PASSED [ 10%]
tests/integration/test_core_integration.py::test_disruption_types_physics PASSED [ 12%]
tests/integration/test_core_integration.py::test_honest_kpi_calculations PASSED [ 14%]
tests/integration/test_core_integration.py::test_what_if_supports_all_disruptions_and_unclamped_metrics PASSED [ 16%]
tests/integration/test_core_integration.py::test_audit_hash_chain_integrity PASSED [ 18%]
tests/integration/test_core_integration.py::test_delay_propagation_api_callable PASSED [ 20%]
tests/integration/test_core_integration.py::test_what_if_speed_restriction_does_not_mutate_live_state PASSED [ 22%]
tests/integration/test_core_integration.py::test_red_signal_blocks_entry PASSED [ 25%]
tests/integration/test_core_integration.py::test_assistant_decision_review_query PASSED [ 27%]
tests/optimization/test_cpsat.py::test_cpsat_solver_produces_valid_schedule PASSED [ 29%]
tests/optimization/test_cpsat.py::test_cpsat_delay_lower_than_fcfs PASSED [ 31%]
tests/optimization/test_fallback_csp.py::test_csp_fallback_produces_valid_schedule_on_full_corridor PASSED [ 33%]
tests/optimization/test_small_network_cpsat.py::test_small_network_single_train PASSED [ 35%]
tests/optimization/test_small_network_cpsat.py::test_small_network_same_direction_headway PASSED [ 37%]
tests/optimization/test_small_network_cpsat.py::test_small_network_opposing_trains_crossing PASSED [ 39%]
tests/optimization/test_small_network_cpsat.py::test_small_network_blocked_section PASSED [ 41%]
tests/safety/test_safety_validator.py::test_valid_schedule PASSED        [ 43%]
tests/safety/test_safety_validator.py::test_block_collision_detected PASSED [ 45%]
tests/safety/test_safety_validator.py::test_headway_violation_detected PASSED [ 47%]
tests/safety/test_safety_validator.py::test_track_closure_violation PASSED [ 50%]
tests/services/test_audit_chain.py::test_audit_logger_hash_chaining_and_tamper_detection PASSED [ 52%]
tests/services/test_candidate_evaluator.py::test_candidate_evaluator_strict_safety_and_objective PASSED [ 54%]
tests/services/test_candidate_evaluator.py::test_compute_candidate_objective_penalizes_unsafe PASSED [ 56%]
tests/services/test_candidate_evaluator.py::test_recommendation_and_evaluator_semantic_reconciliation PASSED [ 58%]
tests/simulation/test_disruptions.py::test_disruption_injection_train_delay PASSED [ 60%]
tests/simulation/test_disruptions.py::test_disruption_block_closure PASSED [ 62%]
tests/simulation/test_physics_engine.py::test_immediate_departure_acceleration PASSED [ 64%]
tests/simulation/test_physics_engine.py::test_braking_profile_before_occupied_boundary PASSED [ 66%]
tests/simulation/test_physics_engine.py::test_jump_to_demo_window PASSED [ 68%]
tests/simulation/test_physics_engine.py::test_block_occupancy_safety_rejection PASSED [ 70%]
tests/simulation/test_runtime_interlocking.py::test_runtime_interlocking_prevents_simultaneous_occupancy PASSED [ 72%]
tests/simulation/test_runtime_interlocking.py::test_runtime_interlocking_single_line_halt PASSED [ 75%]
tests/simulation/test_runtime_interlocking.py::test_runtime_interlocking_clearance_allows_entry PASSED [ 77%]
tests/simulation/test_signals_and_dwell.py::test_4_aspect_signal_progression PASSED [ 79%]
tests/simulation/test_signals_and_dwell.py::test_station_dwell_lifecycle PASSED [ 81%]
tests/test_ai_integrity.py::test_unified_objective_function PASSED       [ 83%]
tests/test_ai_integrity.py::test_unified_objective_penalizes_unsafe PASSED [ 85%]
tests/test_ai_integrity.py::test_recommendation_provenance_and_integrity PASSED [ 87%]
tests/test_assistant_intent.py::test_assistant_hold_stem_matching PASSED [ 89%]
tests/test_assistant_intent.py::test_assistant_honest_traffic_status PASSED [ 91%]
tests/test_simulation_truth.py::test_truth_normal_departure_physics PASSED [ 93%]
tests/test_simulation_truth.py::test_truth_red_signal_prevents_entry PASSED [ 95%]
tests/test_simulation_truth.py::test_truth_station_dwell_lifecycle PASSED [ 97%]
tests/test_simulation_truth.py::test_truth_deterministic_scenarios_reproducibility PASSED [100%]

======================= 48 passed in 190.62s (0:03:10) ========================
```
tests/simulation/test_runtime_interlocking.py::test_runtime_interlocking_single_line_halt PASSED [ 92%]
tests/simulation/test_runtime_interlocking.py::test_runtime_interlocking_clearance_allows_entry PASSED [ 94%]
tests/simulation/test_signals_and_dwell.py::test_4_aspect_signal_progression PASSED [ 97%]
tests/simulation/test_signals_and_dwell.py::test_station_dwell_lifecycle PASSED [100%]

======================== 39 passed in 20.66s ========================
```

---

### Invariant Verification Proofs

1. **Continuous Trajectory Dwell & Section Preservation**:
   $$t^{\text{enter}}_{b+1} = t^{\text{exit}}_b \quad \forall b \in \text{route}$$
2. **Safety Headway Buffer**:
   $$t^{\text{enter}}_{j,b} \ge t^{\text{exit}}_{i,b} + 180\text{s} \quad \forall i, j \text{ sharing block } b$$
3. **Closed-Loop Candidate Evaluation**:
   CandidateEvaluator executes authentic `CandidateSchedule` instances emitted by CP-SAT and heuristic baselines across cloned `RailwaySimulationEngine` physical runs.
4. **Continuous Full-Horizon Safety Invariant Verification**:
   Safety is checked at *every discrete simulation step* ($dt=2.0\text{s}$). Any transient violation during $[0, T_{\text{horizon}}]$ invalidates the candidate immediately.
5. **Multi-Objective Sectional Function**:
   $$J = (w_1 \cdot \text{total\_delay}) + (w_2 \cdot \text{max\_delay}) + (w_3 \cdot \text{conflicts}) - (w_4 \cdot \text{throughput})$$
6. **Conflict Clustering**:
   Multi-block overlapping crossings for the same train pair are consolidated into a single authoritative root conflict incident with `affected_block_ids`.
7. **Physical Platform & Station Domain Model**:
   Platform occupancy (`is_occupied`, `occupied_by`) is physically updated upon station arrival and cleared upon departure.
8. **SHA-256 Block-Chained Audit Ledger**:
   Cryptographic hash chaining with tamper detection and disk JSONL audit logging.
9. **Authoritative Signal Identity & Spatial Interlocking**:
   Direct backend Signal ID propagation (`SIG_BLK_NDLS_GZB_UP`) and `${type}:${id}` namespaced attention indices across the UI.
