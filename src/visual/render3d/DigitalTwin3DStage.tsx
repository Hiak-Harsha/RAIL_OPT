/**
 * RAILOPT-X 2.0 — Production 3D Digital Twin Stage
 * 
 * Composition root that connects the second-generation 3D engine:
 * - SceneManager (WebGL lifecycle, realistic atmospheric fog, dual directional lighting)
 * - TrackBuilder (Ballast beds, concrete sleepers, steel rails, platforms, OHE catenary masts, block occupancy glow)
 * - SignalBillboard (3D signal masts with live LED aspect lenses and stop glows)
 * - TrainRenderer (State-driven brake lights, roof hazard beacons, sliding platform doors, headlights)
 * - CameraDirector (8 camera modes: CAB_POV first-person driver view, FOLLOW_TRAIN, ORBIT, CORRIDOR_FLYTHROUGH, CONFLICT_FOCUS, OVERVIEW)
 * - CorridorGraph & ConflictGeometry (Single source of truth topology projection)
 */

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import type { Train, TrackBlock, Station, Signal, PredictedConflict } from "../../types/railway";
import { SceneManager } from "./SceneManager";
import { TrackBuilder } from "./TrackBuilder";
import { TrainRenderer } from "./TrainRenderer";
import { SignalBillboard } from "./SignalBillboard";
import { CameraDirector, type Camera3DMode } from "./CameraDirector";
import { CorridorGraph } from "../topology/CorridorGraph";
import { Camera, Eye, Video, Compass, AlertCircle, Maximize2, Sparkles } from "lucide-react";

export interface DigitalTwin3DStageProps {
  trains: Train[];
  blocks: TrackBlock[];
  stations: Station[];
  signals?: Signal[];
  predictedConflicts?: PredictedConflict[];
  selectedTrainId?: string | null;
  focusedConflictId?: string | null;
  viewportStartKm?: number;
  viewportEndKm?: number;
  initialCameraMode?: Camera3DMode;
  onSelectTrain?: (train: Train) => void;
  className?: string;
}

export const DigitalTwin3DStage: React.FC<DigitalTwin3DStageProps> = ({
  trains,
  blocks,
  stations,
  signals = [],
  predictedConflicts = [],
  selectedTrainId = null,
  focusedConflictId = null,
  viewportStartKm = 0,
  viewportEndKm = 435,
  initialCameraMode = "CAB_POV",
  onSelectTrain,
  className = "w-full h-[460px] lg:h-[500px]",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraMode, setCameraMode] = useState<Camera3DMode>(initialCameraMode);
  const [activeTrainId, setActiveTrainId] = useState<string | null>(selectedTrainId || (trains[0]?.train_id ?? null));
  const [webglAvailable, setWebglAvailable] = useState<boolean>(true);

  // Sync selected train from parent
  useEffect(() => {
    if (selectedTrainId) setActiveTrainId(selectedTrainId);
    else if (!activeTrainId && trains.length > 0) setActiveTrainId(trains[0].train_id);
  }, [selectedTrainId, trains]);

  // Topology Model derived from CorridorGraph
  const topology = useMemo(() => {
    return CorridorGraph.buildFromData(blocks, stations, viewportStartKm, viewportEndKm);
  }, [stations, blocks, viewportStartKm, viewportEndKm]);

  // References for live 3D lifecycle
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const trainRendererRef = useRef<TrainRenderer>(new TrainRenderer());
  const cameraDirectorRef = useRef<CameraDirector>(new CameraDirector());
  const signalBillboardRef = useRef<SignalBillboard>(new SignalBillboard());
  const trackGroupRef = useRef<THREE.Group | null>(null);
  const signalsGroupRef = useRef<THREE.Group | null>(null);

  // Mount 3D Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!SceneManager.isWebGLAvailable()) {
      setWebglAvailable(false);
      return;
    }

    const initResult = SceneManager.initialize(container);
    if (!initResult) {
      setWebglAvailable(false);
      return;
    }

    const { scene, camera, renderer, dispose } = initResult;
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Attach Camera Controls
    const detachControls = cameraDirectorRef.current.attachControls(container);

    // Build Initial Track & Infrastructure
    const trackMesh = TrackBuilder.buildCorridorMesh(topology, blocks);
    scene.add(trackMesh);
    trackGroupRef.current = trackMesh;

    // Build 3D Signals
    const signalMesh = signalBillboardRef.current.buildSignalMasts(topology, signals);
    scene.add(signalMesh);
    signalsGroupRef.current = signalMesh;

    let animId: number;

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);
      const nowSec = now / 1000;

      // 1. Sync & update train physics postures
      trainRendererRef.current.syncTrains(
        scene,
        trains,
        topology,
        predictedConflicts,
        viewportStartKm,
        viewportEndKm
      );
      trainRendererRef.current.updateAnimation(nowSec);

      // 2. Update track occupancy illumination
      TrackBuilder.updateBlockOccupancies(blocks, trains);

      // 3. Update 3D signal aspects
      signalBillboardRef.current.updateAspects(topology.segments, signals);

      // 4. Update camera director
      cameraDirectorRef.current.updateCamera(
        camera,
        cameraMode,
        nowSec,
        trainRendererRef.current,
        trains,
        activeTrainId,
        predictedConflicts,
        focusedConflictId,
        topology,
        viewportStartKm,
        viewportEndKm
      );

      // 5. Render frame
      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      detachControls();
      dispose();
    };
  }, [topology]);

  // Re-render track if topology/signals changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (trackGroupRef.current) scene.remove(trackGroupRef.current);
    if (signalsGroupRef.current) scene.remove(signalsGroupRef.current);

    const trackMesh = TrackBuilder.buildCorridorMesh(topology, blocks);
    scene.add(trackMesh);
    trackGroupRef.current = trackMesh;

    const signalMesh = signalBillboardRef.current.buildSignalMasts(topology, signals);
    scene.add(signalMesh);
    signalsGroupRef.current = signalMesh;
  }, [topology, blocks, signals]);

  if (!webglAvailable) {
    return (
      <div className={`flex flex-col items-center justify-center bg-[#071018] border border-[#162434] rounded-xl text-[#81909B] font-mono text-xs p-6 ${className}`}>
        <AlertCircle className="w-8 h-8 text-[#FF8C1A] mb-2" />
        <span className="font-bold text-[#EAF2F7]">3D WebGL Acceleration Unavailable</span>
        <span className="text-[11px] mt-1">Falling back to 2D High-Performance Schematic & Modular Layer Canvas.</span>
      </div>
    );
  }

  const activeTrain = trains.find((t) => t.train_id === activeTrainId) || trains[0];

  return (
    <div className={`relative rounded-2xl border border-[#162434] bg-[#04080D] overflow-hidden shadow-2xl ${className}`}>
      {/* Three.js WebGL Mount Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Camera Mode Toolbar (HUD Overlay) */}
      <div className="absolute top-4 left-4 z-30 flex flex-wrap items-center gap-1.5 bg-[#071018]/95 border border-[#162434] rounded-xl p-1.5 shadow-2xl backdrop-blur-md">
        <span className="text-[10px] font-mono font-bold text-[#81909B] px-2 py-0.5 uppercase flex items-center gap-1">
          <Camera className="w-3.5 h-3.5 text-[#00D4FF]" />
          CAMERA:
        </span>

        {/* 1. Driver's Cab POV First-Person View */}
        <button
          onClick={() => setCameraMode("CAB_POV")}
          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            cameraMode === "CAB_POV"
              ? "bg-[#00D4FF] text-[#03070B] shadow-[0_0_14px_rgba(0,212,255,0.4)]"
              : "bg-[#0B1520] text-[#81909B] hover:text-[#EAF2F7] border border-[#162434]"
          }`}
          title="Driver's Cab First-Person Perspective"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>CAB POV (DRIVER)</span>
        </button>

        {/* 2. Chase Follow Train */}
        <button
          onClick={() => setCameraMode("FOLLOW_TRAIN")}
          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            cameraMode === "FOLLOW_TRAIN"
              ? "bg-[#00D4FF] text-[#03070B] shadow-[0_0_14px_rgba(0,212,255,0.4)]"
              : "bg-[#0B1520] text-[#81909B] hover:text-[#EAF2F7] border border-[#162434]"
          }`}
          title="Chase Cam Following Selected Train"
        >
          <Video className="w-3.5 h-3.5" />
          <span>FOLLOW TRAIN</span>
        </button>

        {/* 3. Free Orbit */}
        <button
          onClick={() => setCameraMode("ORBIT")}
          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            cameraMode === "ORBIT"
              ? "bg-[#00D4FF] text-[#03070B] shadow-[0_0_14px_rgba(0,212,255,0.4)]"
              : "bg-[#0B1520] text-[#81909B] hover:text-[#EAF2F7] border border-[#162434]"
          }`}
          title="Free 360-Degree Orbital View (Drag to rotate, Scroll to zoom)"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>360° ORBIT</span>
        </button>

        {/* 4. Corridor Flythrough */}
        <button
          onClick={() => setCameraMode("CORRIDOR_FLYTHROUGH")}
          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            cameraMode === "CORRIDOR_FLYTHROUGH"
              ? "bg-[#00D4FF] text-[#03070B] shadow-[0_0_14px_rgba(0,212,255,0.4)]"
              : "bg-[#0B1520] text-[#81909B] hover:text-[#EAF2F7] border border-[#162434]"
          }`}
          title="Continuous Cinematic Corridor Flythrough"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>FLYTHROUGH</span>
        </button>

        {/* 5. Overhead Overview */}
        <button
          onClick={() => setCameraMode("OPERATIONAL_OVERVIEW")}
          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            cameraMode === "OPERATIONAL_OVERVIEW"
              ? "bg-[#00D4FF] text-[#03070B] shadow-[0_0_14px_rgba(0,212,255,0.4)]"
              : "bg-[#0B1520] text-[#81909B] hover:text-[#EAF2F7] border border-[#162434]"
          }`}
          title="Sectional Aerial Overview"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>OVERVIEW</span>
        </button>
      </div>

      {/* Active Train Selector Pill (HUD Overlay) */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2 bg-[#071018]/95 border border-[#162434] rounded-xl px-3 py-1.5 shadow-2xl backdrop-blur-md font-mono text-xs">
        <span className="text-[#81909B] font-bold">CAB FOCUS:</span>
        <select
          value={activeTrain?.train_id || ""}
          onChange={(e) => {
            setActiveTrainId(e.target.value);
            const found = trains.find((t) => t.train_id === e.target.value);
            if (found && onSelectTrain) onSelectTrain(found);
          }}
          className="bg-[#0B1520] text-[#00D4FF] font-bold px-2 py-0.5 rounded border border-[#162434] focus:outline-none cursor-pointer"
        >
          {trains.map((t) => (
            <option key={t.train_id} value={t.train_id} className="bg-[#071018] text-[#EAF2F7]">
              {t.train_number} — {t.train_name} ({t.current_speed_kmh.toFixed(0)} km/h)
            </option>
          ))}
        </select>
      </div>

      {/* Driver Cockpit Speedometer & Status (HUD Overlay for CAB_POV) */}
      {cameraMode === "CAB_POV" && activeTrain && (
        <div className="absolute bottom-4 left-4 z-30 bg-[#071018]/95 border border-[#00D4FF]/40 rounded-xl p-3 shadow-2xl backdrop-blur-md font-mono text-xs flex items-center gap-4 animate-in fade-in">
          <div>
            <span className="text-[10px] text-[#81909B] block font-bold uppercase">CAB LOCOMOTIVE</span>
            <strong className="text-[#00D4FF] text-sm">{activeTrain.train_number} {activeTrain.train_name}</strong>
          </div>
          <div className="border-l border-[#162434] pl-4">
            <span className="text-[10px] text-[#81909B] block font-bold uppercase">PHYSICS SPEED</span>
            <strong className="text-white text-base font-bold">{activeTrain.current_speed_kmh.toFixed(1)} <span className="text-xs text-[#81909B]">km/h</span></strong>
          </div>
          <div className="border-l border-[#162434] pl-4">
            <span className="text-[10px] text-[#81909B] block font-bold uppercase">SECTION BLOCK</span>
            <span className="text-[#00E676] font-bold">{activeTrain.current_block_id || "MAIN_LINE"}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DigitalTwin3DStage;
