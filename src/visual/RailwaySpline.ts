/**
 * RAILOPT-X 2.0 — True Physical Railway Spline & Continuous Track Geometry Graph.
 * 
 * Replaces discrete 1D horizontal lane offsets with continuous 2D cubic bezier 
 * track geometry, turnout frogs, diverging loop curves, and tangent poses.
 */

export interface TrackPose {
  x: number;
  y: number;
  rotationDeg: number;
  curvature: number;
  trackType: "UP_MAIN" | "DOWN_MAIN" | "LOOP_LINE" | "SINGLE_LINE" | "CROSSOVER";
  isDiverging: boolean;
}

export interface SplinePoint {
  km: number;
  x: number;
  y: number;
  tangentX: number;
  tangentY: number;
}

export interface SwitchMachine {
  switchId: string;
  stationId: string;
  facingKm: number;
  trailingKm: number;
  normalY: number;
  divergingY: number;
  state: "NORMAL" | "REVERSE_DIVERGING";
  lockedByTrainId?: string;
}

export class RailwaySpline {
  public static readonly TOTAL_CORRIDOR_KM = 435.0;

  // Track Baseline Elevations
  public static readonly BASE_Y_UP_MAIN = 135;
  public static readonly BASE_Y_UP_LOOP = 78;
  public static readonly BASE_Y_DOWN_MAIN = 235;
  public static readonly BASE_Y_DOWN_LOOP = 292;
  public static readonly BASE_Y_SINGLE_LINE = 185;

  /**
   * Project corridor kilometer to 2D viewport screen X.
   */
  public static kmToScreenX(
    km: number,
    viewportStartKm: number,
    viewportEndKm: number,
    canvasWidth: number,
    paddingX: number = 60
  ): number {
    const rangeKm = Math.max(1, viewportEndKm - viewportStartKm);
    const clampedKm = Math.max(viewportStartKm, Math.min(viewportEndKm, km));
    const usableWidth = Math.max(100, canvasWidth - paddingX * 2);
    return paddingX + ((clampedKm - viewportStartKm) / rangeKm) * usableWidth;
  }

  /**
   * Computes the continuous 2D pose (position, heading rotation, curvature)
   * for a train or entity moving at a specific kilometer on a given track block.
   */
  public static getPose(
    positionKm: number,
    blockId: string | undefined,
    direction: "UP" | "DOWN" = "UP",
    viewportStartKm: number = 0,
    viewportEndKm: number = 435,
    canvasWidth: number = 1320
  ): TrackPose {
    const x = this.kmToScreenX(positionKm, viewportStartKm, viewportEndKm, canvasWidth);
    let y = this.BASE_Y_UP_MAIN;
    let trackType: TrackPose["trackType"] = "UP_MAIN";
    let isDiverging = false;
    let rotationDeg = direction === "DOWN" ? 180 : 0;
    let curvature = 0.0;

    const isSingleLineBlock = blockId?.includes("SINGLE") || (positionKm >= 148 && positionKm <= 208);
    const isLoopBlock = blockId?.includes("LOOP");

    if (isSingleLineBlock) {
      trackType = "SINGLE_LINE";
      // Natural sigmoid transition into single line bottleneck
      if (positionKm < 155) {
        const t = (positionKm - 148) / 7.0; // 0 to 1
        const clampedT = Math.max(0, Math.min(1, t));
        const smoothT = clampedT * clampedT * (3 - 2 * clampedT);
        const startY = direction === "DOWN" ? this.BASE_Y_DOWN_MAIN : this.BASE_Y_UP_MAIN;
        y = startY + (this.BASE_Y_SINGLE_LINE - startY) * smoothT;
        const slope = (this.BASE_Y_SINGLE_LINE - startY) * 6 * clampedT * (1 - clampedT);
        rotationDeg += (Math.atan2(slope, 150) * 180) / Math.PI;
        curvature = Math.abs(slope) * 0.02;
        isDiverging = true;
      } else if (positionKm > 201) {
        const t = (positionKm - 201) / 7.0;
        const clampedT = Math.max(0, Math.min(1, t));
        const smoothT = clampedT * clampedT * (3 - 2 * clampedT);
        const targetY = direction === "DOWN" ? this.BASE_Y_DOWN_MAIN : this.BASE_Y_UP_MAIN;
        y = this.BASE_Y_SINGLE_LINE + (targetY - this.BASE_Y_SINGLE_LINE) * smoothT;
        const slope = (targetY - this.BASE_Y_SINGLE_LINE) * 6 * clampedT * (1 - clampedT);
        rotationDeg += (Math.atan2(slope, 150) * 180) / Math.PI;
        curvature = Math.abs(slope) * 0.02;
        isDiverging = true;
      } else {
        y = this.BASE_Y_SINGLE_LINE;
      }
    } else if (isLoopBlock) {
      trackType = "LOOP_LINE";
      isDiverging = true;
      const targetLoopY = direction === "DOWN" ? this.BASE_Y_DOWN_LOOP : this.BASE_Y_UP_LOOP;
      y = targetLoopY;
      curvature = 0.04;
    } else if (direction === "DOWN") {
      trackType = "DOWN_MAIN";
      y = this.BASE_Y_DOWN_MAIN;
    } else {
      trackType = "UP_MAIN";
      y = this.BASE_Y_UP_MAIN;
    }

    return {
      x,
      y,
      rotationDeg,
      curvature,
      trackType,
      isDiverging,
    };
  }

  /**
   * Generates smooth cubic bezier SVG path for track turnouts.
   */
  public static generateTurnoutBezier(
    startKm: number,
    endKm: number,
    fromY: number,
    toY: number,
    viewportStartKm: number,
    viewportEndKm: number,
    canvasWidth: number
  ): string {
    const x1 = this.kmToScreenX(startKm, viewportStartKm, viewportEndKm, canvasWidth);
    const x2 = this.kmToScreenX(endKm, viewportStartKm, viewportEndKm, canvasWidth);
    const dx = x2 - x1;
    const cx1 = x1 + dx * 0.42;
    const cx2 = x1 + dx * 0.58;
    return `M ${x1.toFixed(1)} ${fromY.toFixed(1)} C ${cx1.toFixed(1)} ${fromY.toFixed(1)}, ${cx2.toFixed(1)} ${toY.toFixed(1)}, ${x2.toFixed(1)} ${toY.toFixed(1)}`;
  }
}
