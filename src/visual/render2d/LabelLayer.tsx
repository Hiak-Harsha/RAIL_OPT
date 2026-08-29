/**
 * RAILOPT-X — 2D SVG Unified Label & Text Collision Avoidance Layer
 * 
 * SOLE OWNER OF ALL 2D TEXT RENDERING:
 * -------------------------------------
 * Evaluates LevelOfDetail policies and applies 1D/2D bounding-box collision
 * avoidance to eliminate visual clutter and overlapping text.
 * Displays live train speeds, delays, and causal WaitReason captions directly
 * from EntityVisualState.
 */

import React from "react";
import type { Train, PredictedConflict } from "../../types/railway";
import { CorridorGraph, type CorridorTopologyModel } from "../topology/CorridorGraph";
import { LevelOfDetail, type DetailLevel } from "../topology/LevelOfDetail";
import { EntityVisualState } from "../state/EntityVisualState";

interface LabelLayerProps {
  topology: CorridorTopologyModel;
  trains: Train[];
  predictedConflicts: PredictedConflict[];
  viewportStartKm: number;
  viewportEndKm: number;
  selectedEntityId?: string | null;
  focusedConflictId?: string | null;
}

interface CandidateLabel {
  id: string;
  text: string;
  subText?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  priority: number; // Higher is more important
  color: string;
  bgColor?: string;
  isStation?: boolean;
}

export const LabelLayer: React.FC<LabelLayerProps> = ({
  topology,
  trains,
  predictedConflicts,
  viewportStartKm,
  viewportEndKm,
  selectedEntityId,
  focusedConflictId,
}) => {
  const spanKm = Math.max(1, viewportEndKm - viewportStartKm);
  const labelLOD: DetailLevel = LevelOfDetail.getDetailLevel(spanKm, "label");

  const candidates: CandidateLabel[] = [];

  // 1. Station Name Labels
  topology.stations.forEach((stn) => {
    const seg = topology.segments.find((s) => s.stationCode === stn.code);
    const x = seg ? (seg.x1_2d + seg.x2_2d) / 2 : 0;
    const isMajor = ["NDLS", "ALJN", "TDL", "CNB"].includes(stn.code);

    if (labelLOD === "TICK_ONLY" && !isMajor) return;

    candidates.push({
      id: `lbl-stn-${stn.code}`,
      text: labelLOD === "FULL" ? `${stn.name} (${stn.code})` : stn.code,
      subText: `KM ${stn.position_km.toFixed(0)}`,
      x,
      y: 55,
      width: labelLOD === "FULL" ? 110 : 45,
      height: 24,
      priority: isMajor ? 75 : 60,
      color: "#38BDF8",
      bgColor: "#071018",
      isStation: true,
    });
  });

  // 2. Train Name & Causal Status Labels
  const conflictingTrainIds = new Set(
    predictedConflicts.flatMap((c) => c.involved_train_ids || [])
  );

  trains.forEach((train) => {
    const p = CorridorGraph.projectTrain2D(train, topology, viewportStartKm, viewportEndKm);
    const isSelected = selectedEntityId === train.train_id;
    const isConflicting = conflictingTrainIds.has(train.train_id);
    const visualState = EntityVisualState.getTrainVisualState(train);

    let priority = 30;
    if (isSelected) priority = 100;
    else if (isConflicting) priority = 85;
    else if (visualState.isHeld) priority = 65;

    const delayMin = Math.round(train.total_delay_sec / 60);
    const delayText = delayMin > 0 ? `+${delayMin}m` : "ON-TIME";
    const subLabel = visualState.heldReasonLabel || `${Math.round(train.current_speed_kmh)} km/h • ${delayText}`;

    if (labelLOD === "FULL" || isSelected || visualState.isHeld) {
      candidates.push({
        id: `lbl-train-${train.train_id}`,
        text: `${train.train_number} • ${train.train_name}`,
        subText: subLabel,
        x: p.x,
        y: train.direction === "DOWN" ? p.y + 26 : p.y - 24,
        width: visualState.heldReasonLabel ? 160 : 140,
        height: 22,
        priority,
        color: isConflicting ? "#FF5252" : visualState.color,
        bgColor: "#0A131D",
      });
    } else if (labelLOD === "COMPACT" || isConflicting) {
      candidates.push({
        id: `lbl-train-${train.train_id}`,
        text: train.train_number,
        subText: delayText,
        x: p.x,
        y: train.direction === "DOWN" ? p.y + 20 : p.y - 18,
        width: 60,
        height: 18,
        priority,
        color: isConflicting ? "#FF5252" : visualState.color,
        bgColor: "#0A131D",
      });
    }
  });

  // 3. Conflict Callout Labels
  predictedConflicts.forEach((conf) => {
    const isFocused = focusedConflictId === conf.conflict_id;
    const involved = trains.filter((t) => (conf.involved_train_ids || []).includes(t.train_id));
    const avgX = involved.length > 0
      ? involved.reduce((acc, t) => acc + CorridorGraph.projectTrain2D(t, topology, viewportStartKm, viewportEndKm).x, 0) / involved.length
      : 660;

    candidates.push({
      id: `lbl-conf-${conf.conflict_id}`,
      text: `CONFLICT • ${conf.conflict_id}`,
      subText: conf.explanation?.root_cause || conf.location_block_name || "Bottleneck Contention",
      x: avgX,
      y: 185 - 32,
      width: 160,
      height: 24,
      priority: isFocused ? 95 : 80,
      color: "#FF1744",
      bgColor: "#050B11",
    });
  });

  // 4. Collision Avoidance Algorithm
  candidates.sort((a, b) => b.priority - a.priority);

  const placedLabels: CandidateLabel[] = [];
  const occupiedBoxes: Array<{ x1: number; x2: number; y1: number; y2: number }> = [];

  candidates.forEach((cand) => {
    const halfW = cand.width / 2;
    const halfH = cand.height / 2;

    const testBox = {
      x1: cand.x - halfW - 4,
      x2: cand.x + halfW + 4,
      y1: cand.y - halfH - 2,
      y2: cand.y + halfH + 2,
    };

    // Check overlap with already placed high-priority labels
    const hasOverlap = occupiedBoxes.some((box) => {
      return !(
        testBox.x2 < box.x1 ||
        testBox.x1 > box.x2 ||
        testBox.y2 < box.y1 ||
        testBox.y1 > box.y2
      );
    });

    if (!hasOverlap || cand.priority >= 90) {
      placedLabels.push(cand);
      occupiedBoxes.push(testBox);
    }
  });

  return (
    <g className="label-layer pointer-events-none font-mono">
      {placedLabels.map((lbl) => {
        const halfW = lbl.width / 2;
        const halfH = lbl.height / 2;

        return (
          <g key={lbl.id} className="transition-all duration-200">
            {/* Background pill */}
            <rect
              x={lbl.x - halfW}
              y={lbl.y - halfH}
              width={lbl.width}
              height={lbl.height}
              fill={lbl.bgColor || "#071018"}
              stroke={lbl.color}
              strokeWidth={1}
              strokeOpacity={0.6}
              rx={4}
              opacity={0.92}
            />

            {/* Primary Text */}
            <text
              x={lbl.x}
              y={lbl.subText ? lbl.y - 1 : lbl.y + 4}
              fill={lbl.color}
              fontSize={10}
              fontWeight="bold"
              textAnchor="middle"
            >
              {lbl.text}
            </text>

            {/* Secondary Sub-text */}
            {lbl.subText && (
              <text
                x={lbl.x}
                y={lbl.y + 8}
                fill="#81909B"
                fontSize={8}
                textAnchor="middle"
              >
                {lbl.subText}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
};
