/**
 * RAILOPT-X 2.0 — 3D Rolling Stock & Digital Twin Stage
 * 
 * Re-exports the production DigitalTwin3DStage powered by the complete render3d pipeline:
 * - SceneManager (WebGL lifecycle & lighting)
 * - TrackBuilder (Ballast, sleepers, rails, catenary masts, and block occupancy illumination)
 * - SignalBillboard (3D multi-aspect signal masts)
 * - TrainRenderer (Physical rolling stock, brake lights, beacons, doors)
 * - CameraDirector (Driver's CAB_POV first-person view, FOLLOW_TRAIN, ORBIT)
 */

import React from "react";
import type { Train, TrackBlock, Station, Signal, PredictedConflict } from "../types/railway";
import { DigitalTwin3DStage } from "./render3d/DigitalTwin3DStage";
import type { Camera3DMode } from "./render3d/CameraDirector";

export interface RollingStock3DCanvasProps {
  trains: Train[];
  blocks: TrackBlock[];
  stations: Station[];
  signals?: Signal[];
  predictedConflicts?: PredictedConflict[];
  selectedTrainId?: string | null;
  focusedConflictId?: string | null;
  viewportStartKm: number;
  viewportEndKm: number;
  initialCameraMode?: Camera3DMode;
  onSelectTrain?: (train: Train) => void;
  className?: string;
}

export const RollingStock3DCanvas: React.FC<RollingStock3DCanvasProps> = (props) => {
  return <DigitalTwin3DStage {...props} />;
};

export default RollingStock3DCanvas;
