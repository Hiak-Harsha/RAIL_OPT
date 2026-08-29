/**
 * RAILOPT-X — 2D SVG Track & Infrastructure Layer
 * 
 * DIRECTLY DRIVEN BY ENTITYVISUALSTATE:
 * -------------------------------------
 * Renders UP/DOWN mainlines, station loop branches, single-line bottlenecks,
 * station platforms, and elevation gradients directly from CorridorGraph,
 * with block occupancy glow driven by EntityVisualState.getBlockVisualState().
 */

import React from "react";
import type { TrackBlock, Train } from "../../types/railway";
import type { CorridorTopologyModel } from "../topology/CorridorGraph";
import type { DetailLevel } from "../topology/LevelOfDetail";
import { EntityVisualState } from "../state/EntityVisualState";

interface TrackLayerProps {
  topology: CorridorTopologyModel;
  blocks?: TrackBlock[];
  trains?: Train[];
  detailLevel: DetailLevel;
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string) => void;
}

export const TrackLayer: React.FC<TrackLayerProps> = ({
  topology,
  blocks = [],
  trains = [],
  detailLevel,
  selectedBlockId,
  onSelectBlock,
}) => {
  const blockMap = new Map<string, TrackBlock>();
  blocks.forEach((b) => blockMap.set(b.id, b));

  return (
    <g className="track-layer">
      {/* 1. Track Segments (Mainlines, Loops, Single-Line) */}
      {topology.segments.map((seg) => {
        const isSelected = selectedBlockId === seg.blockId;
        const block = blockMap.get(seg.blockId);
        const visualState = block
          ? EntityVisualState.getBlockVisualState(block, trains)
          : {
              occupied: seg.isOccupied,
              isBlocked: seg.isBlocked,
              emissiveColor: seg.isBlocked ? "#D62828" : seg.isOccupied ? "#FF8C1A" : seg.type === "SINGLE_LINE" ? "#E5A93C" : seg.type === "LOOP_LINE" ? "#00D4FF" : "#2A4054",
            };

        const strokeColor = visualState.emissiveColor;
        const strokeW = isSelected ? 5 : seg.type === "SINGLE_LINE" ? 4 : detailLevel === "FULL" ? 3 : 2;

        return (
          <g
            key={seg.id}
            className="cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectBlock) onSelectBlock(seg.blockId);
            }}
          >
            {/* Hit Target Area */}
            <line
              x1={seg.x1_2d}
              y1={seg.y1_2d}
              x2={seg.x2_2d}
              y2={seg.y2_2d}
              stroke="transparent"
              strokeWidth={16}
            />

            {/* Occupied Track Glow Strip */}
            {visualState.occupied && (
              <line
                x1={seg.x1_2d}
                y1={seg.y1_2d}
                x2={seg.x2_2d}
                y2={seg.y2_2d}
                stroke="#FF8C1A"
                strokeWidth={8}
                strokeOpacity={0.35}
                strokeLinecap="round"
              />
            )}

            {/* Track Bed Base Line */}
            <line
              x1={seg.x1_2d}
              y1={seg.y1_2d}
              x2={seg.x2_2d}
              y2={seg.y2_2d}
              stroke={strokeColor}
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeDasharray={seg.type === "LOOP_LINE" ? "6,4" : "none"}
              className="transition-all duration-300"
            />

            {/* Selection Aura */}
            {isSelected && (
              <line
                x1={seg.x1_2d}
                y1={seg.y1_2d}
                x2={seg.x2_2d}
                y2={seg.y2_2d}
                stroke="#00D4FF"
                strokeWidth={9}
                strokeOpacity={0.4}
                strokeLinecap="round"
              />
            )}

            {/* Station Platform Rectangles */}
            {seg.hasPlatform && detailLevel !== "HIDDEN" && (
              <rect
                x={Math.min(seg.x1_2d, seg.x2_2d)}
                y={seg.direction === "UP" ? seg.y1_2d - 14 : seg.y1_2d + 6}
                width={Math.abs(seg.x2_2d - seg.x1_2d)}
                height={8}
                fill="#334155"
                stroke="#64748B"
                strokeWidth={1}
                rx={2}
                opacity={0.8}
              />
            )}
          </g>
        );
      })}

      {/* 2. Turnout Junction Connection Lines */}
      {topology.junctions.map((junc) => (
        <g key={junc.id}>
          <line
            x1={junc.x_2d - 8}
            y1={junc.y_2d}
            x2={junc.x_2d + 8}
            y2={junc.y_2d + (junc.divergenceAngleDeg > 0 ? -12 : 12)}
            stroke="#00D4FF"
            strokeWidth={2}
            strokeDasharray="2,2"
            opacity={0.7}
          />
          <circle cx={junc.x_2d} cy={junc.y_2d} r={3} fill="#00D4FF" />
        </g>
      ))}

      {/* 3. Station Reference Milestones & Names */}
      {topology.stations.map((stn) => {
        const seg = topology.segments.find((s) => s.stationCode === stn.code);
        const stnX = seg
          ? (seg.x1_2d + seg.x2_2d) / 2
          : 70 + ((stn.position_km - topology.minKm) / Math.max(1, topology.maxKm - topology.minKm)) * (1320 - 140);

        return (
          <g key={stn.id} className="pointer-events-none">
            <line
              x1={stnX}
              y1={30}
              x2={stnX}
              y2={330}
              stroke="#162434"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <text
              x={stnX}
              y={24}
              fill="#CAD6E2"
              fontSize={11}
              fontWeight="bold"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {stn.name.toUpperCase()} (KM {stn.position_km.toFixed(0)})
            </text>
          </g>
        );
      })}
    </g>
  );
};
