/**
 * RAILOPT-X 2.0 — FocusDirector & Multi-Scale Camera Engine.
 * 
 * Manages dynamic scale transitions between:
 *  1. Corridor Overview (435 km)
 *  2. Active Operational Window (60-100 km)
 *  3. Focus Bubble (15-35 km around incidents)
 */

import type { Train, PredictedConflict, TrackBlock } from "../types/railway";
import type { WorldFocus, VisualizationScale } from "../state/WorldState";

export class FocusDirector {
  public static readonly TOTAL_CORRIDOR_KM = 435.0;
  public static readonly MIN_FOCUS_RADIUS_KM = 15.0;
  public static readonly MAX_FOCUS_RADIUS_KM = 35.0;
  public static readonly ACTIVE_WINDOW_SPAN_KM = 80.0;

  /**
   * Calculates a mathematically bounded FocusBubble around a conflict incident.
   */
  public static calculateConflictFocus(
    conflict: PredictedConflict,
    trains: Train[],
    _blocks: TrackBlock[]
  ): WorldFocus {
    const involvedTrains = trains.filter((t) =>
      conflict.involved_train_ids?.includes(t.train_id)
    );

    let centerKm = 150.0;
    if (involvedTrains.length > 0) {
      const sumKm = involvedTrains.reduce((acc, t) => acc + t.current_position_km, 0);
      centerKm = sumKm / involvedTrains.length;
    }

    let maxDist = 0;
    for (const t of involvedTrains) {
      const dist = Math.abs(t.current_position_km - centerKm);
      if (dist > maxDist) maxDist = dist;
    }

    const radiusKm = Math.max(
      this.MIN_FOCUS_RADIUS_KM,
      Math.min(this.MAX_FOCUS_RADIUS_KM, maxDist + 10.0)
    );

    const startKm = Math.max(0, centerKm - radiusKm);
    const endKm = Math.min(this.TOTAL_CORRIDOR_KM, centerKm + radiusKm);

    return {
      mode: "CONFLICT",
      entityIds: [
        conflict.conflict_id,
        ...(conflict.involved_train_ids || []),
        conflict.location_block_id,
      ],
      centerKm,
      startKm,
      endKm,
      radiusKm,
      reason: `Conflict ${conflict.conflict_id} Headway Contention`,
    };
  }

  /**
   * Calculates dynamic follow window around a moving train.
   */
  public static calculateTrainFocus(train: Train): WorldFocus {
    const centerKm = train.current_position_km;
    const radiusKm = 25.0;
    const startKm = Math.max(0, centerKm - radiusKm);
    const endKm = Math.min(this.TOTAL_CORRIDOR_KM, centerKm + radiusKm);

    return {
      mode: "TRAIN",
      entityIds: [train.train_id, train.current_block_id || ""].filter(Boolean),
      centerKm,
      startKm,
      endKm,
      radiusKm,
      reason: `Tracking ${train.train_id} (${train.current_speed_kmh.toFixed(0)} km/h)`,
    };
  }

  /**
   * Determines active scale tier based on viewport span.
   */
  public static getScaleTier(startKm: number, endKm: number): VisualizationScale {
    const span = endKm - startKm;
    if (span > 200) return "CORRIDOR_OVERVIEW";
    if (span > 50) return "ACTIVE_OPERATIONAL_WINDOW";
    return "FOCUS_BUBBLE";
  }
}
