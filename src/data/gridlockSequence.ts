import type { Train, TrackBlock, OperationalKPIs, PredictedConflict, PriorityClass } from "../types/railway";

export interface CandidatePlanPreview {
  id: string;
  name: string;
  strategy: string;
  delayMin: number;
  safetyStatus: "SAFE" | "UNSAFE" | "VIOLATION";
  isOptimal: boolean;
}

export interface SequenceFrame {
  t: number;                          // ms from sequence start (0 to 75000 ms)
  phase: "CALM" | "ESCALATING" | "GRIDLOCK" | "FUTURE_WORLDS" | "RESOLVING" | "OPTIMAL";
  trains: Train[];
  blocks: TrackBlock[];
  kpis: OperationalKPIs;
  predictedConflicts: PredictedConflict[];
  teleprinterLine?: string;
  caption?: string;
  subCaption?: string;
  cameraFocusKm?: number;
  candidatePlans?: CandidatePlanPreview[];
  highlightBlockId?: string;
  soundCue?: "relay" | "warning" | "teleprinter" | "resolve";
}

// Canonical static block baseline references (NDLS -> CNB corridor)
const BASE_BLOCKS: TrackBlock[] = [
  { id: "BLK_NDLS_GZB_UP", name: "NDLS - GZB UP Main", block_type: "MAIN_LINE", direction: "UP", length_km: 28.0, max_speed_kmh: 130, current_speed_limit_kmh: 130, is_occupied: false, is_blocked: false, from_node: "STN_NDLS", to_node: "STN_GZB" },
  { id: "BLK_GZB_ALJN_UP", name: "GZB - ALJN UP Main", block_type: "MAIN_LINE", direction: "UP", length_km: 103.0, max_speed_kmh: 130, current_speed_limit_kmh: 130, is_occupied: false, is_blocked: false, from_node: "STN_GZB", to_node: "STN_ALJN" },
  { id: "BLK_ALJN_LOOP_1", name: "Aligarh Junction Loop 1", block_type: "LOOP_LINE", direction: "BIDIRECTIONAL", length_km: 1.5, max_speed_kmh: 30, current_speed_limit_kmh: 30, is_occupied: false, is_blocked: false, from_node: "STN_ALJN", to_node: "STN_ALJN" },
  { id: "BLK_ALJN_TDL_SINGLE", name: "ALJN - TDL Single Bottleneck", block_type: "SINGLE_LINE_SECTION", direction: "BIDIRECTIONAL", length_km: 78.0, max_speed_kmh: 110, current_speed_limit_kmh: 110, is_occupied: false, is_blocked: false, from_node: "STN_ALJN", to_node: "STN_TDL" },
  { id: "BLK_TDL_ETW_UP", name: "TDL - ETW UP Main", block_type: "MAIN_LINE", direction: "UP", length_km: 92.0, max_speed_kmh: 130, current_speed_limit_kmh: 130, is_occupied: false, is_blocked: false, from_node: "STN_TDL", to_node: "STN_ETW" },
  { id: "BLK_ETW_CNB_UP", name: "ETW - CNB UP Main", block_type: "MAIN_LINE", direction: "UP", length_km: 134.0, max_speed_kmh: 130, current_speed_limit_kmh: 130, is_occupied: false, is_blocked: false, from_node: "STN_ETW", to_node: "STN_CNB" },
  { id: "BLK_CNB_ETW_DN", name: "CNB - ETW DN Main", block_type: "MAIN_LINE", direction: "DOWN", length_km: 134.0, max_speed_kmh: 130, current_speed_limit_kmh: 130, is_occupied: false, is_blocked: false, from_node: "STN_CNB", to_node: "STN_ETW" },
  { id: "BLK_ETW_TDL_DN", name: "ETW - TDL DN Main", block_type: "MAIN_LINE", direction: "DOWN", length_km: 92.0, max_speed_kmh: 130, current_speed_limit_kmh: 130, is_occupied: false, is_blocked: false, from_node: "STN_ETW", to_node: "STN_TDL" },
  { id: "BLK_TDL_ALJN_SINGLE", name: "TDL - ALJN Single Bottleneck", block_type: "SINGLE_LINE_SECTION", direction: "BIDIRECTIONAL", length_km: 78.0, max_speed_kmh: 110, current_speed_limit_kmh: 110, is_occupied: false, is_blocked: false, from_node: "STN_TDL", to_node: "STN_ALJN" },
  { id: "BLK_ALJN_GZB_DN", name: "ALJN - GZB DN Main", block_type: "MAIN_LINE", direction: "DOWN", length_km: 103.0, max_speed_kmh: 130, current_speed_limit_kmh: 130, is_occupied: false, is_blocked: false, from_node: "STN_ALJN", to_node: "STN_GZB" },
  { id: "BLK_GZB_NDLS_DN", name: "GZB - NDLS DN Main", block_type: "MAIN_LINE", direction: "DOWN", length_km: 28.0, max_speed_kmh: 130, current_speed_limit_kmh: 130, is_occupied: false, is_blocked: false, from_node: "STN_GZB", to_node: "STN_NDLS" },
];

function makeTrain(params: Partial<Train> & { train_id: string; train_name: string; train_number: string; priority: PriorityClass; direction: "UP" | "DOWN"; current_position_km: number; current_speed_kmh: number }): Train {
  return {
    origin: params.direction === "UP" ? "NDLS" : "CNB",
    destination: params.direction === "UP" ? "CNB" : "NDLS",
    max_speed_kmh: 130,
    status: "RUNNING",
    route_block_ids: ["BLK_NDLS_GZB_UP", "BLK_GZB_ALJN_UP", "BLK_ALJN_TDL_SINGLE", "BLK_TDL_ETW_UP", "BLK_ETW_CNB_UP"],
    route_index: 0,
    total_delay_sec: 0,
    stops: [],
    hold_duration_remaining_sec: 0,
    length_meters: 500,
    ...params
  };
}

function makeKPIs(
  params: Partial<OperationalKPIs> & {
    throughput_trains_per_hr: number;
    average_delay_minutes: number;
    punctuality_otp_pct: number;
    trains?: Train[];
    conflicts?: PredictedConflict[];
  }
): OperationalKPIs {
  const trains = params.trains || [];
  const totalTrains = trains.length > 0 ? trains.length : 4;
  const runningCount = trains.length > 0 ? trains.filter(t => t.status === "RUNNING").length : 4;
  const waitingCount = trains.length > 0 ? trains.filter(t => t.status === "WAITING" || t.status === "STOPPED").length : 0;
  const delayedCount = trains.length > 0 ? trains.filter(t => t.total_delay_sec > 120 || t.status === "DELAYED").length : 0;
  const activeConflicts = params.conflicts ? params.conflicts.length : 0;

  const base: OperationalKPIs = {
    throughput_trains_per_hr: params.throughput_trains_per_hr,
    average_delay_minutes: params.average_delay_minutes,
    punctuality_otp_pct: params.punctuality_otp_pct,
    maximum_delay_minutes: params.maximum_delay_minutes ?? params.average_delay_minutes * 1.5,
    track_utilization_pct: params.track_utilization_pct ?? 78.5,
    total_active_trains: totalTrains,
    running_trains_count: runningCount,
    delayed_trains_count: delayedCount,
    stopped_or_waiting_count: waitingCount,
    conflicts_prevented_total: 12,
    active_conflicts_predicted: activeConflicts,
    average_dwell_time_sec: 120,
    recommendation_acceptance_pct: 100,
  };

  return { ...base, ...params };
}

function makeConflict(params: Partial<PredictedConflict> & { conflict_id: string; severity: "CRITICAL" | "HIGH" | "MEDIUM"; location_block_id: string; involved_train_ids: string[] }): PredictedConflict {
  return {
    conflict_state: "ACTIVE",
    predicted_time_sec: 120,
    time_to_conflict_sec: 60,
    location_block_name: "ALJN - TDL Bottleneck",
    involved_train_names: ["Vande Bharat Express", "Container Freight Heavy"],
    conflict_nature: "Head-on single-line contention",
    projected_delay_minutes: 18.5,
    recommended_action_type: "HOLD",
    ...params
  };
}

export const GRIDLOCK_KEYFRAMES: SequenceFrame[] = [
  // ── BEAT 1: FLOW (0–12s) ───────────────────────────────────────
  // Real-model express, freight and commuter trains move smoothly; green signals and normal headways.
  {
    t: 0,
    phase: "CALM",
    caption: "1. CORRIDOR FLOW IN EQUILIBRIUM",
    subCaption: "A busy corridor works only when every movement is coordinated.",
    teleprinterLine: "08:00:00 OCC TELEMETRY SYNCHRONIZED — NDLS–CNB 435 KM CORRIDOR NOMINAL",
    soundCue: "teleprinter",
    cameraFocusKm: 170,
    kpis: makeKPIs({
      throughput_trains_per_hr: 28.0,
      average_delay_minutes: 0.0,
      punctuality_otp_pct: 99.2,
      active_conflicts_predicted: 0
    }),
    predictedConflicts: [],
    blocks: BASE_BLOCKS.map(b => ({ ...b, is_occupied: b.id === "BLK_NDLS_GZB_UP" || b.id === "BLK_CNB_ETW_DN" })),
    trains: [
      makeTrain({ train_id: "T22436", train_number: "22436", train_name: "Vande Bharat Express", priority: 5, direction: "UP", current_position_km: 25.0, current_speed_kmh: 130.0, current_block_id: "BLK_NDLS_GZB_UP", length_meters: 400 }),
      makeTrain({ train_id: "T12301", train_number: "12301", train_name: "Rajdhani Express", priority: 4, direction: "UP", current_position_km: 95.0, current_speed_kmh: 120.0, current_block_id: "BLK_GZB_ALJN_UP", length_meters: 600 }),
      makeTrain({ train_id: "T04403", train_number: "04403", train_name: "Container Freight Heavy", priority: 2, direction: "DOWN", current_position_km: 330.0, current_speed_kmh: 80.0, current_block_id: "BLK_CNB_ETW_DN", length_meters: 750 }),
      makeTrain({ train_id: "T12423", train_number: "12423", train_name: "Dibrugarh Rajdhani", priority: 4, direction: "DOWN", current_position_km: 260.0, current_speed_kmh: 110.0, current_block_id: "BLK_ETW_TDL_DN", length_meters: 550 })
    ]
  },
  {
    t: 6000,
    phase: "CALM",
    caption: "1. CORRIDOR FLOW IN EQUILIBRIUM",
    subCaption: "Automated block signalling maintains safe headway intervals.",
    teleprinterLine: "08:01:30 ALL SIGNALS GREEN • CORRIDOR THROUGHPUT 28.0 TRAINS/HR",
    soundCue: "teleprinter",
    cameraFocusKm: 165,
    kpis: makeKPIs({
      throughput_trains_per_hr: 28.0,
      average_delay_minutes: 0.0,
      punctuality_otp_pct: 99.0,
      active_conflicts_predicted: 0
    }),
    predictedConflicts: [],
    blocks: BASE_BLOCKS,
    trains: [
      makeTrain({ train_id: "T22436", train_number: "22436", train_name: "Vande Bharat Express", priority: 5, direction: "UP", current_position_km: 55.0, current_speed_kmh: 130.0, current_block_id: "BLK_GZB_ALJN_UP", length_meters: 400 }),
      makeTrain({ train_id: "T12301", train_number: "12301", train_name: "Rajdhani Express", priority: 4, direction: "UP", current_position_km: 120.0, current_speed_kmh: 120.0, current_block_id: "BLK_GZB_ALJN_UP", length_meters: 600 }),
      makeTrain({ train_id: "T04403", train_number: "04403", train_name: "Container Freight Heavy", priority: 2, direction: "DOWN", current_position_km: 300.0, current_speed_kmh: 80.0, current_block_id: "BLK_ETW_TDL_DN", length_meters: 750 }),
      makeTrain({ train_id: "T12423", train_number: "12423", train_name: "Dibrugarh Rajdhani", priority: 4, direction: "DOWN", current_position_km: 230.0, current_speed_kmh: 110.0, current_block_id: "BLK_ETW_TDL_DN", length_meters: 550 })
    ]
  },

  // ── BEAT 2: PRESSURE (12–25s) ──────────────────────────────────
  // A delayed freight loses its planned slot; following traffic closes headway; a station loop fills.
  {
    t: 12000,
    phase: "ESCALATING",
    caption: "2. SCHEDULE PRESSURE & HEADWAY COMPRESSION",
    subCaption: "One late movement compresses the margin for every train behind it.",
    teleprinterLine: "08:03:00 DISRUPTION WARNING: FREIGHT 04403 SPEED RESTRICTION TO 40 KM/H (HOT AXLE ALARM)",
    soundCue: "warning",
    cameraFocusKm: 160,
    kpis: makeKPIs({
      throughput_trains_per_hr: 25.5,
      average_delay_minutes: 3.2,
      punctuality_otp_pct: 94.0,
      active_conflicts_predicted: 1
    }),
    predictedConflicts: [
      makeConflict({
        conflict_id: "CONF_BEAT2",
        severity: "MEDIUM",
        location_block_id: "BLK_ALJN_TDL_SINGLE",
        involved_train_ids: ["T12301", "T04403"],
        conflict_nature: "Headway compression behind decelerating freight",
        projected_delay_minutes: 5.5
      })
    ],
    blocks: BASE_BLOCKS,
    trains: [
      makeTrain({ train_id: "T22436", train_number: "22436", train_name: "Vande Bharat Express", priority: 5, direction: "UP", current_position_km: 80.0, current_speed_kmh: 130.0, current_block_id: "BLK_GZB_ALJN_UP", length_meters: 400 }),
      makeTrain({ train_id: "T12301", train_number: "12301", train_name: "Rajdhani Express", priority: 4, direction: "UP", current_position_km: 135.0, current_speed_kmh: 110.0, current_block_id: "BLK_GZB_ALJN_UP", length_meters: 600 }),
      makeTrain({ train_id: "T04403", train_number: "04403", train_name: "Container Freight Heavy", priority: 2, direction: "DOWN", current_position_km: 245.0, current_speed_kmh: 40.0, total_delay_sec: 180, current_block_id: "BLK_TDL_ALJN_SINGLE", length_meters: 750 }),
      makeTrain({ train_id: "T12423", train_number: "12423", train_name: "Dibrugarh Rajdhani", priority: 4, direction: "DOWN", current_position_km: 210.0, current_speed_kmh: 75.0, total_delay_sec: 90, current_block_id: "BLK_TDL_ALJN_SINGLE", length_meters: 550 })
    ]
  },
  {
    t: 18000,
    phase: "ESCALATING",
    caption: "2. SCHEDULE PRESSURE & HEADWAY COMPRESSION",
    subCaption: "Opposing fast services converge toward the shared single-line neck.",
    teleprinterLine: "08:04:30 LOOKAHEAD RADAR: 2 OPPOSING SERVICES CONVERGING ON KM 165",
    soundCue: "warning",
    cameraFocusKm: 155,
    kpis: makeKPIs({
      throughput_trains_per_hr: 22.0,
      average_delay_minutes: 6.4,
      punctuality_otp_pct: 88.5,
      active_conflicts_predicted: 1
    }),
    predictedConflicts: [
      makeConflict({
        conflict_id: "CONF_BEAT2_2",
        severity: "HIGH",
        location_block_id: "BLK_ALJN_TDL_SINGLE",
        involved_train_ids: ["T12301", "T04403"],
        projected_delay_minutes: 12.0
      })
    ],
    blocks: BASE_BLOCKS,
    trains: [
      makeTrain({ train_id: "T22436", train_number: "22436", train_name: "Vande Bharat Express", priority: 5, direction: "UP", current_position_km: 105.0, current_speed_kmh: 130.0, current_block_id: "BLK_GZB_ALJN_UP", length_meters: 400 }),
      makeTrain({ train_id: "T12301", train_number: "12301", train_name: "Rajdhani Express", priority: 4, direction: "UP", current_position_km: 150.0, current_speed_kmh: 100.0, current_block_id: "BLK_GZB_ALJN_UP", length_meters: 600 }),
      makeTrain({ train_id: "T04403", train_number: "04403", train_name: "Container Freight Heavy", priority: 2, direction: "DOWN", current_position_km: 215.0, current_speed_kmh: 35.0, total_delay_sec: 320, current_block_id: "BLK_TDL_ALJN_SINGLE", length_meters: 750 }),
      makeTrain({ train_id: "T12423", train_number: "12423", train_name: "Dibrugarh Rajdhani", priority: 4, direction: "DOWN", current_position_km: 185.0, current_speed_kmh: 60.0, total_delay_sec: 210, current_block_id: "BLK_TDL_ALJN_SINGLE", length_meters: 550 })
    ]
  },

  // ── BEAT 3: CONVERGENCE (25–38s) ───────────────────────────────
  // Camera frames the single-line entry/turnout; two trains approach from opposite directions; signal aspects restrict; braking audible.
  {
    t: 25000,
    phase: "ESCALATING",
    caption: "3. BOTTLENECK CONVERGENCE",
    subCaption: "Both movements need the same constrained section.",
    teleprinterLine: "08:06:00 INTERLOCKING RESTRICTION: SIGNAL S-140 CAUTION (YELLOW) • SPEED RESTRICTED",
    soundCue: "warning",
    cameraFocusKm: 150,
    kpis: makeKPIs({
      throughput_trains_per_hr: 18.2,
      average_delay_minutes: 11.0,
      punctuality_otp_pct: 78.0,
      active_conflicts_predicted: 2
    }),
    predictedConflicts: [
      makeConflict({
        conflict_id: "CONF_CONVERGE",
        severity: "CRITICAL",
        location_block_id: "BLK_ALJN_TDL_SINGLE",
        involved_train_ids: ["T12301", "T04403"],
        conflict_nature: "Deadlock Risk: Bidirectional single-line contention at KM 152",
        projected_delay_minutes: 24.5
      })
    ],
    blocks: BASE_BLOCKS,
    trains: [
      makeTrain({ train_id: "T22436", train_number: "22436", train_name: "Vande Bharat Express", priority: 5, direction: "UP", current_position_km: 125.0, current_speed_kmh: 125.0, current_block_id: "BLK_GZB_ALJN_UP", length_meters: 400 }),
      makeTrain({ train_id: "T12301", train_number: "12301", train_name: "Rajdhani Express", priority: 4, direction: "UP", current_position_km: 152.0, current_speed_kmh: 65.0, current_block_id: "BLK_ALJN_TDL_SINGLE", length_meters: 600 }),
      makeTrain({ train_id: "T04403", train_number: "04403", train_name: "Container Freight Heavy", priority: 2, direction: "DOWN", current_position_km: 180.0, current_speed_kmh: 30.0, total_delay_sec: 480, current_block_id: "BLK_TDL_ALJN_SINGLE", length_meters: 750 }),
      makeTrain({ train_id: "T12423", train_number: "12423", train_name: "Dibrugarh Rajdhani", priority: 4, direction: "DOWN", current_position_km: 168.0, current_speed_kmh: 40.0, total_delay_sec: 360, current_block_id: "BLK_TDL_ALJN_SINGLE", length_meters: 550 })
    ]
  },
  {
    t: 32000,
    phase: "GRIDLOCK",
    caption: "3. BOTTLENECK CONVERGENCE",
    subCaption: "Approach braking curves engage as protected block boundaries near.",
    teleprinterLine: "08:08:00 AUTOMATIC BRAKING CURVES ENGAGED • DISTANCE TO RESTRICTION: 1.2 KM",
    soundCue: "warning",
    cameraFocusKm: 148,
    kpis: makeKPIs({
      throughput_trains_per_hr: 14.5,
      average_delay_minutes: 16.5,
      punctuality_otp_pct: 69.0,
      active_conflicts_predicted: 2
    }),
    predictedConflicts: [
      makeConflict({
        conflict_id: "CONF_CONVERGE_2",
        severity: "CRITICAL",
        location_block_id: "BLK_ALJN_TDL_SINGLE",
        involved_train_ids: ["T12301", "T04403"],
        projected_delay_minutes: 32.0
      })
    ],
    blocks: BASE_BLOCKS,
    trains: [
      makeTrain({ train_id: "T22436", train_number: "22436", train_name: "Vande Bharat Express", priority: 5, direction: "UP", current_position_km: 140.0, current_speed_kmh: 90.0, current_block_id: "BLK_GZB_ALJN_UP", length_meters: 400 }),
      makeTrain({ train_id: "T12301", train_number: "12301", train_name: "Rajdhani Express", priority: 4, direction: "UP", current_position_km: 154.0, current_speed_kmh: 30.0, current_block_id: "BLK_ALJN_TDL_SINGLE", length_meters: 600 }),
      makeTrain({ train_id: "T04403", train_number: "04403", train_name: "Container Freight Heavy", priority: 2, direction: "DOWN", current_position_km: 165.0, current_speed_kmh: 20.0, total_delay_sec: 640, current_block_id: "BLK_TDL_ALJN_SINGLE", length_meters: 750 }),
      makeTrain({ train_id: "T12423", train_number: "12423", train_name: "Dibrugarh Rajdhani", priority: 4, direction: "DOWN", current_position_km: 160.0, current_speed_kmh: 20.0, total_delay_sec: 510, current_block_id: "BLK_TDL_ALJN_SINGLE", length_meters: 550 })
    ]
  },

  // ── BEAT 4: UNRESOLVED FUTURE (38–50s) ─────────────────────────
  // Split/faint red branch: trains stop before signals, delay ribbons spread backward, platform availability falls.
  // NO fake collision! Safe stopping with systemic cascade!
  {
    t: 38000,
    phase: "GRIDLOCK",
    caption: "4. UNRESOLVED FUTURE: CASCADE DELAY",
    subCaption: "Without a decision, safe stopping becomes system-wide delay.",
    teleprinterLine: "08:10:00 SIGNALS DROP TO DANGER (RED) • BOTH TRAINS SAFELY STOPPED BEFORE PROTECTED LIMIT",
    soundCue: "warning",
    cameraFocusKm: 145,
    kpis: makeKPIs({
      throughput_trains_per_hr: 9.8,
      average_delay_minutes: 24.0,
      punctuality_otp_pct: 54.0,
      active_conflicts_predicted: 3
    }),
    predictedConflicts: [
      makeConflict({
        conflict_id: "CONF_GRIDLOCK",
        severity: "CRITICAL",
        location_block_id: "BLK_ALJN_TDL_SINGLE",
        involved_train_ids: ["T12301", "T04403", "T22436", "T12423"],
        conflict_nature: "Corridor Gridlock: 4 services stalled at protected signals",
        projected_delay_minutes: 45.0
      })
    ],
    blocks: BASE_BLOCKS,
    trains: [
      makeTrain({ train_id: "T22436", train_number: "22436", train_name: "Vande Bharat Express", priority: 5, direction: "UP", current_position_km: 145.0, current_speed_kmh: 0.0, status: "WAITING", total_delay_sec: 300, current_block_id: "BLK_GZB_ALJN_UP", length_meters: 400 }),
      makeTrain({ train_id: "T12301", train_number: "12301", train_name: "Rajdhani Express", priority: 4, direction: "UP", current_position_km: 154.5, current_speed_kmh: 0.0, status: "WAITING", total_delay_sec: 600, current_block_id: "BLK_ALJN_TDL_SINGLE", length_meters: 600 }),
      makeTrain({ train_id: "T04403", train_number: "04403", train_name: "Container Freight Heavy", priority: 2, direction: "DOWN", current_position_km: 156.5, current_speed_kmh: 0.0, status: "WAITING", total_delay_sec: 900, current_block_id: "BLK_TDL_ALJN_SINGLE", length_meters: 750 }),
      makeTrain({ train_id: "T12423", train_number: "12423", train_name: "Dibrugarh Rajdhani", priority: 4, direction: "DOWN", current_position_km: 159.0, current_speed_kmh: 0.0, status: "WAITING", total_delay_sec: 720, current_block_id: "BLK_TDL_ALJN_SINGLE", length_meters: 550 })
    ]
  },
  {
    t: 44000,
    phase: "GRIDLOCK",
    caption: "4. UNRESOLVED FUTURE: CASCADE DELAY",
    subCaption: "Upstream sections accumulate queues; platform capacity falls to zero.",
    teleprinterLine: "08:12:00 UPSTREAM HEADWAY EXHAUSTION • 4 CONVERGING TRAINS STALLED AT RED SIGNALS",
    soundCue: "warning",
    cameraFocusKm: 145,
    kpis: makeKPIs({
      throughput_trains_per_hr: 6.5,
      average_delay_minutes: 32.0,
      punctuality_otp_pct: 42.0,
      active_conflicts_predicted: 3
    }),
    predictedConflicts: [
      makeConflict({
        conflict_id: "CONF_GRIDLOCK_2",
        severity: "CRITICAL",
        location_block_id: "BLK_ALJN_TDL_SINGLE",
        involved_train_ids: ["T12301", "T04403", "T22436", "T12423"],
        projected_delay_minutes: 58.0
      })
    ],
    blocks: BASE_BLOCKS,
    trains: [
      makeTrain({ train_id: "T22436", train_number: "22436", train_name: "Vande Bharat Express", priority: 5, direction: "UP", current_position_km: 145.0, current_speed_kmh: 0.0, status: "WAITING", total_delay_sec: 480, current_block_id: "BLK_GZB_ALJN_UP", length_meters: 400 }),
      makeTrain({ train_id: "T12301", train_number: "12301", train_name: "Rajdhani Express", priority: 4, direction: "UP", current_position_km: 154.5, current_speed_kmh: 0.0, status: "WAITING", total_delay_sec: 840, current_block_id: "BLK_ALJN_TDL_SINGLE", length_meters: 600 }),
      makeTrain({ train_id: "T04403", train_number: "04403", train_name: "Container Freight Heavy", priority: 2, direction: "DOWN", current_position_km: 156.5, current_speed_kmh: 0.0, status: "WAITING", total_delay_sec: 1200, current_block_id: "BLK_TDL_ALJN_SINGLE", length_meters: 750 }),
      makeTrain({ train_id: "T12423", train_number: "12423", train_name: "Dibrugarh Rajdhani", priority: 4, direction: "DOWN", current_position_km: 159.0, current_speed_kmh: 0.0, status: "WAITING", total_delay_sec: 960, current_block_id: "BLK_TDL_ALJN_SINGLE", length_meters: 550 })
    ]
  },

  // ── BEAT 5: EVALUATE FUTURES (50–65s) ──────────────────────────
  // Keep railway visible; show 2–3 real backend branches as transparent trajectory paths.
  {
    t: 50000,
    phase: "FUTURE_WORLDS",
    caption: "5. EVALUATE FUTURES & DIVERGENCE",
    subCaption: "Evaluate physical alternatives before commanding the network.",
    teleprinterLine: "08:14:00 SIMULATING COUNTERFACTUAL BRANCHES: BRANCH A (FCFS) vs BRANCH B (LOOP PRECEDENCE)",
    soundCue: "teleprinter",
    cameraFocusKm: 145,
    kpis: makeKPIs({
      throughput_trains_per_hr: 12.0,
      average_delay_minutes: 18.0,
      punctuality_otp_pct: 68.0,
      active_conflicts_predicted: 1
    }),
    predictedConflicts: [
      makeConflict({
        conflict_id: "CONF_EVAL",
        severity: "HIGH",
        location_block_id: "BLK_ALJN_LOOP_1",
        involved_train_ids: ["T12301", "T04403"]
      })
    ],
    candidatePlans: [
      { id: "P1_FCFS", name: "FCFS Baseline", strategy: "First-Come First-Served Queue", delayMin: 42.0, safetyStatus: "SAFE", isOptimal: false },
      { id: "P2_HOLD_MAIN", name: "Mainline Stop", strategy: "Hold Freight on Mainline", delayMin: 28.5, safetyStatus: "UNSAFE", isOptimal: false },
      { id: "P3_LOOP_PREC", name: "Loop Precedence (Optimum)", strategy: "Divert Freight 04403 into ALJN Loop 1 (3 min hold)", delayMin: 3.2, safetyStatus: "SAFE", isOptimal: true }
    ],
    blocks: BASE_BLOCKS,
    trains: [
      makeTrain({ train_id: "T22436", train_number: "22436", train_name: "Vande Bharat Express", priority: 5, direction: "UP", current_position_km: 145.0, current_speed_kmh: 0.0, status: "WAITING", current_block_id: "BLK_GZB_ALJN_UP", length_meters: 400 }),
      makeTrain({ train_id: "T12301", train_number: "12301", train_name: "Rajdhani Express", priority: 4, direction: "UP", current_position_km: 154.5, current_speed_kmh: 0.0, status: "WAITING", current_block_id: "BLK_ALJN_TDL_SINGLE", length_meters: 600 }),
      makeTrain({ train_id: "T04403", train_number: "04403", train_name: "Container Freight Heavy", priority: 2, direction: "DOWN", current_position_km: 156.5, current_speed_kmh: 15.0, status: "RUNNING", current_block_id: "BLK_ALJN_LOOP_1", length_meters: 750 }),
      makeTrain({ train_id: "T12423", train_number: "12423", train_name: "Dibrugarh Rajdhani", priority: 4, direction: "DOWN", current_position_km: 159.0, current_speed_kmh: 0.0, status: "WAITING", current_block_id: "BLK_TDL_ALJN_SINGLE", length_meters: 550 })
    ]
  },
  {
    t: 58000,
    phase: "FUTURE_WORLDS",
    caption: "5. EVALUATE FUTURES & DIVERGENCE",
    subCaption: "Mathematical optimization identifies minimum-delay physical route.",
    teleprinterLine: "08:16:00 CP-SAT SOLVER: OBJECTIVE J=3.2m • VERIFYING INTERLOCKING ROUTE FEASIBILITY",
    soundCue: "teleprinter",
    cameraFocusKm: 142,
    kpis: makeKPIs({
      throughput_trains_per_hr: 16.5,
      average_delay_minutes: 12.0,
      punctuality_otp_pct: 78.0,
      active_conflicts_predicted: 1
    }),
    predictedConflicts: [],
    candidatePlans: [
      { id: "P1_FCFS", name: "FCFS Baseline", strategy: "First-Come First-Served Queue", delayMin: 42.0, safetyStatus: "SAFE", isOptimal: false },
      { id: "P2_HOLD_MAIN", name: "Mainline Stop", strategy: "Hold Freight on Mainline", delayMin: 28.5, safetyStatus: "UNSAFE", isOptimal: false },
      { id: "P3_LOOP_PREC", name: "Loop Precedence (Optimum)", strategy: "Divert Freight 04403 into ALJN Loop 1 (3 min hold)", delayMin: 3.2, safetyStatus: "SAFE", isOptimal: true }
    ],
    blocks: BASE_BLOCKS,
    trains: [
      makeTrain({ train_id: "T22436", train_number: "22436", train_name: "Vande Bharat Express", priority: 5, direction: "UP", current_position_km: 145.0, current_speed_kmh: 0.0, current_block_id: "BLK_GZB_ALJN_UP", length_meters: 400 }),
      makeTrain({ train_id: "T12301", train_number: "12301", train_name: "Rajdhani Express", priority: 4, direction: "UP", current_position_km: 154.5, current_speed_kmh: 0.0, current_block_id: "BLK_ALJN_TDL_SINGLE", length_meters: 600 }),
      makeTrain({ train_id: "T04403", train_number: "04403", train_name: "Container Freight Heavy", priority: 2, direction: "DOWN", current_position_km: 145.0, current_speed_kmh: 25.0, current_block_id: "BLK_ALJN_LOOP_1", length_meters: 750 }),
      makeTrain({ train_id: "T12423", train_number: "12423", train_name: "Dibrugarh Rajdhani", priority: 4, direction: "DOWN", current_position_km: 159.0, current_speed_kmh: 0.0, current_block_id: "BLK_TDL_ALJN_SINGLE", length_meters: 550 })
    ]
  },

  // ── BEAT 6: RESOLVE AND RECOVER (65–75s) ───────────────────────
  // Selected train reserves turnout, enters loop, priority train passes, signals release, held train resumes.
  {
    t: 65000,
    phase: "RESOLVING",
    caption: "6. INTERLOCKING EXECUTION & RECOVERY",
    subCaption: "A validated precedence decision restores capacity safely.",
    teleprinterLine: "08:18:00 ROUTE LOCKED: TURNOUT 12B REVERSE • FREIGHT 04403 SECURED IN LOOP 1 • MAINLINE CLEARED",
    soundCue: "resolve",
    cameraFocusKm: 140,
    kpis: makeKPIs({
      throughput_trains_per_hr: 24.5,
      average_delay_minutes: 2.1,
      punctuality_otp_pct: 95.5,
      active_conflicts_predicted: 0
    }),
    predictedConflicts: [],
    blocks: BASE_BLOCKS,
    trains: [
      makeTrain({ train_id: "T22436", train_number: "22436", train_name: "Vande Bharat Express", priority: 5, direction: "UP", current_position_km: 175.0, current_speed_kmh: 125.0, current_block_id: "BLK_TDL_ETW_UP", length_meters: 400 }),
      makeTrain({ train_id: "T12301", train_number: "12301", train_name: "Rajdhani Express", priority: 4, direction: "UP", current_position_km: 195.0, current_speed_kmh: 120.0, current_block_id: "BLK_TDL_ETW_UP", length_meters: 600 }),
      makeTrain({ train_id: "T04403", train_number: "04403", train_name: "Container Freight Heavy", priority: 2, direction: "DOWN", current_position_km: 145.0, current_speed_kmh: 0.0, status: "WAITING", total_delay_sec: 180, current_block_id: "BLK_ALJN_LOOP_1", length_meters: 750 }),
      makeTrain({ train_id: "T12423", train_number: "12423", train_name: "Dibrugarh Rajdhani", priority: 4, direction: "DOWN", current_position_km: 190.0, current_speed_kmh: 115.0, current_block_id: "BLK_ALJN_GZB_DN", length_meters: 550 })
    ]
  },
  {
    t: 75000,
    phase: "OPTIMAL",
    caption: "6. INTERLOCKING EXECUTION & RECOVERY",
    subCaption: "High-priority traffic clears; yielding train departs with zero headway violation.",
    teleprinterLine: "08:21:00 MAINLINE TRAFFIC FLOW RESTORED • FREIGHT 04403 DEPARTING LOOP 1 • TOTAL SYSTEM DELAY RECOVERED",
    soundCue: "resolve",
    cameraFocusKm: 140,
    kpis: makeKPIs({
      throughput_trains_per_hr: 28.5,
      average_delay_minutes: 0.4,
      punctuality_otp_pct: 98.8,
      active_conflicts_predicted: 0
    }),
    predictedConflicts: [],
    blocks: BASE_BLOCKS,
    trains: [
      makeTrain({ train_id: "T22436", train_number: "22436", train_name: "Vande Bharat Express", priority: 5, direction: "UP", current_position_km: 260.0, current_speed_kmh: 130.0, total_delay_sec: 0, current_block_id: "BLK_TDL_ETW_UP", length_meters: 400 }),
      makeTrain({ train_id: "T12301", train_number: "12301", train_name: "Rajdhani Express", priority: 4, direction: "UP", current_position_km: 275.0, current_speed_kmh: 120.0, total_delay_sec: 0, current_block_id: "BLK_ETW_CNB_UP", length_meters: 600 }),
      makeTrain({ train_id: "T04403", train_number: "04403", train_name: "Container Freight Heavy", priority: 2, direction: "DOWN", current_position_km: 120.0, current_speed_kmh: 75.0, total_delay_sec: 180, current_block_id: "BLK_ALJN_GZB_DN", length_meters: 750 }),
      makeTrain({ train_id: "T12423", train_number: "12423", train_name: "Dibrugarh Rajdhani", priority: 4, direction: "DOWN", current_position_km: 280.0, current_speed_kmh: 125.0, total_delay_sec: 0, current_block_id: "BLK_ALJN_GZB_DN", length_meters: 550 })
    ]
  }
];

function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

/**
 * Resolves a smooth interpolated SequenceFrame for any elapsed millisecond timestamp.
 */
export function resolveFrameAt(keyframes: SequenceFrame[], elapsedMs: number): SequenceFrame {
  if (keyframes.length === 0) throw new Error("Keyframes cannot be empty");
  if (elapsedMs <= keyframes[0].t) return keyframes[0];
  if (elapsedMs >= keyframes[keyframes.length - 1].t) return keyframes[keyframes.length - 1];

  // Find surrounding interval [frameA, frameB]
  let idx = 0;
  while (idx < keyframes.length - 1 && keyframes[idx + 1].t < elapsedMs) {
    idx++;
  }

  const frameA = keyframes[idx];
  const frameB = keyframes[idx + 1];
  const span = frameB.t - frameA.t;
  const alpha = span > 0 ? (elapsedMs - frameA.t) / span : 1;

  // Interpolate numerical train positions and speeds
  const interpolatedTrains = frameA.trains.map((trainA) => {
    const trainB = frameB.trains.find(t => t.train_id === trainA.train_id) || trainA;
    return {
      ...trainB,
      current_position_km: lerp(trainA.current_position_km, trainB.current_position_km, alpha),
      current_speed_kmh: lerp(trainA.current_speed_kmh, trainB.current_speed_kmh, alpha),
      total_delay_sec: Math.round(lerp(trainA.total_delay_sec, trainB.total_delay_sec, alpha)),
    };
  });

  // Interpolate continuous KPIs
  const interpolatedKPIs: OperationalKPIs = {
    ...frameB.kpis,
    throughput_trains_per_hr: Number(lerp(frameA.kpis.throughput_trains_per_hr, frameB.kpis.throughput_trains_per_hr, alpha).toFixed(1)),
    average_delay_minutes: Number(lerp(frameA.kpis.average_delay_minutes, frameB.kpis.average_delay_minutes, alpha).toFixed(1)),
    punctuality_otp_pct: Number(lerp(frameA.kpis.punctuality_otp_pct, frameB.kpis.punctuality_otp_pct, alpha).toFixed(1)),
    track_utilization_pct: Number(lerp(frameA.kpis.track_utilization_pct, frameB.kpis.track_utilization_pct, alpha).toFixed(1)),
    active_conflicts_predicted: Math.round(lerp(frameA.kpis.active_conflicts_predicted, frameB.kpis.active_conflicts_predicted, alpha)),
  };

  return {
    ...frameB,
    trains: interpolatedTrains,
    kpis: interpolatedKPIs,
    cameraFocusKm: lerp(frameA.cameraFocusKm || 160, frameB.cameraFocusKm || 160, alpha)
  };
}
