/**
 * RAILOPT-X — Authoritative Entity Visual State Policy Engine
 * 
 * DESIGN RATIONALE:
 * -----------------
 * Single source of truth turning raw backend domain telemetry into unambiguous visual states.
 * Guarantees that the 2D Interlocking Schematic and 3D WebGL Digital Twin always render
 * identical physical causes (e.g. held train beacons, braking lights, block occupancy glow,
 * and signal aspects) without separate inline interpretations.
 */

import type { Train, TrackBlock, Signal, SignalAspect, WaitReason } from "../../types/railway";

export type MotionVisualState = "ACCELERATING" | "CRUISING" | "BRAKING" | "STOPPED";

export interface TrainVisualState {
  trainId: string;
  motionState: MotionVisualState;
  heldReasonLabel: string | null;
  isDwelling: boolean;
  isDisrupted: boolean;
  isBraking: boolean;
  isHeld: boolean;
  beaconColor: string | null;
  beaconHex: number | null;
  brakeLightIntensity: number;
  doorsOpen: boolean;
  doorsOpenProgress: number;
  speedKmH: number;
  color: string;
}

export interface BlockVisualState {
  blockId: string;
  occupied: boolean;
  occupiedByTrainId: string | null;
  isBlocked: boolean;
  signalAspect: SignalAspect;
  emissiveColor: string;
  emissiveHex: number;
  emissiveIntensity: number;
}

export interface SignalVisualState {
  signalId: string;
  aspect: SignalAspect;
  aspectColor: string;
  aspectHex: number;
  isStopAspect: boolean;
}

export class EntityVisualState {
  /**
   * Pure resolution of train visual posture, braking lights, and held beacons from domain status.
   */
  public static getTrainVisualState(train: Train, wait_reason?: WaitReason | null): TrainVisualState {
    const status = train.status || "RUNNING";
    const speed = train.current_speed_kmh || 0;

    const isDwelling = status === "DWELLING";
    const isDisrupted = status === "DISRUPTED";
    const isBraking = status === "BRAKING" || status === "APPROACHING_SIGNAL" || status === "APPROACHING_STATION";
    const isHeld = (
      ["WAITING_FOR_ROUTE", "WAITING_FOR_HEADWAY", "WAITING", "STOPPED", "DISRUPTED"].includes(status) ||
      (train.hold_duration_remaining_sec !== undefined && train.hold_duration_remaining_sec > 0) ||
      Boolean(train.wait_reason) ||
      Boolean(wait_reason)
    );

    let motionState: MotionVisualState = "CRUISING";
    if (isBraking) {
      motionState = "BRAKING";
    } else if (status === "ACCELERATING" || status === "DEPARTING") {
      motionState = "ACCELERATING";
    } else if (speed === 0 || isDwelling || isHeld) {
      motionState = "STOPPED";
    } else {
      motionState = "CRUISING";
    }

    // Resolve WaitReason message
    let heldReasonLabel: string | null = null;
    if (wait_reason?.message) {
      heldReasonLabel = wait_reason.message;
    } else if (train.wait_reason?.message) {
      heldReasonLabel = train.wait_reason.message;
    } else if (status === "WAITING_FOR_ROUTE") {
      heldReasonLabel = "Held: Route interlocking locked";
    } else if (status === "WAITING_FOR_HEADWAY") {
      heldReasonLabel = "Held: 180s headway separation buffer";
    } else if (status === "DISRUPTED") {
      heldReasonLabel = "Disrupted: Section unavailable";
    } else if (isHeld) {
      heldReasonLabel = "Held: Interlocking stop signal";
    }

    // Beacon Colors
    let beaconColor: string | null = null;
    let beaconHex: number | null = null;
    if (isDisrupted) {
      beaconColor = "#FF1744";
      beaconHex = 0xFF1744;
    } else if (isHeld) {
      beaconColor = "#FF8C1A";
      beaconHex = 0xFF8C1A;
    }

    // Brake Lights (1.0 for active braking, 0.4 for holding still, 0 for cruising)
    let brakeLightIntensity = 0.0;
    if (isBraking) {
      brakeLightIntensity = 1.0;
    } else if (motionState === "STOPPED" && !isDwelling) {
      brakeLightIntensity = 0.5;
    }

    // Train Theme Color
    let color = "#38BDF8";
    if (isDisrupted) color = "#FF1744";
    else if (isHeld) color = "#FF8C1A";
    else if (train.priority >= 5) color = "#00D4FF";
    else if (train.priority === 4) color = "#FFB300";

    return {
      trainId: train.train_id,
      motionState,
      heldReasonLabel,
      isDwelling,
      isDisrupted,
      isBraking,
      isHeld,
      beaconColor,
      beaconHex,
      brakeLightIntensity,
      doorsOpen: isDwelling,
      doorsOpenProgress: isDwelling ? 1.0 : 0.0,
      speedKmH: speed,
      color,
    };
  }

  /**
   * Pure resolution of physical track block occupancy, interlocking reservation, and glow.
   */
  public static getBlockVisualState(block: TrackBlock, trains?: Train[]): BlockVisualState {
    const occupied = Boolean(block.is_occupied);
    const isBlocked = Boolean(block.is_blocked);
    const occupiedByTrainId = block.occupied_by_train_id || (trains ? trains.find(t => t.current_block_id === block.id)?.train_id || null : null);

    const signalAspect = (block.signal_aspect as SignalAspect) || (occupied ? "RED" : "GREEN");

    let emissiveColor = "#2A4054";
    let emissiveHex = 0x141C24;
    let emissiveIntensity = 0.05;

    if (isBlocked) {
      emissiveColor = "#D62828";
      emissiveHex = 0xD62828;
      emissiveIntensity = 1.2;
    } else if (occupied) {
      emissiveColor = "#FF8C1A";
      emissiveHex = 0xFF8C1A;
      emissiveIntensity = 0.85;
    } else if (block.block_type === "SINGLE_LINE_SECTION" || block.id.includes("SINGLE")) {
      emissiveColor = "#E5A93C";
      emissiveHex = 0xE5A93C;
      emissiveIntensity = 0.3;
    } else if (block.block_type === "LOOP_LINE" || block.id.includes("LOOP")) {
      emissiveColor = "#00D4FF";
      emissiveHex = 0x00D4FF;
      emissiveIntensity = 0.35;
    }

    return {
      blockId: block.id,
      occupied,
      occupiedByTrainId,
      isBlocked,
      signalAspect,
      emissiveColor,
      emissiveHex,
      emissiveIntensity,
    };
  }

  /**
   * Pure resolution of 4-aspect signal colors and physical aspect state.
   */
  public static getSignalVisualState(signal?: Signal | null, aspectFallback?: SignalAspect | string): SignalVisualState {
    const aspect: SignalAspect = (signal?.aspect as SignalAspect) || (aspectFallback as SignalAspect) || "GREEN";

    let aspectColor = "#00E676";
    let aspectHex = 0x00E676;

    switch (aspect) {
      case "RED":
        aspectColor = "#FF1744";
        aspectHex = 0xFF1744;
        break;
      case "YELLOW":
        aspectColor = "#FFB300";
        aspectHex = 0xFFB300;
        break;
      case "DOUBLE_YELLOW":
        aspectColor = "#FFD600";
        aspectHex = 0xFFD600;
        break;
      case "GREEN":
      default:
        aspectColor = "#00E676";
        aspectHex = 0x00E676;
        break;
    }

    return {
      signalId: signal?.id || "SIG_DEFAULT",
      aspect,
      aspectColor,
      aspectHex,
      isStopAspect: aspect === "RED",
    };
  }
}
