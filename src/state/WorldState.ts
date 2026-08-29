/**
 * RAILOPT-X 2.0 — Canonical World State & Command Architecture.
 * 
 * Defines global operational contracts:
 *  - WorldMode (Single source of truth for runtime operational mode)
 *  - WorldFocus (Unified spatial camera and attention bounds)
 *  - SimulationCommand & DecisionCommand contracts
 */

export type WorldMode =
  | "LIVE"
  | "SIMULATION"
  | "PREVIEW"
  | "WHAT_IF"
  | "REPLAY"
  | "CINEMATIC";

export type VisualizationScale =
  | "CORRIDOR_OVERVIEW"       // Scale 1: Full 435 km minimap
  | "ACTIVE_OPERATIONAL_WINDOW" // Scale 2: 60-100 km physical railway
  | "FOCUS_BUBBLE";            // Scale 3: 15-30 km critical incident inspection

export interface WorldFocus {
  mode: "GLOBAL" | "TRAIN" | "CONFLICT" | "STATION" | "BRANCH" | "INFRASTRUCTURE";
  entityIds: string[];
  centerKm: number;
  startKm: number;
  endKm: number;
  radiusKm: number;
  reason?: string;
}

export interface EventSpotlight {
  spotlightId: string;
  eventId?: string;
  entityIds: string[];
  centerKm: number;
  radiusKm: number;
  durationMs: number;
  label: string;
  active: boolean;
}

export type SimulationCommandType =
  | "START"
  | "PAUSE"
  | "RESET"
  | "SET_SCALE"
  | "JUMP_TO_EVENT"
  | "JUMP_TO_TIME"
  | "LOAD_EPISODE"
  | "APPLY_SCENARIO"
  | "PREVIEW_BRANCH"
  | "APPLY_CANDIDATE";

export interface SimulationCommand {
  type: SimulationCommandType;
  payload?: any;
  timestamp: number;
}

export type DecisionCommandType =
  | "SELECT_CANDIDATE"
  | "PREVIEW_CANDIDATE"
  | "CLEAR_PREVIEW"
  | "APPLY_CANDIDATE"
  | "APPROVE"
  | "REJECT"
  | "OVERRIDE";

export interface DecisionCommand {
  type: DecisionCommandType;
  candidateId?: string;
  recommendationId?: string;
  overrideReason?: string;
  timestamp: number;
}
