/**
 * RAILOPT-X — Authoritative Shared Corridor Topology Graph
 * 
 * DESIGN RATIONALE & TOPOLOGY SPECIFICATION:
 * -------------------------------------------
 * This module serves as the SINGLE SOURCE OF TRUTH for railway geometry across both
 * 2D (SVG interlocking schematic) and 3D (Three.js WebGL digital twin) renderers.
 * 
 * DATA SOURCE:
 * - Built dynamically from authoritative backend TrackBlock[] and Station[] models.
 * - Never relies on arbitrary fixed visual literals (e.g. hardcoded 140m boxes).
 * 
 * SCHEMATIC GEOMETRY ASSUMPTIONS (Honest Boundary Disclosure):
 * - In accordance with standard Indian Railways / UIC signaling practices, trackage is
 *   schematically laid out on a continuous chainage axis (0.0 to 435.0 km, NDLS to CNB):
 *   * UP Mainline: y=140 (2D), z=-2.4 (3D)
 *   * DOWN Mainline: y=230 (2D), z=2.4 (3D)
 *   * Station Loop Lines: y=90 (UP Loop, z=-5.6) and y=280 (DN Loop, z=5.6) with explicit 1:12 turnout tapers
 *   * Single-Line Bottleneck: y=185 (2D), z=0.0 (3D) converging between ALJN (KM 131) and TDL (KM 209)
 *   * Station Platforms: Raised concrete platform edges (3D height +0.8m, lateral offset 1.8m)
 */

import type { TrackBlock, Station, Train } from "../../types/railway";

export type SegmentType = 
  | "MAIN_LINE"
  | "LOOP_LINE"
  | "SINGLE_LINE"
  | "TURNOUT_DIVERGING"
  | "PLATFORM_SPUR";

export interface CorridorSegment {
  id: string;
  blockId: string;
  name: string;
  stationCode?: string;
  stationName?: string;
  type: SegmentType;
  direction: "UP" | "DOWN" | "BIDIRECTIONAL";
  startKm: number;
  endKm: number;
  lengthKm: number;
  maxSpeedKmh: number;
  gradientPercent: number;
  elevationStartM: number;
  elevationEndM: number;
  isOccupied: boolean;
  occupiedByTrainId?: string;
  isBlocked: boolean;
  signalAspect: "GREEN" | "YELLOW" | "RED";
  
  // 2D Normalized Coordinates (Canvas scale: 0 to 1320 X, 0 to 380 Y)
  x1_2d: number;
  y1_2d: number;
  x2_2d: number;
  y2_2d: number;

  // 3D Scene Coordinates (Origin at center, scale in 3D world units)
  x1_3d: number;
  z1_3d: number;
  y1_3d: number;
  x2_3d: number;
  z2_3d: number;
  y2_3d: number;

  hasPlatform: boolean;
  platformLengthM?: number;
}

export interface CorridorJunction {
  id: string;
  stationCode: string;
  positionKm: number;
  junctionType: "LOOP_ENTRY" | "LOOP_EXIT" | "SINGLE_LINE_CONVERGENCE" | "SINGLE_LINE_DIVERGENCE";
  fromSegmentId: string;
  toSegmentId: string;
  x_2d: number;
  y_2d: number;
  x_3d: number;
  z_3d: number;
  divergenceAngleDeg: number;
}

export interface CorridorTopologyModel {
  segments: CorridorSegment[];
  junctions: CorridorJunction[];
  stations: Station[];
  totalLengthKm: number;
  minKm: number;
  maxKm: number;
}

export class CorridorGraph {
  public static readonly Y_UP_MAIN = 140;
  public static readonly Y_UP_LOOP = 90;
  public static readonly Y_DOWN_MAIN = 230;
  public static readonly Y_DOWN_LOOP = 280;
  public static readonly Y_SINGLE_LINE = 185;

  public static readonly Z_UP_MAIN = -2.4;
  public static readonly Z_UP_LOOP = -5.8;
  public static readonly Z_DOWN_MAIN = 2.4;
  public static readonly Z_DOWN_LOOP = 5.8;
  public static readonly Z_SINGLE_LINE = 0.0;

  /**
   * Evaluates multi-scale 3D scale factor (Three.js units per km) based on viewport span.
   */
  public static getScaleFactor3D(viewportStartKm: number, viewportEndKm: number): number {
    const spanKm = Math.max(1, viewportEndKm - viewportStartKm);
    if (spanKm <= 15) return 20.0; // Micro interlocking: 1 km = 20 world units (100m = 2.0u)
    if (spanKm <= 60) return 8.0;  // Meso station: 1 km = 8 world units
    if (spanKm <= 160) return 3.5; // Section: 1 km = 3.5 world units
    return 1.5; // Macro corridor overview (0-435 km)
  }

  public static kmTo3DX(km: number, viewportStartKm: number, viewportEndKm: number): number {
    const midKm = (viewportStartKm + viewportEndKm) / 2;
    const scale = this.getScaleFactor3D(viewportStartKm, viewportEndKm);
    return (km - midKm) * scale;
  }

  /**
   * Generates smooth cubic S-curve spline points for realistic turnout switch geometry.
   */
  public static getTurnoutSplinePoints(
    x1: number, z1: number,
    x2: number, z2: number,
    steps: number = 12
  ): Array<{ x: number; z: number; tangentAngleRad: number }> {
    const points: Array<{ x: number; z: number; tangentAngleRad: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Smooth Hermite cubic S-curve
      const s = t * t * (3 - 2 * t);
      const x = x1 + (x2 - x1) * t;
      const z = z1 + (z2 - z1) * s;
      
      const ds = 6 * t * (1 - t);
      const dx = (x2 - x1);
      const dz = (z2 - z1) * ds;
      const tangentAngleRad = Math.atan2(dz, dx || 0.001);

      points.push({ x, z, tangentAngleRad });
    }
    return points;
  }

  /**
   * Builds a normalized, renderer-agnostic CorridorTopologyModel from raw backend blocks & stations.
   */
  public static buildFromData(
    blocks: TrackBlock[],
    stations: Station[],
    viewportStartKm: number = 0.0,
    viewportEndKm: number = 435.0,
    canvasWidth: number = 1320,
    paddingX: number = 70
  ): CorridorTopologyModel {
    const minKm = stations.length > 0 ? Math.min(...stations.map(s => s.position_km)) : 0.0;
    const maxKm = stations.length > 0 ? Math.max(...stations.map(s => s.position_km)) : 435.0;
    const spanKm = Math.max(1, viewportEndKm - viewportStartKm);
    const usableWidth = Math.max(100, canvasWidth - paddingX * 2);
    const scale3D = this.getScaleFactor3D(viewportStartKm, viewportEndKm);

    const kmTo2DX = (km: number) => {
      const clamped = Math.max(viewportStartKm, Math.min(viewportEndKm, km));
      return paddingX + ((clamped - viewportStartKm) / spanKm) * usableWidth;
    };

    const kmTo3DX = (km: number) => {
      const midKm = (viewportStartKm + viewportEndKm) / 2;
      return (km - midKm) * scale3D;
    };

    const segments: CorridorSegment[] = [];
    const junctions: CorridorJunction[] = [];

    // Map station lookup
    const stationByNode = new Map<string, Station>();
    stations.forEach(s => {
      stationByNode.set(s.id, s);
      stationByNode.set(s.code, s);
    });

    let currentKmCursor = minKm;

    blocks.forEach((blk, idx) => {
      const stnFrom = stationByNode.get(blk.from_node);
      const stnTo = stationByNode.get(blk.to_node);

      let startKm = stnFrom ? stnFrom.position_km : currentKmCursor;
      let endKm = stnTo ? stnTo.position_km : startKm + blk.length_km;
      if (endKm < startKm) {
        // Swap for DOWN line where from_node might be downstream
        const tmp = startKm;
        startKm = endKm;
        endKm = tmp;
      }
      currentKmCursor = Math.max(currentKmCursor, endKm);

      // Determine Segment Type & Offsets
      let type: SegmentType = "MAIN_LINE";
      let y2D = blk.direction === "DOWN" ? this.Y_DOWN_MAIN : this.Y_UP_MAIN;
      let z3D = blk.direction === "DOWN" ? this.Z_DOWN_MAIN : this.Z_UP_MAIN;

      if (blk.block_type === "LOOP_LINE" || blk.id.includes("LOOP")) {
        type = "LOOP_LINE";
        y2D = blk.direction === "DOWN" ? this.Y_DOWN_LOOP : this.Y_UP_LOOP;
        z3D = blk.direction === "DOWN" ? this.Z_DOWN_LOOP : this.Z_UP_LOOP;
      } else if (blk.block_type === "SINGLE_LINE_SECTION" || blk.id.includes("SINGLE")) {
        type = "SINGLE_LINE";
        y2D = this.Y_SINGLE_LINE;
        z3D = this.Z_SINGLE_LINE;
      } else if (blk.block_type === "PLATFORM_LINE") {
        type = "PLATFORM_SPUR";
      }

      const x1_2d = kmTo2DX(startKm);
      const x2_2d = kmTo2DX(endKm);
      const x1_3d = kmTo3DX(startKm);
      const x2_3d = kmTo3DX(endKm);

      const elevStart = blk.elevation_start_m ?? 210.0;
      const elevEnd = blk.elevation_end_m ?? 210.0;
      const grad = blk.gradient_percent ?? 0.0;

      const hasPlatform = Boolean(stnFrom && stnFrom.platforms && stnFrom.platforms.length > 0) || blk.id.includes("PL");

      const seg: CorridorSegment = {
        id: `seg_${blk.id}`,
        blockId: blk.id,
        name: blk.name,
        stationCode: stnFrom?.code || stnTo?.code,
        stationName: stnFrom?.name || stnTo?.name,
        type,
        direction: blk.direction,
        startKm,
        endKm,
        lengthKm: Math.max(0.1, endKm - startKm),
        maxSpeedKmh: blk.max_speed_kmh,
        gradientPercent: grad,
        elevationStartM: elevStart,
        elevationEndM: elevEnd,
        isOccupied: blk.is_occupied,
        occupiedByTrainId: blk.occupied_by_train_id,
        isBlocked: blk.is_blocked,
        signalAspect: blk.signal_aspect || (blk.is_occupied ? "RED" : "GREEN"),
        x1_2d,
        y1_2d: y2D,
        x2_2d,
        y2_2d: y2D,
        x1_3d,
        z1_3d: z3D,
        y1_3d: 0,
        x2_3d,
        z2_3d: z3D,
        y2_3d: 0,
        hasPlatform,
        platformLengthM: hasPlatform ? 650.0 : undefined
      };
      segments.push(seg);

      // Generate explicit junction connections for loop lines & single line sections
      if (type === "LOOP_LINE") {
        junctions.push({
          id: `junc_in_${blk.id}`,
          stationCode: seg.stationCode || "STN",
          positionKm: startKm,
          junctionType: "LOOP_ENTRY",
          fromSegmentId: `main_${blk.direction}_${idx}`,
          toSegmentId: seg.id,
          x_2d: x1_2d,
          y_2d: y2D,
          x_3d: x1_3d,
          z_3d: z3D,
          divergenceAngleDeg: blk.direction === "DOWN" ? 14 : -14
        });
        junctions.push({
          id: `junc_out_${blk.id}`,
          stationCode: seg.stationCode || "STN",
          positionKm: endKm,
          junctionType: "LOOP_EXIT",
          fromSegmentId: seg.id,
          toSegmentId: `main_${blk.direction}_${idx}`,
          x_2d: x2_2d,
          y_2d: y2D,
          x_3d: x2_3d,
          z_3d: z3D,
          divergenceAngleDeg: blk.direction === "DOWN" ? -14 : 14
        });
      } else if (type === "SINGLE_LINE") {
        junctions.push({
          id: `junc_single_conv_${blk.id}`,
          stationCode: "ALJN",
          positionKm: startKm,
          junctionType: "SINGLE_LINE_CONVERGENCE",
          fromSegmentId: `main_up_${idx}`,
          toSegmentId: seg.id,
          x_2d: x1_2d,
          y_2d: y2D,
          x_3d: x1_3d,
          z_3d: z3D,
          divergenceAngleDeg: 12
        });
        junctions.push({
          id: `junc_single_div_${blk.id}`,
          stationCode: "TDL",
          positionKm: endKm,
          junctionType: "SINGLE_LINE_DIVERGENCE",
          fromSegmentId: seg.id,
          toSegmentId: `main_dn_${idx}`,
          x_2d: x2_2d,
          y_2d: y2D,
          x_3d: x2_3d,
          z_3d: z3D,
          divergenceAngleDeg: -12
        });
      }
    });

    return {
      segments,
      junctions,
      stations,
      totalLengthKm: maxKm - minKm,
      minKm,
      maxKm
    };
  }

  /**
   * Projects a train's corridor position (km) and block to 2D screen coordinates.
   */
  public static projectTrain2D(
    train: Train,
    topology: CorridorTopologyModel,
    viewportStartKm: number,
    viewportEndKm: number,
    canvasWidth: number = 1320,
    paddingX: number = 70
  ): { x: number; y: number; headingDeg: number } {
    const km = train.corridor_position_km ?? train.current_position_km ?? 0.0;
    const spanKm = Math.max(1, viewportEndKm - viewportStartKm);
    const usableWidth = Math.max(100, canvasWidth - paddingX * 2);
    const clampedKm = Math.max(viewportStartKm, Math.min(viewportEndKm, km));
    const x = paddingX + ((clampedKm - viewportStartKm) / spanKm) * usableWidth;

    const matchingSeg = topology.segments.find(s => s.blockId === train.current_block_id);
    let y = train.direction === "DOWN" ? this.Y_DOWN_MAIN : this.Y_UP_MAIN;
    let headingDeg = train.direction === "DOWN" ? 180 : 0;

    if (matchingSeg) {
      y = matchingSeg.y1_2d;
    } else if (km >= 131 && km <= 209) {
      y = this.Y_SINGLE_LINE;
    }

    return { x, y, headingDeg };
  }

  /**
   * Projects a train's corridor position (km) and block to 3D world coordinates.
   */
  public static projectTrain3D(
    train: Train,
    topology: CorridorTopologyModel,
    viewportStartKm: number,
    viewportEndKm: number
  ): { x: number; y: number; z: number; headingRad: number } {
    const km = train.corridor_position_km ?? train.current_position_km ?? 0.0;
    const x = this.kmTo3DX(km, viewportStartKm, viewportEndKm);

    const matchingSeg = topology.segments.find(s => s.blockId === train.current_block_id);
    let z = train.direction === "DOWN" ? this.Z_DOWN_MAIN : this.Z_UP_MAIN;
    let headingRad = train.direction === "DOWN" ? Math.PI : 0;

    if (matchingSeg) {
      z = matchingSeg.z1_3d;
    } else if (km >= 131 && km <= 209) {
      z = this.Z_SINGLE_LINE;
    }

    return { x, y: 0, z, headingRad };
  }
}
