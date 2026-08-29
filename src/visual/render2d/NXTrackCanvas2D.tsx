/**
 * RAILOPT-X — Modular 2D SVG Railway Interlocking Canvas (Composition Root)
 * 
 * ARCHITECTURAL DESIGN:
 * ---------------------
 * Combines independent, single-responsibility visual layers with live attention & causal analysis:
 * 1. TrackLayer: Track lines, loop branches, single-line constriction & platforms from CorridorGraph.
 * 2. SignalLayer: 4-aspect signal heads and block status markers.
 * 3. TrainLayer: Consist rakes, speeds, braking glows & clustering.
 * 4. ConflictOverlay: Causal links, hazard envelopes & nexus beacons.
 * 5. LabelLayer: The sole owner of text rendering with collision avoidance & LOD.
 * 6. Attention & Causal Engine: Cursor awareness spotlight & dynamic relationship arcs.
 * 7. Decision Ripple Engine: Concentric wave visualizer on dispatch actions.
 */

import React, { useRef, useState, useMemo, useCallback } from "react";
import type { Train, TrackBlock, Signal, Station, PredictedConflict } from "../../types/railway";
import { CorridorGraph } from "../topology/CorridorGraph";
import { LevelOfDetail } from "../topology/LevelOfDetail";
import { TrackLayer } from "./TrackLayer";
import { SignalLayer } from "./SignalLayer";
import { TrainLayer } from "./TrainLayer";
import { ConflictOverlay } from "./ConflictOverlay";
import { LabelLayer } from "./LabelLayer";
import { RelationshipGraph } from "../../interaction/RelationshipGraph";
import { AttentionEngine, type AttentionResult } from "../../interaction/AttentionEngine";
import { buildRailwayRenderModel, type EntityRef } from "../../interaction/RailwayRenderModel";
import { screenToSvgPoint } from "../../interaction/coordinateTransform";

interface NXTrackCanvas2DProps {
  trains: Train[];
  blocks: TrackBlock[];
  signals?: Signal[];
  stations: Station[];
  predictedConflicts?: PredictedConflict[];
  viewportStartKm: number;
  viewportEndKm: number;
  selectedEntity?: { type: string; id: string } | null;
  focusedConflictId?: string | null;
  causalLensActive?: boolean;
  decisionRippleActive?: boolean;
  onSelectTrain?: (train: Train) => void;
  onSelectBlock?: (blockId: string) => void;
  onSelectSignal?: (blockId: string, aspect: string) => void;
  onSelectConflict?: (conflict: PredictedConflict) => void;
  onBackgroundClick?: () => void;
  className?: string;
}

export const NXTrackCanvas2D: React.FC<NXTrackCanvas2DProps> = ({
  trains,
  blocks,
  signals = [],
  stations,
  predictedConflicts = [],
  viewportStartKm,
  viewportEndKm,
  selectedEntity,
  focusedConflictId,
  causalLensActive = false,
  decisionRippleActive = false,
  onSelectTrain,
  onSelectBlock,
  onSelectSignal,
  onSelectConflict,
  onBackgroundClick,
  className = "w-full h-[375px] select-none font-sans",
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const spanKm = Math.max(1, viewportEndKm - viewportStartKm);

  // 1. Single Source of Truth Topology Graph
  const topology = useMemo(() => {
    return CorridorGraph.buildFromData(blocks, stations, viewportStartKm, viewportEndKm);
  }, [blocks, stations, viewportStartKm, viewportEndKm]);

  const trackLOD = LevelOfDetail.getDetailLevel(spanKm, "block");
  const signalLOD = LevelOfDetail.getDetailLevel(spanKm, "signal");
  const trainLOD = LevelOfDetail.getDetailLevel(spanKm, "train");

  const conflictingTrainIds = useMemo(() => {
    return predictedConflicts.flatMap((c) => c.involved_train_ids || []);
  }, [predictedConflicts]);

  // 2. Build Render Model for Attention & Relationship Graph
  const trainPositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    trains.forEach((t) => {
      map[t.train_id] = CorridorGraph.projectTrain2D(t, topology, viewportStartKm, viewportEndKm);
    });
    return map;
  }, [trains, topology, viewportStartKm, viewportEndKm]);

  const renderEntities = useMemo(() => {
    return buildRailwayRenderModel({
      trains,
      blocks,
      stations,
      predictedConflicts,
      scaleX: (km: number) => {
        const usableWidth = 1320 - 140;
        const clamped = Math.max(viewportStartKm, Math.min(viewportEndKm, km));
        return 70 + ((clamped - viewportStartKm) / spanKm) * usableWidth;
      },
      trainPositions,
      yUpMain: CorridorGraph.Y_UP_MAIN,
      yDownMain: CorridorGraph.Y_DOWN_MAIN,
      ySingleLine: CorridorGraph.Y_SINGLE_LINE,
      getBlockSignalAspect: (b) => (b.signal_aspect as any) || (b.is_occupied ? "RED" : "GREEN"),
    });
  }, [trains, blocks, stations, predictedConflicts, trainPositions, viewportStartKm, viewportEndKm, spanKm]);

  const relationshipGraph = useMemo(() => {
    return new RelationshipGraph({
      trains,
      blocks,
      stations,
      predictedConflicts,
    });
  }, [trains, blocks, stations, predictedConflicts]);

  // 3. Compute Attention Result
  const attentionResult: AttentionResult | null = useMemo(() => {
    if (!cursorPos && !selectedEntity && !causalLensActive) return null;
    const selectedRef: EntityRef | null = selectedEntity
      ? { id: selectedEntity.id, type: selectedEntity.type as any }
      : null;
    return AttentionEngine.evaluate(cursorPos, renderEntities, relationshipGraph, selectedRef);
  }, [cursorPos, selectedEntity, causalLensActive, renderEntities, relationshipGraph]);

  // Mouse Handlers
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const pt = screenToSvgPoint(e.clientX, e.clientY, svgRef.current);
    setCursorPos(pt);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setCursorPos(null);
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <svg
        ref={svgRef}
        viewBox="0 0 1320 380"
        className={className}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          if (e.target === svgRef.current && onBackgroundClick) {
            onBackgroundClick();
          }
        }}
      >
        {/* 1. Technical Millimeter Grid Pattern */}
        <defs>
          <pattern id="grid-dots-2d" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.8" fill="rgba(0, 212, 255, 0.05)" />
          </pattern>
          <radialGradient id="cursor-aura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#00D4FF" stopOpacity="0.0" />
          </radialGradient>
        </defs>
        <rect width="1320" height="380" fill="url(#grid-dots-2d)" />

        {/* 2. Cursor Spatial Awareness Aura */}
        {cursorPos && (
          <circle
            cx={cursorPos.x}
            cy={cursorPos.y}
            r={70}
            fill="url(#cursor-aura)"
            className="pointer-events-none transition-all duration-75"
          />
        )}

        {/* 3. Decision Ripple Visualizer */}
        {decisionRippleActive && selectedEntity && (() => {
          const matched = renderEntities.find((e) => e.id === selectedEntity.id);
          if (!matched) return null;
          return (
            <circle
              cx={matched.x}
              cy={matched.y}
              r={45}
              fill="none"
              stroke="#00E5FF"
              strokeWidth={2}
              className="animate-ping pointer-events-none opacity-75"
            />
          );
        })()}

        {/* 4. Relationship Graph & Attention Highlight Rays */}
        {attentionResult && attentionResult.primary && attentionResult.related.length > 0 && (
          <g className="causal-relationship-arcs pointer-events-none">
            {attentionResult.related.map((rel) => {
              const p1 = attentionResult.primary!;
              const p2 = rel;
              const midX = (p1.x + p2.x) / 2;
              const midY = Math.min(p1.y, p2.y) - 30;

              return (
                <g key={`causal-${p1.id}-${rel.id}`}>
                  <path
                    d={`M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`}
                    fill="none"
                    stroke="#00D4FF"
                    strokeWidth={1.5}
                    strokeDasharray="4,4"
                    strokeOpacity={0.7}
                    className="animate-pulse"
                  />
                  <circle cx={p2.x} cy={p2.y} r={4} fill="#00D4FF" fillOpacity={0.6} />
                </g>
              );
            })}
          </g>
        )}

        {/* 5. Physical Trackage & Infrastructure Layer */}
        <TrackLayer
          topology={topology}
          blocks={blocks}
          trains={trains}
          detailLevel={trackLOD}
          selectedBlockId={selectedEntity?.type === "BLOCK" ? selectedEntity.id : null}
          onSelectBlock={onSelectBlock}
        />

        {/* 6. Signal Aspects Layer */}
        <SignalLayer
          topology={topology}
          signals={signals}
          detailLevel={signalLOD}
          onSelectSignal={onSelectSignal}
        />

        {/* 7. Conflict & Causal Overlay */}
        <ConflictOverlay
          predictedConflicts={predictedConflicts}
          topology={topology}
          trains={trains}
          viewportStartKm={viewportStartKm}
          viewportEndKm={viewportEndKm}
          focusedConflictId={focusedConflictId}
          onSelectConflict={onSelectConflict}
        />

        {/* 8. Train Consists & Puck Layer */}
        <TrainLayer
          trains={trains}
          topology={topology}
          viewportStartKm={viewportStartKm}
          viewportEndKm={viewportEndKm}
          detailLevel={trainLOD}
          selectedTrainId={selectedEntity?.type === "TRAIN" ? selectedEntity.id : null}
          conflictingTrainIds={conflictingTrainIds}
          onSelectTrain={onSelectTrain}
        />

        {/* 9. Unified Label & Collision Avoidance Layer */}
        <LabelLayer
          topology={topology}
          trains={trains}
          predictedConflicts={predictedConflicts}
          viewportStartKm={viewportStartKm}
          viewportEndKm={viewportEndKm}
          selectedEntityId={selectedEntity?.id}
          focusedConflictId={focusedConflictId}
        />
      </svg>

      {/* Semantic Zoom Level Badge */}
      <div className="absolute bottom-2 right-3 pointer-events-none font-mono text-[9px] text-[#81909B] bg-[#071018]/80 backdrop-blur-md px-2 py-0.5 rounded border border-[#162434]">
        2D • {LevelOfDetail.getSemanticTierName(spanKm)} ({spanKm.toFixed(0)} KM)
      </div>
    </div>
  );
};
