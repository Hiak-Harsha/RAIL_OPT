/**
 * RAILOPT-X — 2D SVG Conflict & Causal Nexus Overlay
 */

import React from "react";
import type { PredictedConflict, Train } from "../../types/railway";
import type { CorridorTopologyModel } from "../topology/CorridorGraph";
import { ConflictGeometry } from "../topology/ConflictGeometry";

interface ConflictOverlayProps {
  predictedConflicts: PredictedConflict[];
  topology: CorridorTopologyModel;
  trains: Train[];
  viewportStartKm: number;
  viewportEndKm: number;
  focusedConflictId?: string | null;
  onSelectConflict?: (conflict: PredictedConflict) => void;
}

export const ConflictOverlay: React.FC<ConflictOverlayProps> = ({
  predictedConflicts,
  topology,
  trains,
  viewportStartKm,
  viewportEndKm,
  focusedConflictId,
  onSelectConflict,
}) => {
  if (predictedConflicts.length === 0) return null;

  return (
    <g className="conflict-overlay">
      {predictedConflicts.map((conf) => {
        const footprint = ConflictGeometry.extractFootprint(
          conf,
          topology,
          trains,
          viewportStartKm,
          viewportEndKm
        );
        const isFocused = focusedConflictId === conf.conflict_id;

        return (
          <g
            key={`conf-${conf.conflict_id}`}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectConflict) onSelectConflict(conf);
            }}
          >
            {/* Causal Link Lines to Involved Trains */}
            {footprint.trainPositions2D.map((tPos) => (
              <line
                key={`causal-${tPos.trainId}`}
                x1={tPos.x}
                y1={tPos.y}
                x2={footprint.centroid2D.x}
                y2={footprint.centroid2D.y}
                stroke="#FF1744"
                strokeWidth={2}
                strokeDasharray="4,4"
                strokeOpacity={0.7}
                className="animate-pulse"
              />
            ))}

            {/* Glowing Nexus Beacon */}
            <circle
              cx={footprint.centroid2D.x}
              cy={footprint.centroid2D.y}
              r={isFocused ? 28 : 20}
              fill="#FF1744"
              fillOpacity={0.25}
              stroke="#FF1744"
              strokeWidth={isFocused ? 3 : 2}
              className="animate-pulse"
            />
            <circle
              cx={footprint.centroid2D.x}
              cy={footprint.centroid2D.y}
              r={6}
              fill="#FF1744"
            />
            <text
              x={footprint.centroid2D.x}
              y={footprint.centroid2D.y + 3.5}
              textAnchor="middle"
              fontSize="9"
              fontWeight="bold"
              fill="#FFFFFF"
            >
              ⚠
            </text>
          </g>
        );
      })}
    </g>
  );
};
