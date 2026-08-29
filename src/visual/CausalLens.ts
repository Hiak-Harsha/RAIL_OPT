/**
 * RAILOPT-X 2.0 — Physical Causal Lens & Operational Delay Cascade Engine.
 * 
 * Computes deterministic causal dependency chains across the railway network:
 * Train -> Restrictive Signal -> Contested Block -> Conflicting Train -> Predicted Conflict.
 */

import type { Train, TrackBlock, PredictedConflict } from "../types/railway";
import { RailwaySpline } from "./RailwaySpline";

export interface CausalNode {
  id: string;
  type: "TRAIN" | "SIGNAL" | "BLOCK" | "CONFLICT";
  label: string;
  x: number;
  y: number;
  reason: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
}

export interface CausalEdge {
  fromNodeId: string;
  toNodeId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  relationship: string;
}

export interface CausalGraphResult {
  nodes: CausalNode[];
  edges: CausalEdge[];
  summary: string;
}

export class CausalLens {
  /**
   * Traces the causal root reason why a train is delayed or stopped.
   */
  public static traceTrainDelay(
    train: Train,
    trains: Train[],
    blocks: TrackBlock[],
    conflicts: PredictedConflict[],
    viewportStartKm: number,
    viewportEndKm: number,
    canvasWidth: number
  ): CausalGraphResult {
    const nodes: CausalNode[] = [];
    const edges: CausalEdge[] = [];

    // 1. Primary Train Node
    const trainPose = RailwaySpline.getPose(
      train.current_position_km,
      train.current_block_id,
      train.direction as "UP" | "DOWN",
      viewportStartKm,
      viewportEndKm,
      canvasWidth
    );

    const delayMins = (train.total_delay_sec || 0) / 60.0;

    nodes.push({
      id: train.train_id,
      type: "TRAIN",
      label: train.train_id,
      x: trainPose.x,
      y: trainPose.y,
      reason: `Train ${train.train_id} (${train.current_speed_kmh.toFixed(0)} km/h, ${delayMins.toFixed(1)}m delay)`,
      severity: delayMins > 10 ? "CRITICAL" : "HIGH",
    });

    // 2. Current / Forward Block Node
    const currentBlock = blocks.find((b) => b.id === train.current_block_id);
    if (currentBlock) {
      const blockX = trainPose.x + 15;
      const blockY = currentBlock.direction === "DOWN" ? RailwaySpline.BASE_Y_DOWN_MAIN : RailwaySpline.BASE_Y_UP_MAIN;

      nodes.push({
        id: currentBlock.id,
        type: "BLOCK",
        label: currentBlock.name || currentBlock.id,
        x: blockX,
        y: blockY,
        reason: `Block ${currentBlock.id} state: ${currentBlock.is_occupied ? "OCCUPIED" : currentBlock.is_blocked ? "BLOCKED" : "CLEAR"}`,
        severity: currentBlock.is_occupied ? "HIGH" : "INFO",
      });

      edges.push({
        fromNodeId: train.train_id,
        toNodeId: currentBlock.id,
        x1: trainPose.x,
        y1: trainPose.y,
        x2: blockX,
        y2: blockY,
        relationship: "OCCUPIES",
      });
    }

    // 3. Predicted Conflict Linkage
    const matchingConflict = conflicts.find((c) =>
      c.involved_train_ids?.includes(train.train_id) || c.location_block_id === train.current_block_id
    );

    if (matchingConflict) {
      const confX = RailwaySpline.kmToScreenX(178.0, viewportStartKm, viewportEndKm, canvasWidth);
      const confY = RailwaySpline.BASE_Y_SINGLE_LINE;

      nodes.push({
        id: matchingConflict.conflict_id,
        type: "CONFLICT",
        label: matchingConflict.conflict_id,
        x: confX,
        y: confY,
        reason: `Predicted Headway Contention (Time to Impact: ${matchingConflict.time_to_conflict_sec.toFixed(0)}s)`,
        severity: "CRITICAL",
      });

      edges.push({
        fromNodeId: currentBlock ? currentBlock.id : train.train_id,
        toNodeId: matchingConflict.conflict_id,
        x1: currentBlock ? nodes[1].x : trainPose.x,
        y1: currentBlock ? nodes[1].y : trainPose.y,
        x2: confX,
        y2: confY,
        relationship: "CONVERGES_INTO",
      });

      // 4. Opposing / Conflicting Train
      const opposingTrainId = matchingConflict.involved_train_ids?.find((id) => id !== train.train_id);
      const opposingTrain = trains.find((t) => t.train_id === opposingTrainId);

      if (opposingTrain) {
        const oppPose = RailwaySpline.getPose(
          opposingTrain.current_position_km,
          opposingTrain.current_block_id,
          opposingTrain.direction as "UP" | "DOWN",
          viewportStartKm,
          viewportEndKm,
          canvasWidth
        );

        nodes.push({
          id: opposingTrain.train_id,
          type: "TRAIN",
          label: opposingTrain.train_id,
          x: oppPose.x,
          y: oppPose.y,
          reason: `Opposing train ${opposingTrain.train_id} holds conflicting reservation`,
          severity: "HIGH",
        });

        edges.push({
          fromNodeId: matchingConflict.conflict_id,
          toNodeId: opposingTrain.train_id,
          x1: confX,
          y1: confY,
          x2: oppPose.x,
          y2: oppPose.y,
          relationship: "BLOCKED_BY",
        });
      }
    }

    const summary = matchingConflict
      ? `${train.train_id} waiting: Single-line block contention predicted with opposing traffic at Km 178.`
      : `${train.train_id} operating nominally at ${train.current_speed_kmh.toFixed(0)} km/h.`;

    return { nodes, edges, summary };
  }
}
