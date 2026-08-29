/**
 * RAILOPT-X — Pure Level of Detail (LOD) & Decluttering Policy Engine
 * 
 * DESIGN RATIONALE:
 * -----------------
 * Standardizes visual density reduction across any viewport scale (from 20km micro
 * inspection to 435km macro corridor overview). Ensures text labels and icons are
 * always legible and never overlap into an unreadable visual clump.
 */

import type { Train } from "../../types/railway";

export type SemanticTier = 0 | 1 | 2 | 3;
export type SemanticTierName = 
  | "LEVEL_0_CORRIDOR" 
  | "LEVEL_1_SECTION" 
  | "LEVEL_2_STATION" 
  | "LEVEL_3_INTERLOCKING";

export type DetailLevel = "FULL" | "COMPACT" | "TICK_ONLY" | "HIDDEN";

export type EntityCategory = 
  | "label" 
  | "signal" 
  | "train" 
  | "block" 
  | "platform" 
  | "switch_blade" 
  | "braking_curve"
  | "route_lock";

export interface TrainClusterItem {
  type: "SINGLE" | "CLUSTER";
  trains: Train[];
  x: number;
  y: number;
  label: string;
}

export class LevelOfDetail {
  /**
   * Resolves current viewport span into one of the 4 authoritative semantic tiers.
   */
  public static getSemanticTier(viewportSpanKm: number): SemanticTier {
    if (viewportSpanKm <= 15) return 3; // LEVEL_3_INTERLOCKING
    if (viewportSpanKm <= 60) return 2; // LEVEL_2_STATION
    if (viewportSpanKm <= 160) return 1; // LEVEL_1_SECTION
    return 0; // LEVEL_0_CORRIDOR
  }

  public static getSemanticTierName(viewportSpanKm: number): SemanticTierName {
    const tier = this.getSemanticTier(viewportSpanKm);
    switch (tier) {
      case 3: return "LEVEL_3_INTERLOCKING";
      case 2: return "LEVEL_2_STATION";
      case 1: return "LEVEL_1_SECTION";
      case 0:
      default: return "LEVEL_0_CORRIDOR";
    }
  }

  /**
   * Authoritative visibility gate for entities based on semantic tier.
   */
  public static shouldRender(viewportSpanKm: number, category: EntityCategory): boolean {
    const tier = this.getSemanticTier(viewportSpanKm);

    switch (category) {
      case "platform":
        return tier >= 2; // Only shown at Station & Interlocking level
      case "signal":
        return tier >= 1; // Section level and deeper
      case "switch_blade":
      case "route_lock":
      case "braking_curve":
        return tier >= 3; // Micro interlocking level only
      case "label":
      case "train":
      case "block":
      default:
        return true;
    }
  }

  /**
   * Evaluates the appropriate detail level based on current viewport kilometer span.
   */
  public static getDetailLevel(viewportSpanKm: number, entityType: EntityCategory): DetailLevel {
    const tier = this.getSemanticTier(viewportSpanKm);

    if (tier === 3) {
      return "FULL";
    }
    if (tier === 2) {
      if (entityType === "braking_curve") return "COMPACT";
      return "FULL";
    }
    if (tier === 1) {
      if (entityType === "label") return "COMPACT";
      if (entityType === "signal") return "COMPACT";
      if (entityType === "platform") return "HIDDEN";
      if (entityType === "switch_blade") return "HIDDEN";
      return "COMPACT";
    }
    // Level 0 Corridor
    if (entityType === "label") return "TICK_ONLY";
    if (entityType === "signal") return "HIDDEN";
    if (entityType === "platform") return "HIDDEN";
    if (entityType === "switch_blade") return "HIDDEN";
    if (entityType === "route_lock") return "HIDDEN";
    if (entityType === "braking_curve") return "HIDDEN";
    return "TICK_ONLY";
  }

  /**
   * Clusters trains that are within pixel proximity threshold to prevent overlapping icons.
   */
  public static clusterTrains2D(
    trains: Train[],
    projectFn: (t: Train) => { x: number; y: number },
    proximityPx: number = 26
  ): TrainClusterItem[] {
    const clusters: TrainClusterItem[] = [];
    const visited = new Set<string>();

    for (let i = 0; i < trains.length; i++) {
      const t1 = trains[i];
      if (visited.has(t1.train_id)) continue;

      const pos1 = projectFn(t1);
      const group: Train[] = [t1];
      visited.add(t1.train_id);

      for (let j = i + 1; j < trains.length; j++) {
        const t2 = trains[j];
        if (visited.has(t2.train_id)) continue;

        const pos2 = projectFn(t2);
        const dist = Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y);

        if (dist <= proximityPx) {
          group.push(t2);
          visited.add(t2.train_id);
        }
      }

      if (group.length > 1) {
        // Compute average centroid
        const avgX = group.reduce((acc, t) => acc + projectFn(t).x, 0) / group.length;
        const avgY = group.reduce((acc, t) => acc + projectFn(t).y, 0) / group.length;
        clusters.push({
          type: "CLUSTER",
          trains: group,
          x: avgX,
          y: avgY,
          label: `${group.length} TRAINS`
        });
      } else {
        clusters.push({
          type: "SINGLE",
          trains: group,
          x: pos1.x,
          y: pos1.y,
          label: t1.train_id
        });
      }
    }

    return clusters;
  }
}
