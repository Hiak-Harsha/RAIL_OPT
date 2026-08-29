export type PriorityClass = 1 | 2 | 3 | 4 | 5;

export type TrainStatus =
  | "SCHEDULED"
  | "READY"
  | "DEPARTING"
  | "ACCELERATING"
  | "CRUISING"
  | "APPROACHING_SIGNAL"
  | "BRAKING"
  | "APPROACHING_STATION"
  | "DWELLING"
  | "WAITING_FOR_ROUTE"
  | "WAITING_FOR_HEADWAY"
  | "DISRUPTED"
  | "ARRIVED"
  | "RUNNING"
  | "WAITING"
  | "STOPPED"
  | "DELAYED"
  | "CANCELLED";

export type WaitReasonType =
  | "ROUTE_NOT_RESERVED"
  | "HEADWAY_INSUFFICIENT"
  | "PLATFORM_UNAVAILABLE"
  | "CONFLICT_HOLD"
  | "DISRUPTION"
  | "SIGNAL_RED";

export interface WaitReason {
  type: WaitReasonType;
  entity_id?: string;
  remaining_sec: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  message: string;
}

export interface EvidenceFact {
  code: string;
  train_ids: string[];
  metric_name: string;
  metric_before: number;
  metric_after: number;
  verified: boolean;
  rendered_text: string;
}

export interface Platform {
  id: string;
  name: string;
  station_id: string;
  length_meters: number;
  is_occupied: boolean;
  occupied_by?: string;
}

export interface Station {
  id: string;
  code: string;
  name: string;
  position_km: number;
  platforms: Platform[];
  loop_blocks: string[];
}

export interface TrackBlock {
  id: string;
  name: string;
  block_type: "MAIN_LINE" | "LOOP_LINE" | "PLATFORM_LINE" | "JUNCTION_CROSSOVER" | "SINGLE_LINE_SECTION";
  direction: "UP" | "DOWN" | "BIDIRECTIONAL";
  length_km: number;
  max_speed_kmh: number;
  current_speed_limit_kmh: number;
  gradient_percent?: number;
  elevation_start_m?: number;
  elevation_end_m?: number;
  is_occupied: boolean;
  occupied_by_train_id?: string;
  is_blocked: boolean;
  /** Aspect calculated by the backend interlocking for this protected block. */
  signal_aspect?: "GREEN" | "YELLOW" | "RED";
  from_node: string;
  to_node: string;
  signals?: string[];
}

export interface TimetableStop {
  station_id: string;
  station_code: string;
  scheduled_arrival: number;
  scheduled_departure: number;
  assigned_platform_id?: string;
}

export interface Train {
  train_id: string;
  train_number: string;
  train_name: string;
  priority: PriorityClass;
  origin: string;
  destination: string;
  direction: "UP" | "DOWN" | "BIDIRECTIONAL";
  current_block_id?: string;
  current_position_km: number;
  /** Absolute chainage for rendering; current_position_km is block-relative physics state. */
  corridor_position_km?: number;
  current_speed_kmh: number;
  max_speed_kmh: number;
  acceleration_ms2?: number;
  deceleration_ms2?: number;
  current_accel_ms2?: number;
  jerk_limit_ms3?: number;
  gradient_sensitivity?: number;
  length_meters?: number;
  status: TrainStatus;
  route_block_ids: string[];
  route_index: number;
  total_delay_sec: number;
  stops: TimetableStop[];
  held_at_block_id?: string;
  hold_duration_remaining_sec: number;
  dwell_remaining_sec?: number;
  is_dwelling?: boolean;
  wait_reason?: WaitReason;
  rolling_stock_type?: string;
  coach_count?: number;
  rake_length_meters?: number;
}

export type SignalAspect = "RED" | "YELLOW" | "DOUBLE_YELLOW" | "GREEN";

export interface Signal {
  id: string;
  block_id: string;
  position_km: number;
  direction: "UP" | "DOWN" | "BIDIRECTIONAL";
  aspect: SignalAspect;
  is_automatic: boolean;
}

export interface SafetyInvariantStatus {
  invariant_name: string;
  description: string;
  is_satisfied: boolean;
  violation_count: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  details?: string;
}

export interface OperationalKPIs {
  throughput_trains_per_hr: number;
  section_clearances_per_hr?: number;
  average_delay_minutes: number;
  maximum_delay_minutes: number;
  punctuality_otp_pct: number;
  track_utilization_pct: number;
  total_active_trains: number;
  running_trains_count: number;
  delayed_trains_count: number;
  stopped_or_waiting_count: number;
  conflicts_prevented_total: number;
  active_conflicts_predicted: number;
  average_dwell_time_sec: number;
  recommendation_acceptance_pct: number | null;
}

export interface ConflictEntityState {
  train_id: string;
  train_name: string;
  priority: string;
  speed_kmh: number;
  current_block_id?: string;
  accumulated_delay_min: number;
}

export interface ResolutionTradeoff {
  action: string;
  target_train_id: string;
  location_block_id: string;
  expected_effect: string;
  tradeoff: string;
  delay_delta_sec: number;
  safety_valid: boolean;
}

export interface ConflictExplanation {
  conflict_id: string;
  conflict_type: "HEADWAY_VIOLATION" | "CROSSING_OVERLAP" | "PLATFORM_CLASH" | "BLOCK_CLOSURE_CONTENTION" | "OPPOSING_MOVEMENT";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  time_to_impact_sec: number;
  location_block_id: string;
  location_block_name: string;
  involved_entities: ConflictEntityState[];
  root_cause: string;
  impact_summary: string;
  candidate_resolutions: ResolutionTradeoff[];
}

export interface RecommendationRationale {
  recommendation_id: string;
  action: string;
  primary_train_id: string;
  conflicting_train_id?: string;
  target_block_id?: string;
  binding_constraints: string[];
  why_chosen: string;
  metric_delta: Record<string, number>;
  rejection_consequence: string;
  safety_validated: boolean;
}

export interface PredictedConflict {
  conflict_id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  conflict_state?: "ACTIVE" | "PREDICTED" | "POTENTIAL";
  predicted_time_sec: number;
  time_to_conflict_sec: number;
  location_block_id: string;
  location_block_name: string;
  involved_train_ids: string[];
  involved_train_names: string[];
  conflict_nature: string;
  projected_delay_minutes: number;
  recommended_action_type: string;
  affected_block_ids?: string[];
  explanation?: ConflictExplanation;
}

export interface CounterfactualOption {
  option_id: string;
  candidate_id?: string;
  label: string;
  target_train_id?: string;
  target_block_id?: string;
  is_recommended: boolean;
  total_delay_min?: number;
  projected_total_delay_min?: number;
  projected_delay_saved_min?: number;
  safety?: string;
  feasibility?: string;
  objective_score?: string;
  relative_preference?: string;
  conflict_risk?: string;
  throughput_impact?: string;
  controller_summary: string;
  safety_valid?: boolean;
  actions?: Array<{ action_type: string; train_id: string; target_block_id?: string; target_platform_id?: string; duration_sec?: number; description?: string }>;
  metrics?: { total_delay_min: number; max_delay_min: number; throughput_trains_hr: number; conflicts_count: number };
}

export interface Recommendation {
  recommendation_id: string;
  timestamp_sec: number;
  primary_train_id: string;
  conflicting_train_id?: string;
  action: "HOLD" | "RELEASE" | "REROUTE" | "CHANGE_PRECEDENCE" | "REASSIGN_PLATFORM" | "ALLOW_CROSSING";
  target_block_id?: string;
  duration_sec: number;
  reason_summary: string;
  reasons_bullet_points: string[];
  affected_train_ids: string[];
  confidence_score?: number;
  optimization_objective_score?: number;
  evaluated_objective_score?: number;
  solver_name?: string;
  solver_status?: string;
  source_candidate_id?: string;
  operational_status?: "SAFE_RECOMMENDATION" | "SOLVER_INVALIDATED" | "NO_SAFE_PLAN" | "NO_INTERVENTION_REQUIRED";
  safety_valid: boolean;
  applied?: boolean;
  controller_decision?: "APPROVE" | "REJECT" | "OVERRIDE";
  override_reason?: string;
  counterfactual_options: CounterfactualOption[];
  projected_metrics_diff: {
    delay_saved_min?: number;
    throughput_gain_pct?: number;
    conflicts_prevented?: number;
  };
  evidence_facts?: EvidenceFact[];
  explanation?: ConflictExplanation;
  rationale?: RecommendationRationale;
}

export interface Disruption {
  id: string;
  disruption_type: "TRAIN_DELAY" | "TRAIN_BREAKDOWN" | "BLOCK_CLOSURE" | "PLATFORM_UNAVAILABLE" | "SIGNAL_FAILURE" | "SPEED_RESTRICTION";
  target_id: string;
  start_time_sec: number;
  duration_sec: number;
  description: string;
}

export interface AuditLogEntry {
  entry_id: string;
  timestamp_sec: number;
  recommendation_id: string;
  train_id: string;
  action: string;
  ai_reason: string;
  controller_action: "APPROVE" | "REJECT" | "OVERRIDE";
  override_reason?: string;
  projected_delay_saved_sec: number;
  actual_outcome_delay_saved_sec?: number;
  prev_hash?: string;
  entry_hash?: string;
}

export interface BenchmarkRow {
  method: string;
  scenario_name: string;
  total_delay_min: number;
  avg_delay_min: number;
  max_delay_min: number;
  throughput_trains_hr: number;
  punctuality_otp_pct: number;
  track_utilization_pct: number;
  conflicts_detected: number;
  computation_time_ms: number;
  safety_valid: boolean;
}

export interface SafetyInvariantSummary {
  checked: number;
  passed: number;
  failed: number;
  percentage: number;
}

export interface BenchmarkResult {
  scenarios_evaluated: string[];
  results_table: BenchmarkRow[];
  summary_insights: string[];
  safety_invariants?: SafetyInvariantSummary;
}

export interface ScenarioOutcome {
  scenario_id: string;
  scenario_name: string;
  description: string;
  average_delay_min: number;
  max_delay_min: number;
  total_network_delay_min: number;
  throughput_trains_per_hr: number;
  track_utilization_pct: number;
  conflicts_count: number;
  punctuality_pct: number;
  recovery_time_min: number;
  safety_violations_count: number;
}

export interface WhatIfReport {
  baseline_scenario: ScenarioOutcome;
  optimized_scenario: ScenarioOutcome;
  alternative_scenarios: ScenarioOutcome[];
  delay_reduction_pct: number;
  throughput_gain_pct: number;
  conflicts_eliminated: number;
}
