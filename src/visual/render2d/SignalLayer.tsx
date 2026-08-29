/**
 * RAILOPT-X — 2D SVG Signal Aspects Layer
 * 
 * DIRECTLY DRIVEN BY ENTITYVISUALSTATE:
 * -------------------------------------
 * Renders 4-aspect signal heads and glowing lenses at exact segment entries
 * with colors strictly dictated by EntityVisualState.getSignalVisualState().
 */

import React from "react";
import type { Signal } from "../../types/railway";
import type { CorridorTopologyModel } from "../topology/CorridorGraph";
import type { DetailLevel } from "../topology/LevelOfDetail";
import { EntityVisualState } from "../state/EntityVisualState";

interface SignalLayerProps {
  topology: CorridorTopologyModel;
  signals?: Signal[];
  detailLevel: DetailLevel;
  onSelectSignal?: (blockId: string, aspect: string) => void;
}

export const SignalLayer: React.FC<SignalLayerProps> = ({
  topology,
  signals = [],
  detailLevel,
  onSelectSignal,
}) => {
  if (detailLevel === "HIDDEN") return null;

  const signalByBlock = new Map<string, Signal>();
  signals.forEach((s) => {
    signalByBlock.set(s.block_id, s);
    signalByBlock.set(s.id, s);
  });

  return (
    <g className="signal-layer">
      {topology.segments.map((seg) => {
        const liveSig = signalByBlock.get(seg.blockId);
        const visualState = EntityVisualState.getSignalVisualState(liveSig, seg.signalAspect);

        const isDown = seg.direction === "DOWN";
        const sigX = isDown ? seg.x2_2d : seg.x1_2d;
        const sigY = seg.y1_2d + (isDown ? 12 : -12);

        return (
          <g
            key={`sig-head-${seg.blockId}`}
            className="cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectSignal) onSelectSignal(seg.blockId, visualState.aspect);
            }}
          >
            {/* Mast Post */}
            <line
              x1={sigX}
              y1={seg.y1_2d}
              x2={sigX}
              y2={sigY}
              stroke="#64748B"
              strokeWidth={1.5}
            />

            {/* Target Shield */}
            <circle
              cx={sigX}
              cy={sigY}
              r={4.5}
              fill="#050B11"
              stroke="#334155"
              strokeWidth={1}
            />

            {/* Glowing Aspect Lamp */}
            <circle
              cx={sigX}
              cy={sigY}
              r={3}
              fill={visualState.aspectColor}
              className={visualState.isStopAspect ? "animate-pulse" : ""}
            />

            {/* Stop Aspect Glow Aura */}
            {visualState.isStopAspect && (
              <circle
                cx={sigX}
                cy={sigY}
                r={6}
                fill="#FF1744"
                fillOpacity={0.25}
              />
            )}
          </g>
        );
      })}
    </g>
  );
};
