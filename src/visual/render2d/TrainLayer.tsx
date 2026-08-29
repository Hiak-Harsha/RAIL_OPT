/**
 * RAILOPT-X — 2D SVG Rolling Stock Consist & Cluster Layer
 * 
 * DIRECTLY DRIVEN BY ENTITYVISUALSTATE:
 * -------------------------------------
 * Renders consists with speed glows, rear red brake lights, held beacons,
 * and dwelling platform markers strictly from EntityVisualState.getTrainVisualState().
 */

import React from "react";
import type { Train } from "../../types/railway";
import { CorridorGraph, type CorridorTopologyModel } from "../topology/CorridorGraph";
import { LevelOfDetail, type DetailLevel } from "../topology/LevelOfDetail";
import { StylizedRollingStock } from "../../components/NXPanel/StylizedRollingStock";
import { EntityVisualState } from "../state/EntityVisualState";

interface TrainLayerProps {
  trains: Train[];
  topology: CorridorTopologyModel;
  viewportStartKm: number;
  viewportEndKm: number;
  detailLevel: DetailLevel;
  selectedTrainId?: string | null;
  conflictingTrainIds?: string[];
  onSelectTrain?: (train: Train) => void;
}

export const TrainLayer: React.FC<TrainLayerProps> = ({
  trains,
  topology,
  viewportStartKm,
  viewportEndKm,
  detailLevel,
  selectedTrainId,
  conflictingTrainIds = [],
  onSelectTrain,
}) => {
  const projectFn = (t: Train) => {
    return CorridorGraph.projectTrain2D(t, topology, viewportStartKm, viewportEndKm);
  };

  // If macro overview, cluster overlapping trains into count badges
  if (detailLevel === "TICK_ONLY") {
    const clusters = LevelOfDetail.clusterTrains2D(trains, projectFn, 24);

    return (
      <g className="train-layer-clustered">
        {clusters.map((item, idx) => {
          if (item.type === "CLUSTER") {
            return (
              <g
                key={`cluster-${idx}`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectTrain && item.trains.length > 0) onSelectTrain(item.trains[0]);
                }}
              >
                <circle
                  cx={item.x}
                  cy={item.y}
                  r={12}
                  fill="#00D4FF"
                  fillOpacity={0.25}
                  stroke="#00D4FF"
                  strokeWidth={2}
                />
                <text
                  x={item.x}
                  y={item.y + 4}
                  fill="#FFFFFF"
                  fontSize={10}
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {item.trains.length}
                </text>
              </g>
            );
          }

          const train = item.trains[0];
          if (!train) return null;
          const isSelected = selectedTrainId === train.train_id;
          const isConflicting = conflictingTrainIds.includes(train.train_id);
          const visualState = EntityVisualState.getTrainVisualState(train);

          return (
            <g
              key={train.train_id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectTrain) onSelectTrain(train);
              }}
            >
              <circle
                cx={item.x}
                cy={item.y}
                r={isSelected ? 8 : 5}
                fill={isConflicting ? "#FF1744" : visualState.color}
                stroke={isSelected ? "#FFFFFF" : visualState.beaconColor || "none"}
                strokeWidth={isSelected ? 2 : visualState.isHeld ? 2 : 0}
                className={visualState.isHeld ? "animate-pulse" : ""}
              />
            </g>
          );
        })}
      </g>
    );
  }

  // Full / Compact Render Mode
  return (
    <g className="train-layer-full">
      {trains.map((train) => {
        const pt = projectFn(train);
        const isSelected = selectedTrainId === train.train_id;
        const isConflicting = conflictingTrainIds.includes(train.train_id);
        const visualState = EntityVisualState.getTrainVisualState(train);
        const isDown = train.direction === "DOWN";
        const dirMult = isDown ? -1 : 1;

        return (
          <g
            key={train.train_id}
            className="cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectTrain) onSelectTrain(train);
            }}
          >
            {/* Selection Aura */}
            {isSelected && (
              <circle
                cx={pt.x}
                cy={pt.y}
                r={20}
                fill="none"
                stroke="#00D4FF"
                strokeWidth={2}
                strokeDasharray="3,3"
                className="animate-spin"
              />
            )}

            {/* Held / Disrupted Hazard Beacon Aura */}
            {visualState.isHeld && (
              <circle
                cx={pt.x}
                cy={pt.y}
                r={16}
                fill={visualState.beaconColor || "#FF8C1A"}
                fillOpacity={0.2}
                stroke={visualState.beaconColor || "#FF8C1A"}
                strokeWidth={1.5}
                className="animate-ping"
              />
            )}

            {/* Braking Tail Light Indicator */}
            {visualState.isBraking && (
              <circle
                cx={pt.x - 18 * dirMult}
                cy={pt.y}
                r={4}
                fill="#FF1744"
                className="animate-pulse"
              />
            )}

            {/* Station Dwelling Doors Indicator */}
            {visualState.isDwelling && (
              <rect
                x={pt.x - 12}
                y={isDown ? pt.y + 6 : pt.y - 9}
                width={24}
                height={3}
                fill="#38BDF8"
                rx={1.5}
                className="animate-pulse"
              />
            )}

            {/* Stylized Rolling Stock Consist Puck */}
            <StylizedRollingStock
              train={train}
              x={pt.x}
              y={pt.y}
              lodLevel={detailLevel === "FULL" ? 2 : 1}
              isSelected={isSelected}
              isFocused={isConflicting}
              isBraking={visualState.isBraking}
            />
          </g>
        );
      })}
    </g>
  );
};
