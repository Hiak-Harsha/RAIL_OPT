/**
 * RAILOPT-X 2.0 — Authoritative Rail Topology & Continuous Spline Projection Engine
 * 
 * Maps discrete graph coordinates (edgeId, sAlongEdgeM) to continuous 2D/3D world space
 * (x, y, headingRad, tangentX, tangentY, curvature).
 * 
 * Camera Modes:
 * - OVERVIEW: Full 435km corridor view
 * - FOLLOW_TRAIN: High-speed smooth tracking with physics dampening
 * - FRAME_CONFLICT: Centered on bottleneck or crossing conflict
 * - FRAME_STATION: Meso view of station interlocking & platforms
 * - FRAME_BRANCH_DIVERGENCE: Micro zoom on turnout switches and loop lines
 * - INFRASTRUCTURE: Display signals, speed boards, block gradients, OHE
 * - REPLAY: Scrubbable historic playback
 */

import type { TrackBlock, Train } from "../types/railway";

export type CameraMode = 
  | "OVERVIEW"
  | "FOLLOW_TRAIN"
  | "FRAME_CONFLICT"
  | "FRAME_STATION"
  | "FRAME_BRANCH_DIVERGENCE"
  | "INFRASTRUCTURE"
  | "REPLAY";

export type LevelOfDetail = "MACRO" | "MESO" | "MICRO";

export interface ProjectedPoint {
  x: number;
  y: number;
  headingRad: number;
  headingDeg: number;
  tangentX: number;
  tangentY: number;
  elevationM: number;
  gradientPercent: number;
  curvature: number;
  trackType: "MAIN_LINE" | "LOOP_LINE" | "SINGLE_LINE" | "TURNOUT_DIVERGING" | "CROSSOVER";
  isDiverging: boolean;
}

export interface CameraViewport {
  startKm: number;
  endKm: number;
  zoom: number;
  targetX: number;
  targetY: number;
  mode: CameraMode;
  lod: LevelOfDetail;
}

export class RailTopology {
  public static readonly Y_UP_MAIN = 140;
  public static readonly Y_UP_LOOP = 80;
  public static readonly Y_DOWN_MAIN = 230;
  public static readonly Y_DOWN_LOOP = 290;
  public static readonly Y_SINGLE_LINE = 185;

  /**
   * Determine Level of Detail from viewport kilometer range
   */
  public static getLOD(viewportSpanKm: number): LevelOfDetail {
    if (viewportSpanKm > 150) return "MACRO";
    if (viewportSpanKm > 40) return "MESO";
    return "MICRO";
  }

  /**
   * Continuous projection from (edgeId, sAlongEdgeM) or (corridorKm, block) to screen space
   */
  public static projectCoordinate(
    edgeId: string | undefined,
    sAlongEdgeM: number,
    corridorKm: number,
    blocks: TrackBlock[],
    viewportStartKm: number,
    viewportEndKm: number,
    canvasWidth: number,
    paddingX: number = 60
  ): ProjectedPoint {
    const rangeKm = Math.max(1, viewportEndKm - viewportStartKm);
    const usableWidth = Math.max(100, canvasWidth - paddingX * 2);
    const x = paddingX + ((corridorKm - viewportStartKm) / rangeKm) * usableWidth;

    const block = edgeId ? blocks.find((b) => b.id === edgeId) : undefined;
    
    let baseY = this.Y_UP_MAIN;
    let targetY = this.Y_UP_MAIN;
    let trackType: ProjectedPoint["trackType"] = "MAIN_LINE";
    let isDiverging = false;
    let headingRad = 0;
    let tangentX = 1.0;
    let tangentY = 0.0;
    let elevationM = 210.0;
    let gradientPercent = 0.0;
    let curvature = 0.0;

    if (block) {
      elevationM = block.elevation_start_m || 210.0;
      gradientPercent = block.gradient_percent || 0.0;

      if (block.block_type === "LOOP_LINE" || block.id.includes("LOOP")) {
        trackType = "LOOP_LINE";
        targetY = block.direction === "DOWN" ? this.Y_DOWN_LOOP : this.Y_UP_LOOP;
        baseY = block.direction === "DOWN" ? this.Y_DOWN_MAIN : this.Y_UP_MAIN;
        
        // Turnout transition spline: entering loop or departing loop
        const blockLenM = Math.max(100, block.length_km * 1000);
        const progress = Math.min(1.0, Math.max(0.0, sAlongEdgeM / blockLenM));
        
        if (progress < 0.25) {
          // Entry turnout curve: ease from mainline to loop
          const t = progress / 0.25;
          const smoothT = t * t * (3 - 2 * t);
          baseY = baseY + (targetY - baseY) * smoothT;
          isDiverging = true;
          trackType = "TURNOUT_DIVERGING";
          tangentY = (targetY - baseY) * (6 * t * (1 - t)) * 0.005;
          curvature = 0.002;
        } else if (progress > 0.75) {
          // Exit turnout curve: ease from loop back to mainline
          const t = (progress - 0.75) / 0.25;
          const smoothT = t * t * (3 - 2 * t);
          baseY = targetY + (baseY - targetY) * smoothT;
          isDiverging = true;
          trackType = "TURNOUT_DIVERGING";
          tangentY = (baseY - targetY) * (6 * t * (1 - t)) * 0.005;
          curvature = -0.002;
        } else {
          baseY = targetY;
        }

        headingRad = block.direction === "DOWN" ? Math.PI : 0;
      } else if (block.block_type === "SINGLE_LINE_SECTION" || block.id.includes("SINGLE")) {
        trackType = "SINGLE_LINE";
        baseY = this.Y_SINGLE_LINE;
        headingRad = block.direction === "DOWN" ? Math.PI : 0;
      } else if (block.direction === "DOWN") {
        trackType = "MAIN_LINE";
        baseY = this.Y_DOWN_MAIN;
        headingRad = Math.PI;
        tangentX = -1.0;
      } else {
        trackType = "MAIN_LINE";
        baseY = this.Y_UP_MAIN;
        headingRad = 0;
        tangentX = 1.0;
      }
    } else {
      if (corridorKm >= 150 && corridorKm <= 205) {
        baseY = this.Y_SINGLE_LINE;
        trackType = "SINGLE_LINE";
      }
    }

    const norm = Math.hypot(tangentX, tangentY);
    tangentX = norm > 0 ? tangentX / norm : 1.0;
    tangentY = norm > 0 ? tangentY / norm : 0.0;
    headingRad = Math.atan2(tangentY, tangentX);

    return {
      x,
      y: baseY,
      headingRad,
      headingDeg: (headingRad * 180) / Math.PI,
      tangentX,
      tangentY,
      elevationM,
      gradientPercent,
      curvature,
      trackType,
      isDiverging,
    };
  }

  /**
   * Computes camera target focus window for any selected entity or conflict
   */
  public static getCameraFocus(
    mode: CameraMode,
    focusedTrain: Train | null,
    focusedConflictKm: number | null,
    focusedStationKm: number | null,
    corridorTotalKm: number = 435.0
  ): { startKm: number; endKm: number; lod: LevelOfDetail } {
    if (mode === "OVERVIEW") {
      return { startKm: 0, endKm: corridorTotalKm, lod: "MACRO" };
    }

    if (mode === "FOLLOW_TRAIN" && focusedTrain) {
      const trainKm = focusedTrain.corridor_position_km ?? focusedTrain.current_position_km ?? 50.0;
      const span = 45.0;
      const startKm = Math.max(0, trainKm - span / 2);
      const endKm = Math.min(corridorTotalKm, startKm + span);
      return { startKm, endKm, lod: "MICRO" };
    }

    if (mode === "FRAME_CONFLICT" && focusedConflictKm !== null) {
      const span = 35.0;
      const startKm = Math.max(0, focusedConflictKm - span / 2);
      const endKm = Math.min(corridorTotalKm, startKm + span);
      return { startKm, endKm, lod: "MICRO" };
    }

    if (mode === "FRAME_STATION" && focusedStationKm !== null) {
      const span = 50.0;
      const startKm = Math.max(0, focusedStationKm - span / 2);
      const endKm = Math.min(corridorTotalKm, startKm + span);
      return { startKm, endKm, lod: "MESO" };
    }

    if (mode === "FRAME_BRANCH_DIVERGENCE" && focusedConflictKm !== null) {
      const span = 20.0;
      const startKm = Math.max(0, focusedConflictKm - span / 2);
      const endKm = Math.min(corridorTotalKm, startKm + span);
      return { startKm, endKm, lod: "MICRO" };
    }

    // Default corridor meso window
    return { startKm: 0, endKm: 120.0, lod: "MESO" };
  }
}
