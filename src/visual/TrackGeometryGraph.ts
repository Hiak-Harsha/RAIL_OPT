/**
 * RAILOPT-X 2.0 — Physical Track Geometry Graph & Spatial Projection Engine.
 * 
 * Provides continuous coordinate transforms from Railway Domain (Block + Km)
 * to 2D/3D World Space (X, Y, Rotation, Curvature, Switch Blades).
 */

import type { TrackBlock } from "../types/railway";

export interface TrackPoint {
  x: number;
  y: number;
  rotation: number;
  trackType: "UP_MAIN" | "DOWN_MAIN" | "LOOP" | "SINGLE_LINE" | "CROSSOVER";
  isDiverging: boolean;
}

export interface SwitchBlade {
  id: string;
  stationId: string;
  positionKm: number;
  state: "NORMAL" | "REVERSE_DIVERGING";
  angleDeg: number;
}

export class TrackGeometryGraph {
  public static readonly Y_UP_MAIN = 140;
  public static readonly Y_UP_LOOP = 85;
  public static readonly Y_DOWN_MAIN = 230;
  public static readonly Y_DOWN_LOOP = 285;
  public static readonly Y_SINGLE_LINE = 185;

  /**
   * Project a 1D corridor kilometer into viewport screen X coordinate.
   */
  public static kmToViewportX(
    km: number,
    viewportStartKm: number,
    viewportEndKm: number,
    canvasWidth: number,
    paddingX: number = 50
  ): number {
    const rangeKm = Math.max(1, viewportEndKm - viewportStartKm);
    const clampedKm = Math.max(viewportStartKm, Math.min(viewportEndKm, km));
    const usableWidth = Math.max(100, canvasWidth - paddingX * 2);
    return paddingX + ((clampedKm - viewportStartKm) / rangeKm) * usableWidth;
  }

  /**
   * Calculates continuous 2D position and heading angle for any entity along the railway.
   */
  public static getWorldPosition(
    positionKm: number,
    blockId: string | undefined,
    blocks: TrackBlock[],
    viewportStartKm: number,
    viewportEndKm: number,
    canvasWidth: number,
    paddingX: number = 50
  ): TrackPoint {
    const x = this.kmToViewportX(positionKm, viewportStartKm, viewportEndKm, canvasWidth, paddingX);
    const block = blockId ? blocks.find((b) => b.id === blockId) : undefined;
    
    // Determine Base Y Line from block type and direction
    let y = this.Y_UP_MAIN;
    let trackType: TrackPoint["trackType"] = "UP_MAIN";
    let isDiverging = false;
    let rotation = 0;

    if (block) {
      if (block.block_type === "LOOP_LINE" || block.id.includes("LOOP")) {
        trackType = "LOOP";
        isDiverging = true;
        y = block.direction === "DOWN" ? this.Y_DOWN_LOOP : this.Y_UP_LOOP;
        rotation = block.direction === "DOWN" ? 180 : 0;
      } else if (block.block_type === "SINGLE_LINE_SECTION" || block.id.includes("SINGLE")) {
        trackType = "SINGLE_LINE";
        y = this.Y_SINGLE_LINE;
        rotation = block.direction === "DOWN" ? 180 : 0;
      } else if (block.direction === "DOWN") {
        trackType = "DOWN_MAIN";
        y = this.Y_DOWN_MAIN;
        rotation = 180;
      } else {
        trackType = "UP_MAIN";
        y = this.Y_UP_MAIN;
        rotation = 0;
      }
    } else {
      if (positionKm >= 150 && positionKm <= 205) {
        y = this.Y_SINGLE_LINE;
        trackType = "SINGLE_LINE";
      }
    }

    return {
      x,
      y,
      rotation,
      trackType,
      isDiverging,
    };
  }

  /**
   * Generates SVG path definition for station loop turnouts and switch crossovers.
   */
  public static getTurnoutPath(
    startKm: number,
    endKm: number,
    fromY: number,
    toY: number,
    viewportStartKm: number,
    viewportEndKm: number,
    canvasWidth: number
  ): string {
    const x1 = this.kmToViewportX(startKm, viewportStartKm, viewportEndKm, canvasWidth);
    const x2 = this.kmToViewportX(endKm, viewportStartKm, viewportEndKm, canvasWidth);
    const cx1 = x1 + (x2 - x1) * 0.4;
    const cx2 = x1 + (x2 - x1) * 0.6;
    return `M ${x1} ${fromY} C ${cx1} ${fromY}, ${cx2} ${toY}, ${x2} ${toY}`;
  }

  /**
   * Computes physical footprint pixel width for a train consist based on actual meters.
   */
  public static getTrainPixelLength(
    trainLengthMeters: number = 450,
    viewportStartKm: number,
    viewportEndKm: number,
    canvasWidth: number
  ): number {
    const rangeKm = Math.max(1, viewportEndKm - viewportStartKm);
    const trainLengthKm = trainLengthMeters / 1000.0;
    const pxPerKm = canvasWidth / rangeKm;
    return Math.max(28, Math.min(140, trainLengthKm * pxPerKm));
  }
}
