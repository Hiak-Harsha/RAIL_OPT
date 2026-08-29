/**
 * RAILOPT-X — Authoritative Conflict Spatial Geometry Engine
 * 
 * DESIGN RATIONALE:
 * -----------------
 * Single source of truth for extracting geometric conflict footprints across both
 * 2D SVG canvas and 3D WebGL viewport. Guarantees that conflict highlight beacons,
 * involved trains, affected track segments, and camera focus centroids are 100%
 * synchronized between all visual renderers.
 */

import type { PredictedConflict, Train } from "../../types/railway";
import { CorridorGraph, type CorridorTopologyModel } from "./CorridorGraph";

export interface ConflictSpatialFootprint {
  conflictId: string;
  involvedTrainIds: string[];
  involvedBlockIds: string[];
  locationBlockName: string;
  timeToConflictSec: number;
  severity: string;
  rootCause: string;
  
  // 2D Spatial Centroid & Bounds
  centroid2D: { x: number; y: number };
  trainPositions2D: Array<{ trainId: string; x: number; y: number }>;
  
  // 3D Spatial Centroid & Bounds
  centroid3D: { x: number; y: number; z: number };
  trainPositions3D: Array<{ trainId: string; x: number; y: number; z: number }>;
}

export class ConflictGeometry {
  /**
   * Resolves the spatial geometry for a predicted conflict against the active corridor topology.
   */
  public static extractFootprint(
    conflict: PredictedConflict,
    topology: CorridorTopologyModel,
    trains: Train[],
    viewportStartKm: number,
    viewportEndKm: number,
    canvasWidth: number = 1320,
    paddingX: number = 70
  ): ConflictSpatialFootprint {
    const involvedTrainIds = conflict.involved_train_ids || [];
    const involvedTrains = trains.filter(t => involvedTrainIds.includes(t.train_id));

    // Compute 2D Train Positions
    const trainPositions2D = involvedTrains.map(t => {
      const p = CorridorGraph.projectTrain2D(t, topology, viewportStartKm, viewportEndKm, canvasWidth, paddingX);
      return { trainId: t.train_id, x: p.x, y: p.y };
    });

    // Compute 3D Train Positions
    const trainPositions3D = involvedTrains.map(t => {
      const p = CorridorGraph.projectTrain3D(t, topology, viewportStartKm, viewportEndKm);
      return { trainId: t.train_id, x: p.x, y: p.y, z: p.z };
    });

    // Resolve 2D Centroid
    let centroid2D = { x: canvasWidth / 2, y: CorridorGraph.Y_SINGLE_LINE };
    if (trainPositions2D.length > 0) {
      centroid2D = {
        x: trainPositions2D.reduce((acc, p) => acc + p.x, 0) / trainPositions2D.length,
        y: trainPositions2D.reduce((acc, p) => acc + p.y, 0) / trainPositions2D.length
      };
    } else {
      // Fall back to target block location
      const blockSeg = topology.segments.find(s => s.blockId === conflict.location_block_id);
      if (blockSeg) {
        centroid2D = {
          x: (blockSeg.x1_2d + blockSeg.x2_2d) / 2,
          y: blockSeg.y1_2d
        };
      }
    }

    // Resolve 3D Centroid
    let centroid3D = { x: 0, y: 1.5, z: 0 };
    if (trainPositions3D.length > 0) {
      centroid3D = {
        x: trainPositions3D.reduce((acc, p) => acc + p.x, 0) / trainPositions3D.length,
        y: 1.5,
        z: trainPositions3D.reduce((acc, p) => acc + p.z, 0) / trainPositions3D.length
      };
    } else {
      const blockSeg = topology.segments.find(s => s.blockId === conflict.location_block_id);
      if (blockSeg) {
        centroid3D = {
          x: (blockSeg.x1_3d + blockSeg.x2_3d) / 2,
          y: 1.5,
          z: blockSeg.z1_3d
        };
      }
    }

    return {
      conflictId: conflict.conflict_id,
      involvedTrainIds,
      involvedBlockIds: conflict.location_block_id ? [conflict.location_block_id] : [],
      locationBlockName: conflict.location_block_name || conflict.location_block_id || "Mainline Section",
      timeToConflictSec: conflict.time_to_conflict_sec,
      severity: conflict.severity,
      rootCause: conflict.explanation?.root_cause || conflict.conflict_nature || "Headway contention along single-line bottleneck",
      centroid2D,
      trainPositions2D,
      centroid3D,
      trainPositions3D
    };
  }
}
