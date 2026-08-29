import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { Train, TrackBlock, PredictedConflict, Station, CounterfactualOption, Signal } from "../../types/railway";
import { StylizedRollingStock } from "./StylizedRollingStock";
import { SignalHead } from "./SignalHead";
import type { SignalAspect } from "./SignalHead";
import { CorridorMinimap } from "./CorridorMinimap";
import { LiveCorridorRadar } from "./LiveCorridorRadar";
import { FutureRailwayTheater } from "./FutureRailwayTheater";
import { RailwaySpline } from "../../visual/RailwaySpline";
import { TrainInspector } from "./TrainInspector";
import { BlockLifecycle } from "./BlockLifecycle";
import { MOTION_PHYSICS } from "../../visual/motion";
import { THEME_TOKENS } from "../../visual/tokens";
import { screenToSvgPoint } from "../../interaction/coordinateTransform";
import { buildRailwayRenderModel } from "../../interaction/RailwayRenderModel";
import { RelationshipGraph } from "../../interaction/RelationshipGraph";
import { AttentionEngine, type AttentionResult } from "../../interaction/AttentionEngine";
import { FocusManager } from "../../interaction/FocusManager";
import { RollingStock3DCanvas } from "../../visual/RollingStock3DCanvas";
import { NXTrackCanvas2D } from "../../visual/render2d/NXTrackCanvas2D";
import { Sparkles, Navigation, AlertTriangle, Route, ShieldCheck, X, Zap, Clock, Bot, FlaskConical, ArrowRight, ZoomIn, ZoomOut, Box, Layers } from "lucide-react";

export type SelectedRailwayEntity =
  | { type: "TRAIN"; id: string; data: Train }
  | { type: "BLOCK"; id: string; data: TrackBlock }
  | { type: "SIGNAL"; id: string; data: { signalId: string; aspect: SignalAspect; blockId: string; direction: "UP" | "DOWN" } }
  | { type: "CONFLICT"; id: string; data: PredictedConflict }
  | { type: "STATION"; id: string; data: Station };

interface NXTrackCanvasProps {
  trains: Train[];
  blocks: TrackBlock[];
  stations?: Station[];
  signals?: Signal[];
  predictedConflicts: PredictedConflict[];
  activeRecommendation?: any;
  decisionRippleActive?: boolean;
  selectedEntity?: SelectedRailwayEntity | null;
  viewMode?: "OVERVIEW" | "FOLLOW_TRAIN" | "CONFLICT_FOCUS" | "INFRASTRUCTURE";
  focusedTrainId?: string;
  onSelectEntity?: (entity: SelectedRailwayEntity | null) => void;
  onTriggerDisruption?: (type: string, targetId: string) => void;
  onSelectTrain?: (train: Train) => void;
  onSelectConflict?: (conflict: PredictedConflict) => void;
  onExplainEntity?: (entity: SelectedRailwayEntity) => void;
  onSimulateInWhatIf?: (entity: SelectedRailwayEntity) => void;
  onOpenDecisionReview?: () => void;
}

const DEFAULT_STATIONS: Station[] = [
  { id: "STN_NDLS", code: "NDLS", name: "New Delhi", position_km: 0.0, platforms: [], loop_blocks: [] },
  { id: "STN_GZB", code: "GZB", name: "Ghaziabad", position_km: 28.0, platforms: [], loop_blocks: [] },
  { id: "STN_ALJN", code: "ALJN", name: "Aligarh Jn", position_km: 131.0, platforms: [], loop_blocks: [] },
  { id: "STN_TDL", code: "TDL", name: "Tundla Jn", position_km: 209.0, platforms: [], loop_blocks: [] },
  { id: "STN_ETW", code: "ETW", name: "Etawah", position_km: 301.0, platforms: [], loop_blocks: [] },
  { id: "STN_CNB", code: "CNB", name: "Kanpur Central", position_km: 435.0, platforms: [], loop_blocks: [] },
];

const Y_UP_MAIN = 140;       // UP Line (NDLS -> CNB)
const Y_UP_LOOP = 90;        // UP Station Loops
const Y_DOWN_MAIN = 230;     // DOWN Line (CNB -> NDLS)
const Y_DOWN_LOOP = 280;     // DOWN Station Loops
const Y_SINGLE_LINE = 185;   // Single-line section between ALJN and TDL
// Backend sends this absolute chainage; the physics integrator's position is local to each block.
const displayKm = (train: Train) => train.corridor_position_km ?? train.current_position_km;

export const NXTrackCanvas: React.FC<NXTrackCanvasProps> = ({
  trains,
  blocks,
  stations = DEFAULT_STATIONS,
  signals = [],
  predictedConflicts,
  activeRecommendation,
  decisionRippleActive = false,
  selectedEntity: externalSelectedEntity,
  viewMode = "OVERVIEW",
  focusedTrainId,
  onSelectEntity,
  onTriggerDisruption,
  onSelectTrain,
  onSelectConflict,
  onExplainEntity,
  onSimulateInWhatIf,
  onOpenDecisionReview
}) => {
  const [internalSelectedEntity, setInternalSelectedEntity] = useState<SelectedRailwayEntity | null>(null);
  const [hoveredTrainId, setHoveredTrainId] = useState<string | null>(null);
  const [causalLensActive, setCausalLensActive] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [renderPositions, setRenderPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [attentionResult, setAttentionResult] = useState<AttentionResult | null>(null);
  const [viewportStartKm, setViewportStartKm] = useState(80.0);
  const [viewportEndKm, setViewportEndKm] = useState(240.0);
  const [is3DViewActive, setIs3DViewActive] = useState(false);
  const [canvasViewMode, setCanvasViewMode] = useState<"SCHEMATIC" | "2D_MODULAR">("SCHEMATIC");
  const targetPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const svgRef = useRef<SVGSVGElement>(null);

  const handleZoomIn = useCallback(() => {
    const mid = (viewportStartKm + viewportEndKm) / 2;
    const currentSpan = viewportEndKm - viewportStartKm;
    const newSpan = Math.max(30, currentSpan * 0.65);
    setViewportStartKm(Math.max(0, mid - newSpan / 2));
    setViewportEndKm(Math.min(435, mid + newSpan / 2));
  }, [viewportStartKm, viewportEndKm]);

  const handleZoomOut = useCallback(() => {
    const mid = (viewportStartKm + viewportEndKm) / 2;
    const currentSpan = viewportEndKm - viewportStartKm;
    const newSpan = Math.min(435, currentSpan * 1.5);
    setViewportStartKm(Math.max(0, mid - newSpan / 2));
    setViewportEndKm(Math.min(435, mid + newSpan / 2));
  }, [viewportStartKm, viewportEndKm]);

  const handleFitCorridor = useCallback(() => {
    setViewportStartKm(0.0);
    setViewportEndKm(435.0);
  }, []);

  const handleFocusBottleneck = useCallback(() => {
    setViewportStartKm(80.0);
    setViewportEndKm(240.0);
  }, []);

  const selectedEntity = externalSelectedEntity !== undefined ? externalSelectedEntity : internalSelectedEntity;

  const handleEntitySelect = useCallback((entity: SelectedRailwayEntity | null) => {
    if (onSelectEntity) {
      onSelectEntity(entity);
    } else {
      setInternalSelectedEntity(entity);
    }
  }, [onSelectEntity]);

  const activeStations = stations.length > 0 ? stations : DEFAULT_STATIONS;
  const minKm = activeStations[0]?.position_km || 0.0;
  const maxKm = activeStations[activeStations.length - 1]?.position_km || 435.0;

  // Synchronize with external FocusManager events (AI Review, Audit, Analytics)
  useEffect(() => {
    const unsubFocus = FocusManager.subscribe((target) => {
      if (target) {
        if (target.type === "TRAIN") {
          const t = trains.find((tr) => tr.train_id === target.id);
          if (t) handleEntitySelect({ type: "TRAIN", id: t.train_id, data: t });
        } else if (target.type === "CONFLICT") {
          const c = predictedConflicts.find((cf) => cf.conflict_id === target.id);
          if (c) handleEntitySelect({ type: "CONFLICT", id: c.conflict_id, data: c });
        } else if (target.type === "BLOCK") {
          const b = blocks.find((bl) => bl.id === target.id);
          if (b) handleEntitySelect({ type: "BLOCK", id: b.id, data: b });
        }
      } else {
        handleEntitySelect(null);
      }
    });

    const unsubCmd = FocusManager.subscribeCommands((cmd) => {
      if (cmd.type === "LOCATE") {
        if (cmd.entity?.type === "TRAIN") {
          const t = trains.find((tr) => tr.train_id === cmd.entity!.id);
          const posKm = cmd.targetKm !== undefined ? cmd.targetKm : (t ? displayKm(t) : 0);
          setViewportStartKm(Math.max(0, posKm - 45));
          setViewportEndKm(Math.min(435, posKm + 45));
          if (t) handleEntitySelect({ type: "TRAIN", id: t.train_id, data: t });
        } else if (cmd.entity?.type === "BLOCK") {
          const b = blocks.find((bl) => bl.id === cmd.entity!.id);
          if (b) {
            const fStn = activeStations.find((s) => s.id === b.from_node);
            const posKm = fStn ? fStn.position_km : 0;
            setViewportStartKm(Math.max(0, posKm - 45));
            setViewportEndKm(Math.min(435, posKm + 45));
            handleEntitySelect({ type: "BLOCK", id: b.id, data: b });
          }
        }
      } else if (cmd.type === "FOLLOW") {
        if (cmd.entity?.type === "TRAIN") {
          const t = trains.find((tr) => tr.train_id === cmd.entity!.id);
          if (t) {
            setViewportStartKm(Math.max(0, displayKm(t) - 40));
            setViewportEndKm(Math.min(435, displayKm(t) + 50));
            handleEntitySelect({ type: "TRAIN", id: t.train_id, data: t });
          }
        }
      } else if (cmd.type === "FRAME_CONFLICT") {
        const confBlock = blocks.find((b) => b.id === cmd.conflictBlockId);
        let confKm = cmd.targetKm || 150;
        if (confBlock) {
          const fStn = activeStations.find((s) => s.id === confBlock.from_node);
          const tStn = activeStations.find((s) => s.id === confBlock.to_node);
          if (fStn && tStn) confKm = (fStn.position_km + tStn.position_km) / 2;
        }
        setViewportStartKm(Math.max(0, confKm - 40));
        setViewportEndKm(Math.min(435, confKm + 40));
      }
    });

    return () => {
      unsubFocus();
      unsubCmd();
    };
  }, [trains, predictedConflicts, blocks, activeStations, handleEntitySelect]);

  // Keyboard Escape listener to clear selection focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleEntitySelect(null);
        FocusManager.clearFocus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleEntitySelect]);

  // Derive single-line bottleneck bounds dynamically from backend block topology
  const singleLineBlock = blocks.find((b) => b.block_type === "SINGLE_LINE_SECTION" || b.id.includes("SINGLE"));
  let singleLineStartKm = 150.0;
  let singleLineEndKm = 190.0;
  let singleLineNodeA = "ALJN";
  let singleLineNodeB = "TDL";

  if (singleLineBlock) {
    const fromStn = activeStations.find((s) => s.id === singleLineBlock.from_node);
    const toStn = activeStations.find((s) => s.id === singleLineBlock.to_node);
    if (fromStn && toStn) {
      const fKm = Math.min(fromStn.position_km, toStn.position_km);
      const tKm = Math.max(fromStn.position_km, toStn.position_km);
      singleLineStartKm = fKm + (tKm - fKm) * 0.2;
      singleLineEndKm = fKm + (tKm - fKm) * 0.8;
      singleLineNodeA = fromStn.code;
      singleLineNodeB = toStn.code;
    }
  }

  // Scale station distance along corridor to SVG canvas X coordinate
  const scaleX = useCallback((km: number) => {
    const clamped = Math.max(minKm, Math.min(maxKm, km));
    return 90 + ((clamped - minKm) / Math.max(1, maxKm - minKm)) * (1230 - 90);
  }, [minKm, maxKm]);

  // Compute live signal aspect for each block
  const getBlockSignalAspect = useCallback((block: TrackBlock): SignalAspect => {
    if (block.signal_aspect) return block.signal_aspect;
    if (block.is_occupied) return "RED";
    if (block.is_blocked) return "RED";
    const nextBlock = blocks.find((b) => b.from_node === block.to_node && b.direction === block.direction);
    if (nextBlock && nextBlock.is_occupied) return "YELLOW";
    return "GREEN";
  }, [blocks]);

  // Convert train position along corridor to canvas coordinates using mathematically correct block progress
  const getTrainCanvasPosition = useCallback((train: Train) => {
    const currBlockId = train.current_block_id;
    const currentKm = Math.max(minKm, Math.min(maxKm, displayKm(train)));
    const posX = scaleX(currentKm);

    let posY = train.direction === "UP" ? Y_UP_MAIN : Y_DOWN_MAIN;
    if (currBlockId?.includes("SINGLE")) {
      posY = Y_SINGLE_LINE;
    } else if (currBlockId?.includes("LOOP")) {
      posY = train.direction === "UP" ? Y_UP_LOOP : Y_DOWN_LOOP;
    }

    return { x: posX, y: posY, currentKm };
  }, [minKm, maxKm, scaleX]);

  // Unified Spatial Render Model and Relationship Graph instances
  const renderEntities = useMemo(() => {
    return buildRailwayRenderModel({
      trains,
      blocks,
      stations: activeStations,
      predictedConflicts,
      scaleX,
      trainPositions: renderPositions,
      yUpMain: Y_UP_MAIN,
      yDownMain: Y_DOWN_MAIN,
      ySingleLine: Y_SINGLE_LINE,
      getBlockSignalAspect,
    });
  }, [trains, blocks, activeStations, predictedConflicts, scaleX, renderPositions, getBlockSignalAspect]);

  const relationshipGraph = useMemo(() => {
    return new RelationshipGraph({
      trains,
      blocks,
      stations: activeStations,
      predictedConflicts,
    });
  }, [trains, blocks, activeStations, predictedConflicts]);

  // Keep target positions synchronized with incoming telemetry
  useEffect(() => {
    const newTargets: Record<string, { x: number; y: number }> = {};
    trains.forEach((t) => {
      newTargets[t.train_id] = getTrainCanvasPosition(t);
    });
    targetPositionsRef.current = newTargets;
  }, [trains, getTrainCanvasPosition]);

  // requestAnimationFrame Continuous Physics Lerp Loop (Smooth Motion Engine)
  useEffect(() => {
    let animId: number;
    let lastFrameAt = performance.now();
    const step = (now: number) => {
      // Frame-rate independent exponential smoothing. A 120Hz display no
      // longer moves trains differently from a 60Hz display, and packet
      // updates settle without a visual teleport.
      const dt = Math.min(0.1, Math.max(0.001, (now - lastFrameAt) / 1000));
      lastFrameAt = now;
      const alpha = 1 - Math.exp(-8 * dt);
      setRenderPositions((prev) => {
        let changed = false;
        const next: Record<string, { x: number; y: number }> = { ...prev };
        const targets = targetPositionsRef.current;
        
        for (const tId in targets) {
          const target = targets[tId];
          const current = prev[tId] || target;
          const dx = target.x - current.x;
          const dy = target.y - current.y;
          
          if (Math.abs(dx) > MOTION_PHYSICS.lerpThreshold || Math.abs(dy) > MOTION_PHYSICS.lerpThreshold) {
            next[tId] = {
              x: current.x + dx * alpha,
              y: current.y + dy * alpha
            };
            changed = true;
          } else {
            next[tId] = target;
          }
        }
        return changed ? next : prev;
      });
      animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Continuous Spatial Attention Engine Evaluation
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const pt = screenToSvgPoint(e.clientX, e.clientY, svgRef.current, { width: 1320, height: 380 });
    setCursorPos(pt);

    const selectedRef = selectedEntity ? { id: selectedEntity.id, type: selectedEntity.type } : null;
    const attention = AttentionEngine.evaluate(pt, renderEntities, relationshipGraph, selectedRef);
    setAttentionResult(attention);

    if (attention.primary && attention.primary.type === "TRAIN") {
      setHoveredTrainId(attention.primary.id);
    } else {
      setHoveredTrainId(null);
    }
  };

  const handleMouseLeave = () => {
    setCursorPos(null);
    setHoveredTrainId(null);
    setAttentionResult(null);
  };

  // Active focus train
  const focusedTrain = selectedEntity?.type === "TRAIN"
    ? (selectedEntity.data as Train)
    : trains.find((t) => t.train_id === hoveredTrainId);

  // Active conflict
  const activeConflict = focusedTrain
    ? predictedConflicts.find((c) => c.involved_train_ids.includes(focusedTrain.train_id))
    : null;

  const conflictingTrainId = activeConflict
    ? activeConflict.involved_train_ids.find((id) => id !== focusedTrain?.train_id)
    : null;

  const conflictingTrain = conflictingTrainId
    ? trains.find((t) => t.train_id === conflictingTrainId)
    : null;

  const bottleneckCenterKm = (singleLineStartKm + singleLineEndKm) / 2;
  const bottleneckCenterX = scaleX(bottleneckCenterKm);

  // Dynamic conflict coordinate calculator
  const getConflictPosition = useCallback((conf: PredictedConflict) => {
    const targetBlock = blocks.find((b) => b.id === conf.location_block_id);
    if (targetBlock) {
      const fStn = activeStations.find((s) => s.id === targetBlock.from_node);
      const tStn = activeStations.find((s) => s.id === targetBlock.to_node);
      if (fStn && tStn) {
        const avgKm = (fStn.position_km + tStn.position_km) / 2;
        const x = scaleX(avgKm);
        const isSingle = targetBlock.id.includes("SINGLE") || targetBlock.block_type === "SINGLE_LINE_SECTION";
        const y = isSingle ? Y_SINGLE_LINE : (targetBlock.direction === "UP" ? Y_UP_MAIN : Y_DOWN_MAIN);
        return { x, y };
      }
    }
    return { x: bottleneckCenterX, y: Y_SINGLE_LINE };
  }, [blocks, activeStations, scaleX, bottleneckCenterX]);

  // Dynamic camera viewport framing based on viewMode & FocusManager viewport window
  let computedViewBox = "0 0 1320 380";
  if (viewMode === "FOLLOW_TRAIN" || focusedTrainId) {
    const tr = trains.find(t => t.train_id === focusedTrainId) || focusedTrain;
    if (tr) {
      const trainX = scaleX(displayKm(tr));
      const minX = Math.max(0, Math.min(1320 - 750, trainX - 300));
      computedViewBox = `${minX} 0 750 380`;
    }
  } else if (viewMode === "CONFLICT_FOCUS") {
    if (predictedConflicts.length > 0) {
      const confPos = getConflictPosition(predictedConflicts[0]);
      const minX = Math.max(0, Math.min(1320 - 750, confPos.x - 375));
      computedViewBox = `${minX} 0 750 380`;
    }
  } else if (viewportStartKm > 5 || viewportEndKm < 430) {
    const startX = scaleX(viewportStartKm);
    const endX = scaleX(viewportEndKm);
    const width = Math.max(400, endX - startX + 160);
    const minX = Math.max(0, Math.min(1320 - width, startX - 80));
    computedViewBox = `${minX} 0 ${width} 380`;
  }

  return (
    <div className="bg-[#071018] border border-[#162434] rounded-xl overflow-hidden shadow-2xl relative transition-all duration-300">
      {/* 435km Full Corridor Minimap (Finding #2) */}
      <CorridorMinimap
        trains={trains}
        blocks={blocks}
        stations={activeStations}
        predictedConflicts={predictedConflicts}
        viewportStartKm={viewportStartKm}
        viewportEndKm={viewportEndKm}
        onSelectViewportKm={(startKm) => {
          setViewportStartKm(startKm);
          setViewportEndKm(Math.min(435.0, startKm + 180.0));
        }}
        onSelectTrain={(train) => {
          handleEntitySelect({ type: "TRAIN", id: train.train_id, data: train });
          if (onSelectTrain) onSelectTrain(train);
        }}
      />

      {/* Master Interlocking Panel Header */}
      <div className="bg-[#0B1522] border-b border-[#1A2C3F] px-5 py-2.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF8C1A] glow-cyan-route" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#EAF2F7] flex items-center gap-2">
            <span>LIVE RAILWAY WORLD: NDLS ── CNB</span>
            <span className="text-[10px] text-[#3E9142] bg-[#3E9142]/10 px-2 py-0.5 rounded border border-[#3E9142]/30 font-mono font-semibold">
              180s HEADWAY ENFORCED
            </span>
          </h2>
        </div>

        {/* Legend Indicators (Finding #3, #4) */}
        <div className="flex items-center gap-3.5 text-[10px] font-mono text-[#81909B] flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#3E9142]" /> CLEAR
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#D97706]" /> RESERVED
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#DC2626]" /> OCCUPIED
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#FF1744] animate-ping" /> CONFLICT
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3.5 h-1 bg-[#FF8C1A] rounded" /> ACTIVE ROUTE
          </span>
        </div>
      </div>

      {/* Floating Train Inspector Overlay (Finding #7, #28, #53) */}
      {selectedEntity?.type === "TRAIN" && (
        <TrainInspector
          train={selectedEntity.data}
          currentBlock={blocks.find((b) => b.id === selectedEntity.data.current_block_id)}
          onClose={() => handleEntitySelect(null)}
          onAction={(action, trainId) => {
            if (onTriggerDisruption) onTriggerDisruption(action, trainId);
          }}
          onOpenDecisionReview={onOpenDecisionReview}
        />
      )}

      {/* Floating Block Lifecycle Overlay (Finding #29) */}
      {selectedEntity?.type === "BLOCK" && (
        <BlockLifecycle
          block={selectedEntity.data}
          onClose={() => handleEntitySelect(null)}
        />
      )}

      {/* Scale 1: 435 KM Live Corridor Radar & Navigational Command Strip */}
      <LiveCorridorRadar
        stations={activeStations}
        trains={trains}
        blocks={blocks}
        predictedConflicts={predictedConflicts}
        viewportStartKm={viewportStartKm}
        viewportEndKm={viewportEndKm}
        onPanToKm={(centerKm) => {
          setViewportStartKm(Math.max(0, centerKm - 45));
          setViewportEndKm(Math.min(435, centerKm + 45));
        }}
        onSelectTrain={(train) => {
          handleEntitySelect({ type: "TRAIN", id: train.train_id, data: train });
          if (onSelectTrain) onSelectTrain(train);
        }}
      />

      {/* SVG Railway Schematic (Scale 2: Active Operational Window / Scale 3: Focus Bubble) */}
      <div className="p-4 overflow-x-auto relative">
        {/* Interactive Canvas Controls Toolbar */}
        <div className="absolute top-6 left-6 z-30 flex items-center gap-1.5 bg-[#071018]/90 border border-[#162434] rounded-lg p-1 shadow-xl backdrop-blur-md">
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-[#101D2C] text-[#CAD6E2] hover:text-[#00D4FF] transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-[#101D2C] text-[#CAD6E2] hover:text-[#00D4FF] transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-4 bg-[#162434]" />
          <button
            onClick={handleFocusBottleneck}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
              viewportStartKm >= 70 && viewportEndKm <= 250
                ? "bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40"
                : "text-[#81909B] hover:text-[#EAF2F7]"
            }`}
            title="Focus Bottleneck (ALJN–TDL KM 131–209)"
          >
            BOTTLENECK FOCUS
          </button>
          <button
            onClick={handleFitCorridor}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
              viewportStartKm === 0 && viewportEndKm === 435
                ? "bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40"
                : "text-[#81909B] hover:text-[#EAF2F7]"
            }`}
            title="Fit Full 435 KM Corridor"
          >
            FIT ALL (435KM)
          </button>
          <div className="w-[1px] h-4 bg-[#162434]" />
          <button
            onClick={() => setCanvasViewMode("SCHEMATIC")}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
              canvasViewMode === "SCHEMATIC"
                ? "bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40"
                : "bg-[#0A131D] text-[#81909B] hover:text-[#EAF2F7] border border-[#162434]"
            }`}
            title="Schematic Interlocking View"
          >
            <span>SCHEMATIC</span>
          </button>
          <button
            onClick={() => setCanvasViewMode("2D_MODULAR")}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all ${
              canvasViewMode === "2D_MODULAR"
                ? "bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40 shadow-[0_0_12px_rgba(0,212,255,0.2)]"
                : "bg-[#0A131D] text-[#81909B] hover:text-[#EAF2F7] border border-[#162434]"
            }`}
            title="2D Modular SVG Interlocking Simulation Model"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2D MODEL</span>
          </button>
          <div className="w-[1px] h-4 bg-[#162434]" />
          <button
            onClick={() => setIs3DViewActive(prev => !prev)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all ${
              is3DViewActive
                ? "bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40 shadow-[0_0_12px_rgba(0,230,118,0.2)]"
                : "bg-[#0A131D] text-[#81909B] hover:text-[#EAF2F7] border border-[#162434]"
            }`}
            title="Toggle 3D Hardware Cab / Micro View"
          >
            <Box className="w-3.5 h-3.5" />
            <span>{is3DViewActive ? "3D CAB: ON" : "3D CAB: OFF"}</span>
          </button>
        </div>

        {/* On-Canvas Scale Legend */}
        <div className="absolute top-6 right-6 z-30 bg-[#071018]/85 border border-[#162434] rounded px-2.5 py-1 text-[10px] font-mono text-[#81909B] pointer-events-none backdrop-blur-md shadow-lg">
          SCALE: 1 px ≈ {Math.max(1, Math.round((viewportEndKm - viewportStartKm) * 1000 / 1140))} m • SPAN: {Math.round(viewportEndKm - viewportStartKm)} km
        </div>

        {/* Floating 3D Hardware WebGL Viewport */}
        {is3DViewActive && (
          <div className="absolute bottom-6 right-6 z-40 w-80 h-52 bg-[#071018]/95 border border-[#00D4FF]/40 rounded-xl overflow-hidden shadow-2xl backdrop-blur-lg flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#0B1520] border-b border-[#162434] text-[10px] font-mono font-bold">
              <div className="flex items-center gap-1.5 text-[#00D4FF]">
                <Box className="w-3.5 h-3.5" />
                <span>3D HARDWARE CAB VIEW</span>
              </div>
              <button
                onClick={() => setIs3DViewActive(false)}
                className="text-[#81909B] hover:text-[#FF1744] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 w-full h-full relative">
              <RollingStock3DCanvas
                trains={trains}
                blocks={blocks}
                stations={activeStations}
                signals={signals}
                predictedConflicts={predictedConflicts}
                selectedTrainId={selectedEntity?.type === "TRAIN" ? selectedEntity.data.train_id : focusedTrainId}
                focusedConflictId={activeConflict?.conflict_id || null}
                viewportStartKm={viewportStartKm}
                viewportEndKm={viewportEndKm}
                onSelectTrain={(t) => {
                  handleEntitySelect({ type: "TRAIN", id: t.train_id, data: t });
                  if (onSelectTrain) onSelectTrain(t);
                }}
              />
            </div>
          </div>
        )}

        {canvasViewMode === "2D_MODULAR" ? (
          <NXTrackCanvas2D
            trains={trains}
            blocks={blocks}
            stations={activeStations}
            predictedConflicts={predictedConflicts}
            viewportStartKm={viewportStartKm}
            viewportEndKm={viewportEndKm}
            selectedEntity={selectedEntity ? { type: selectedEntity.type, id: selectedEntity.id } : null}
            focusedConflictId={activeConflict?.conflict_id || null}
            causalLensActive={causalLensActive}
            decisionRippleActive={decisionRippleActive}
            onSelectTrain={(t) => {
              handleEntitySelect({ type: "TRAIN", id: t.train_id, data: t });
              if (onSelectTrain) onSelectTrain(t);
            }}
            onSelectBlock={(blockId) => {
              const blk = blocks.find(b => b.id === blockId);
              if (blk) handleEntitySelect({ type: "BLOCK", id: blk.id, data: blk });
            }}
            onSelectConflict={(conf) => {
              handleEntitySelect({ type: "CONFLICT", id: conf.conflict_id, data: conf });
              if (onSelectConflict) onSelectConflict(conf);
            }}
            onBackgroundClick={() => handleEntitySelect(null)}
            className="w-full min-w-[1050px] h-[375px]"
          />
        ) : (
          <svg
            ref={svgRef}
            viewBox={computedViewBox}
            className="w-full min-w-[1050px] h-[375px] select-none font-sans transition-all duration-500 ease-out"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleEntitySelect(null)}
          >
          {/* Technical Millimeter Grid Pattern */}
          <defs>
            <pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.8" fill="rgba(0, 212, 255, 0.05)" />
            </pattern>
          </defs>
          <rect width="1320" height="380" fill="url(#grid-dots)" />

          {/* Spatial Attention Field Cursor Aura */}
          {cursorPos && (
            <circle
              cx={cursorPos.x}
              cy={cursorPos.y}
              r={70}
              fill="#00D4FF"
              fillOpacity={0.03}
              stroke="#00D4FF"
              strokeWidth={0.5}
              strokeDasharray="3,3"
              className="pointer-events-none"
            />
          )}

          {/* Kilometer-Post Distance Markers along Corridor */}
          {[0, 50, 100, 150, 200, 250, 300, 350, 400, 435].map((km) => (
            <g key={`km-post-${km}`} transform={`translate(${scaleX(km)}, 72)`}>
              <line x1={0} y1={-6} x2={0} y2={6} stroke="#1A2C3F" strokeWidth={1} />
              <circle cx={0} cy={0} r={1.5} fill="#00D4FF" fillOpacity={0.7} />
              <text x={0} y={-9} textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#5A6D7C">
                KM {km}
              </text>
            </g>
          ))}

          {/* Station Vertical Markers & Platforms */}
          {activeStations.map((stn) => {
            const stnX = scaleX(stn.position_km);
            const isStnSelected = selectedEntity?.type === "STATION" && selectedEntity.id === stn.id;

            return (
              <g
                key={stn.id}
                transform={`translate(${stnX}, 0)`}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEntitySelect({ type: "STATION", id: stn.id, data: stn });
                }}
              >
                {/* Vertical Alignment Datum */}
                <line
                  x1={0}
                  y1={40}
                  x2={0}
                  y2={320}
                  stroke={isStnSelected ? "#00D4FF" : "#122030"}
                  strokeWidth={isStnSelected ? 2 : 1}
                  strokeDasharray={isStnSelected ? "none" : "3,3"}
                />

                {/* Station Badge Header */}
                <rect
                  x={-44}
                  y={12}
                  width={88}
                  height={24}
                  rx={4}
                  fill="#071018"
                  stroke={isStnSelected ? "#00D4FF" : "#162434"}
                  strokeWidth={isStnSelected ? 2 : 1}
                  className="transition-all"
                />
                <text
                  x={0}
                  y={24}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="900"
                  fill={isStnSelected ? "#00D4FF" : "#EAF2F7"}
                  className="font-mono select-none"
                >
                  {stn.code}
                </text>
                <text
                  x={0}
                  y={32}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#81909B"
                  className="select-none font-mono"
                >
                  {stn.position_km.toFixed(1)} KM
                </text>

                {/* Platform Slabs */}
                <rect
                  x={-30}
                  y={105}
                  width={60}
                  height={6}
                  rx={2}
                  fill="#122030"
                  stroke="#243B53"
                  strokeWidth="1"
                />
                <rect
                  x={-30}
                  y={255}
                  width={60}
                  height={6}
                  rx={2}
                  fill="#122030"
                  stroke="#243B53"
                  strokeWidth="1"
                />
              </g>
            );
          })}

          {/* 1. UP MAIN LINE BASE TRACK (NDLS -> CNB) */}
          <path
            d={`M ${scaleX(minKm)} ${Y_UP_MAIN} L ${scaleX(singleLineStartKm - 10)} ${Y_UP_MAIN} L ${scaleX(singleLineStartKm)} ${Y_SINGLE_LINE} L ${scaleX(singleLineEndKm)} ${Y_SINGLE_LINE} L ${scaleX(singleLineEndKm + 10)} ${Y_UP_MAIN} L ${scaleX(maxKm)} ${Y_UP_MAIN}`}
            fill="none"
            stroke={focusedTrain?.direction === "UP" ? THEME_TOKENS.railway.trackReserved : THEME_TOKENS.railway.trackActive}
            strokeWidth={focusedTrain?.direction === "UP" ? "4.5" : "3"}
            className={focusedTrain?.direction === "UP" ? "glow-cyan-route transition-all duration-300" : ""}
          />

          {/* 2. DOWN MAIN LINE BASE TRACK (CNB -> NDLS) */}
          <path
            d={`M ${scaleX(maxKm)} ${Y_DOWN_MAIN} L ${scaleX(singleLineEndKm + 10)} ${Y_DOWN_MAIN} L ${scaleX(singleLineEndKm)} ${Y_SINGLE_LINE} L ${scaleX(singleLineStartKm)} ${Y_SINGLE_LINE} L ${scaleX(singleLineStartKm - 10)} ${Y_DOWN_MAIN} L ${scaleX(minKm)} ${Y_DOWN_MAIN}`}
            fill="none"
            stroke={focusedTrain?.direction === "DOWN" ? THEME_TOKENS.railway.signalAmber : THEME_TOKENS.railway.trackActive}
            strokeWidth={focusedTrain?.direction === "DOWN" ? "4.5" : "3"}
            className="transition-all duration-300"
          />

          {/* 2B. BLOCK OCCUPANCY & HEAT OVERLAYS */}
          {blocks.map((blk) => {
            const fStn = activeStations.find((s) => s.id === blk.from_node);
            const tStn = activeStations.find((s) => s.id === blk.to_node);
            if (!fStn || !tStn) return null;
            const x1 = scaleX(fStn.position_km);
            const x2 = scaleX(tStn.position_km);
            const isUp = blk.direction === "UP";
            const isSingle = blk.id.includes("SINGLE") || blk.block_type === "SINGLE_LINE_SECTION";
            const y = isSingle ? Y_SINGLE_LINE : (isUp ? Y_UP_MAIN : Y_DOWN_MAIN);
            const isSelected = selectedEntity?.type === "BLOCK" && selectedEntity.id === blk.id;

            if (blk.is_occupied) {
              return (
                <g key={`occupied-${blk.id}`} className="cursor-pointer" onClick={(e) => {
                  e.stopPropagation();
                  handleEntitySelect({ type: "BLOCK", id: blk.id, data: blk });
                }}>
                  <line
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke="#FF1744"
                    strokeWidth="5"
                    strokeLinecap="round"
                    className="block-occupied-pulse"
                  />
                </g>
              );
            }
            if (blk.is_blocked) {
              return (
                <g key={`blocked-${blk.id}`} className="cursor-pointer" onClick={(e) => {
                  e.stopPropagation();
                  handleEntitySelect({ type: "BLOCK", id: blk.id, data: blk });
                }}>
                  <line
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke="#FFB300"
                    strokeWidth="4"
                    strokeDasharray="4,4"
                    strokeLinecap="round"
                  />
                </g>
              );
            }
            if (isSelected) {
              return (
                <line
                  key={`selected-${blk.id}`}
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                  stroke="#00D4FF"
                  strokeWidth="4"
                  strokeDasharray="2,2"
                />
              );
            }
            return null;
          })}

          {/* 3. SINGLE LINE BOTTLENECK HIGHLIGHT */}
          <g
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (singleLineBlock) {
                handleEntitySelect({ type: "BLOCK", id: singleLineBlock.id, data: singleLineBlock });
              }
            }}
          >
            <rect
              x={scaleX(singleLineStartKm)}
              y={Y_SINGLE_LINE - 14}
              width={Math.max(20, scaleX(singleLineEndKm) - scaleX(singleLineStartKm))}
              height={28}
              rx={6}
              fill="#FF1744"
              fillOpacity={0.08}
              stroke="#FF1744"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
            <text
              x={bottleneckCenterX}
              y={Y_SINGLE_LINE - 18}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="900"
              fontFamily="monospace"
              fill="#FF4D4D"
              className="select-none animate-pulse"
            >
              ⚠ SINGLE-LINE BOTTLENECK SECTION ({singleLineNodeA}–{singleLineNodeB})
            </text>
          </g>

          {/* 4. STATION LOOP LINES & POINT SWITCHES */}
          {activeStations.slice(1, -1).map((stn) => {
            const stnX = scaleX(stn.position_km);
            return (
              <g key={`loops-${stn.id}`}>
                <path
                  d={`M ${stnX - 44} ${Y_UP_MAIN} L ${stnX - 22} ${Y_UP_LOOP} L ${stnX + 22} ${Y_UP_LOOP} L ${stnX + 44} ${Y_UP_MAIN}`}
                  fill="none"
                  stroke="#1E354D"
                  strokeWidth="2"
                  strokeDasharray="2,2"
                />
                <path
                  d={`M ${stnX - 44} ${Y_DOWN_MAIN} L ${stnX - 22} ${Y_DOWN_LOOP} L ${stnX + 22} ${Y_DOWN_LOOP} L ${stnX + 44} ${Y_DOWN_MAIN}`}
                  fill="none"
                  stroke="#1E354D"
                  strokeWidth="2"
                  strokeDasharray="2,2"
                />
                {/* Switch Point Blade Indicators */}
                <line x1={stnX - 44} y1={Y_UP_MAIN} x2={stnX - 32} y2={Y_UP_MAIN - 6} stroke="#00E676" strokeWidth={1.5} />
                <line x1={stnX + 32} y1={Y_UP_MAIN - 6} x2={stnX + 44} y2={Y_UP_MAIN} stroke="#00E676" strokeWidth={1.5} />
                <line x1={stnX - 44} y1={Y_DOWN_MAIN} x2={stnX - 32} y2={Y_DOWN_MAIN + 6} stroke="#00E676" strokeWidth={1.5} />
                <line x1={stnX + 32} y1={Y_DOWN_MAIN + 6} x2={stnX + 44} y2={Y_DOWN_MAIN} stroke="#00E676" strokeWidth={1.5} />
                <text x={stnX} y={Y_UP_LOOP - 7} textAnchor="middle" fontSize="6" fontFamily="monospace" fill="#5A6D7C">
                  POINT LOCKED [NORMAL]
                </text>
              </g>
            );
          })}

          {/* 4B. WEATHER / FOG ATMOSPHERIC SPEED RESTRICTION LAYER */}
          {blocks.filter(b => b.current_speed_limit_kmh <= 45.0 || b.is_blocked).map(b => {
            const fStn = activeStations.find(s => s.id === b.from_node);
            const tStn = activeStations.find(s => s.id === b.to_node);
            if (!fStn || !tStn) return null;
            const x1 = scaleX(fStn.position_km);
            const x2 = scaleX(tStn.position_km);
            const isUp = b.direction === "UP";
            const y = b.id.includes("SINGLE") ? Y_SINGLE_LINE : (isUp ? Y_UP_MAIN : Y_DOWN_MAIN);
            return (
              <g key={`fog-${b.id}`} className="pointer-events-none">
                <rect
                  x={Math.min(x1, x2)}
                  y={y - 12}
                  width={Math.max(20, Math.abs(x2 - x1))}
                  height={24}
                  rx={4}
                  fill="#81909B"
                  fillOpacity={0.16}
                  stroke="#FFB300"
                  strokeWidth={0.8}
                  strokeDasharray="3,3"
                />
                <text
                  x={(x1 + x2) / 2}
                  y={y - 14}
                  textAnchor="middle"
                  fontSize="6.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#FFB300"
                >
                  ☁ DENSE FOG / PSR (45 km/h)
                </text>
              </g>
            );
          })}

          {/* 5. INTERACTIVE AUTOMATIC BLOCK SIGNALS */}
          {blocks.map((b, idx) => {
            const fromStn = activeStations.find((s) => s.id === b.from_node);
            const toStn = activeStations.find((s) => s.id === b.to_node);
            if (!fromStn || !toStn) return null;

            const isUp = b.direction === "UP";
            const sigX = isUp ? scaleX(fromStn.position_km) + 38 : scaleX(toStn.position_km) - 38;
            const sigY = isUp ? Y_UP_MAIN : Y_DOWN_MAIN;
            const aspect = getBlockSignalAspect(b);
            const isSigSelected = selectedEntity?.type === "SIGNAL" && selectedEntity.id === b.id;

            return (
              <SignalHead
                key={b.id}
                signalId={b.id}
                name={`S-${idx + 1}`}
                aspect={aspect}
                direction={isUp ? "UP" : "DOWN"}
                x={sigX}
                y={sigY}
                isSelected={isSigSelected}
                onClick={() => {
                  handleEntitySelect({
                    type: "SIGNAL",
                    id: b.id,
                    data: { signalId: `S-${idx + 1}`, aspect, blockId: b.id, direction: isUp ? "UP" : "DOWN" }
                  });
                }}
              />
            );
          })}

          {/* 6. PROGRESSIVE ELECTRIC ROUTE REVEAL CURRENT */}
          {focusedTrain && focusedTrain.route_block_ids && (
            <g className="route-reveal-glow">
              {focusedTrain.route_block_ids.map((bId, idx) => {
                const blk = blocks.find((b) => b.id === bId);
                if (!blk) return null;
                const fStn = activeStations.find((s) => s.id === blk.from_node);
                const tStn = activeStations.find((s) => s.id === blk.to_node);
                if (!fStn || !tStn) return null;
                const x1 = scaleX(fStn.position_km);
                const x2 = scaleX(tStn.position_km);
                const y = blk.id.includes("SINGLE") ? Y_SINGLE_LINE : (blk.direction === "UP" ? Y_UP_MAIN : Y_DOWN_MAIN);
                return (
                  <line
                    key={`route-${idx}`}
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke="#00D4FF"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    strokeOpacity={0.9}
                    className="route-reveal-flow"
                  />
                );
              })}
            </g>
          )}

          {/* 7. PREDICTIVE CONFLICT RADAR TRAJECTORIES */}
          {activeConflict && focusedTrain && conflictingTrain && (
            <g className="animate-pulse">
              <line
                x1={(renderPositions[focusedTrain.train_id] || getTrainCanvasPosition(focusedTrain)).x}
                y1={(renderPositions[focusedTrain.train_id] || getTrainCanvasPosition(focusedTrain)).y}
                x2={bottleneckCenterX}
                y2={Y_SINGLE_LINE}
                stroke="#FF1744"
                strokeWidth="2.5"
                strokeDasharray="4,4"
              />
              <line
                x1={(renderPositions[conflictingTrain.train_id] || getTrainCanvasPosition(conflictingTrain)).x}
                y1={(renderPositions[conflictingTrain.train_id] || getTrainCanvasPosition(conflictingTrain)).y}
                x2={bottleneckCenterX}
                y2={Y_SINGLE_LINE}
                stroke="#FFB300"
                strokeWidth="2.5"
                strokeDasharray="4,4"
              />
            </g>
          )}

          {/* 8. SIGNATURE FEATURE: DYNAMIC DECISION UNIVERSE (MULTI-CANDIDATE GHOST TRAJECTORIES) */}
          {activeRecommendation && (
            <g className="ghost-candidate-universe cursor-pointer">
              {activeRecommendation.counterfactual_options && activeRecommendation.counterfactual_options.length > 0 ? (
                activeRecommendation.counterfactual_options.map((opt: CounterfactualOption, optIdx: number) => {
                  const isRec = opt.is_recommended;
                  const isHighRisk = opt.conflict_risk === "HIGH" || opt.conflict_risk === "CRITICAL";
                  const color = isRec ? "#00E676" : isHighRisk ? "#FF1744" : "#00D4FF";
                  const trackY = optIdx === 0 ? Y_UP_LOOP : optIdx === 1 ? Y_UP_MAIN : Y_DOWN_LOOP;
                  const xSpanStart = scaleX(singleLineStartKm - 25 + optIdx * 5);
                  const xSpanEnd = scaleX(singleLineEndKm + 25 - optIdx * 5);
                  const textY = optIdx === 0 ? Y_UP_LOOP - 10 : optIdx === 1 ? Y_UP_MAIN - 10 : Y_DOWN_LOOP + 18;

                  return (
                    <g 
                      key={opt.option_id || `opt-${optIdx}`} 
                      className={`transition-all duration-300 ${isRec ? "ghost-candidate-pulse" : "opacity-75 hover:opacity-100"}`}
                      onClick={() => onOpenDecisionReview && onOpenDecisionReview()}
                    >
                      <line
                        x1={xSpanStart}
                        y1={trackY}
                        x2={xSpanEnd}
                        y2={trackY}
                        stroke={color}
                        strokeWidth={isRec ? 3.5 : 2}
                        strokeDasharray={isRec ? "6,4" : "4,4"}
                        strokeOpacity={isRec ? 0.95 : 0.7}
                      />
                      <rect
                        x={scaleX(bottleneckCenterX ? (singleLineStartKm + singleLineEndKm) / 2 : 120) - 140}
                        y={textY - 9}
                        width={280}
                        height={14}
                        rx={3}
                        fill="#050B11"
                        fillOpacity={0.85}
                        stroke={color}
                        strokeWidth={0.8}
                      />
                      <text
                        x={scaleX(bottleneckCenterX ? (singleLineStartKm + singleLineEndKm) / 2 : 120)}
                        y={textY + 1}
                        fontSize="8"
                        fontWeight="800"
                        fill={color}
                        textAnchor="middle"
                        className="font-mono select-none"
                      >
                        {isRec ? "★ [OPTIMUM]" : isHighRisk ? "✕ [REJECTED]" : "✓ [FEASIBLE]"}: {opt.label} • {opt.projected_total_delay_min}m DELAY
                      </text>
                    </g>
                  );
                })
              ) : (
                /* Fallback single optimum display if no counterfactual array */
                <g className="ghost-candidate-pulse" onClick={() => onOpenDecisionReview && onOpenDecisionReview()}>
                  <line
                    x1={scaleX(singleLineStartKm - 25)}
                    y1={Y_UP_LOOP}
                    x2={scaleX(singleLineStartKm + 25)}
                    y2={Y_UP_LOOP}
                    stroke="#00E676"
                    strokeWidth="3.5"
                    strokeDasharray="5,4"
                  />
                  <text
                    x={scaleX(singleLineStartKm)}
                    y={Y_UP_LOOP - 10}
                    fontSize="8.5"
                    fontWeight="900"
                    fill="#00E676"
                    textAnchor="middle"
                    className="font-mono"
                  >
                    ★ SELECTED OPTIMUM: {activeRecommendation.action} {activeRecommendation.primary_train_id} {activeRecommendation.optimization_objective_score !== undefined ? `(J=${activeRecommendation.optimization_objective_score.toFixed(1)})` : ""}
                  </text>
                </g>
              )}
            </g>
          )}

          {/* 9. CAUSAL DECISION RIPPLE SHOCKWAVE (3 Concentric Expanding Shockwaves) */}
          {decisionRippleActive && (
            <g className="causal-decision-ripple pointer-events-none">
              {/* Origin center: focused train position or bottleneck */}
              {(() => {
                const originX = focusedTrain ? (renderPositions[focusedTrain.train_id]?.x || scaleX(displayKm(focusedTrain))) : bottleneckCenterX;
                const originY = focusedTrain ? (renderPositions[focusedTrain.train_id]?.y || Y_UP_MAIN) : Y_SINGLE_LINE;
                return (
                  <>
                    <circle
                      cx={originX}
                      cy={originY}
                      r={14}
                      fill="none"
                      stroke="#00E676"
                      strokeWidth={3}
                      className="concentric-ring-1"
                    />
                    <circle
                      cx={originX}
                      cy={originY}
                      r={14}
                      fill="none"
                      stroke="#00D4FF"
                      strokeWidth={2.5}
                      className="concentric-ring-2"
                    />
                    <circle
                      cx={originX}
                      cy={originY}
                      r={14}
                      fill="none"
                      stroke="#B388FF"
                      strokeWidth={2}
                      className="concentric-ring-3"
                    />
                    {/* Interlocking Bottleneck & Signal Echo Zone */}
                    <circle
                      cx={bottleneckCenterX}
                      cy={Y_SINGLE_LINE}
                      r={40}
                      fill="#00E676"
                      fillOpacity={0.12}
                      stroke="#00D4FF"
                      strokeWidth={1.5}
                      strokeDasharray="4,2"
                      className="animate-ping"
                    />
                  </>
                );
              })()}
            </g>
          )}

          {/* 10. PREDICTED CONFLICT INTERLOCKING ZONES */}
          {predictedConflicts.map((conf) => {
            const isConfSelected = selectedEntity?.type === "CONFLICT" && selectedEntity.id === conf.conflict_id;
            const confPos = getConflictPosition(conf);
            return (
              <g
                key={conf.conflict_id}
                transform={`translate(${confPos.x}, ${confPos.y})`}
                className="cursor-pointer group animate-bounce"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEntitySelect({ type: "CONFLICT", id: conf.conflict_id, data: conf });
                  if (onSelectConflict) onSelectConflict(conf);
                }}
              >
                <circle
                  cx={0}
                  cy={0}
                  r={isConfSelected ? 24 : 18}
                  fill="#FF1744"
                  fillOpacity={0.3}
                  stroke="#FF1744"
                  strokeWidth={isConfSelected ? 3 : 2}
                />
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="bold"
                  fill="#FFFFFF"
                  className="select-none"
                >
                  ⚠
                </text>
                <rect
                  x={-60}
                  y={-34}
                  width={120}
                  height={20}
                  rx={4}
                  fill="#050B11"
                  stroke="#FF1744"
                  strokeWidth="1.5"
                />
                <text
                  x={0}
                  y={-20}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                  fill="#FF4D4D"
                  className="select-none"
                >
                  CROSSING CONFLICT
                </text>
              </g>
            );
          })}

          {/* 11. SPATIAL RELATIONSHIP GRAPH CONNECTIONS */}
          {attentionResult?.primary && attentionResult.related.length > 0 && (
            <g className="spatial-relationship-graph pointer-events-none">
              {attentionResult.related.map((rel) => {
                const p = attentionResult.primary!;
                return (
                  <g key={`rel-line-${p.id}-${rel.id}`}>
                    <line
                      x1={p.x}
                      y1={p.y}
                      x2={rel.x}
                      y2={rel.y}
                      stroke="#00D4FF"
                      strokeWidth={1.5}
                      strokeDasharray="4,3"
                      strokeOpacity={0.65}
                      className="animate-pulse"
                    />
                    <circle cx={rel.x} cy={rel.y} r={4} fill="#00D4FF" fillOpacity={0.6} />
                  </g>
                );
              })}
            </g>
          )}

          {/* 11A. CAUSAL LENS ACTIVE VISUALIZATION LAYER */}
          {causalLensActive && predictedConflicts.length > 0 && (
            <g className="causal-lens-overlay pointer-events-none">
              {predictedConflicts.map((conf) => {
                const idA = conf.involved_train_ids?.[0] || (conf as any).train_1_id;
                const idB = conf.involved_train_ids?.[1] || (conf as any).train_2_id;
                const trA = trains.find((t) => t.train_id === idA);
                const trB = trains.find((t) => t.train_id === idB);
                const posA = trA ? (renderPositions[trA.train_id] || { x: scaleX(displayKm(trA)), y: Y_UP_MAIN }) : null;
                const posB = trB ? (renderPositions[trB.train_id] || { x: scaleX(displayKm(trB)), y: Y_DOWN_MAIN }) : null;
                const confPos = getConflictPosition(conf);

                return (
                  <g key={`causal-lens-${conf.conflict_id}`}>
                    {posA && (
                      <path
                        d={`M ${posA.x} ${posA.y} Q ${(posA.x + confPos.x) / 2} ${Math.min(posA.y, confPos.y) - 30} ${confPos.x} ${confPos.y}`}
                        fill="none"
                        stroke="#FF9100"
                        strokeWidth={2.5}
                        strokeDasharray="6,4"
                        className="animate-pulse"
                      />
                    )}
                    {posB && (
                      <path
                        d={`M ${posB.x} ${posB.y} Q ${(posB.x + confPos.x) / 2} ${Math.max(posB.y, confPos.y) + 30} ${confPos.x} ${confPos.y}`}
                        fill="none"
                        stroke="#FF5252"
                        strokeWidth={2.5}
                        strokeDasharray="6,4"
                        className="animate-pulse"
                      />
                    )}
                    {/* Glowing Nexus Beacon */}
                    <circle cx={confPos.x} cy={confPos.y} r={28} fill="#FF1744" fillOpacity={0.18} stroke="#FF5252" strokeWidth={2} />
                  </g>
                );
              })}
            </g>
          )}

          {/* 11B. MOVING TRAIN PODS WITH CONTINUOUS RAILWAY SPLINE GEOMETRY & SEMANTIC LOD */}
          {trains.map((train) => {
            const splinePose = RailwaySpline.getPose(
              displayKm(train),
              train.current_block_id,
              train.direction as "UP" | "DOWN",
              viewportStartKm,
              viewportEndKm,
              1320
            );
            const x = renderPositions[train.train_id]?.x ?? splinePose.x;
            const y = renderPositions[train.train_id]?.y ?? splinePose.y;
            const isSelected = selectedEntity?.type === "TRAIN" && selectedEntity.id === train.train_id;
            const isConflicting = conflictingTrainId === train.train_id;
            const spanKm = viewportEndKm - viewportStartKm;
            const lodLevel: 0 | 1 | 2 = spanKm > 200 ? 0 : spanKm > 60 ? 1 : 2;
            const isBraking = train.current_speed_kmh < (train.max_speed_kmh * 0.4) && train.status === "RUNNING";

            return (
              <g
                key={train.train_id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEntitySelect({ type: "TRAIN", id: train.train_id, data: train });
                  if (onSelectTrain) onSelectTrain(train);
                }}
              >
                {isConflicting && (
                  <circle
                    cx={x}
                    cy={y}
                    r={26}
                    fill="none"
                    stroke="#E5A93C"
                    strokeWidth={1.5}
                    strokeDasharray="4,3"
                    opacity={0.9}
                  />
                )}
                <StylizedRollingStock
                  train={train}
                  x={x}
                  y={y}
                  rotationDeg={splinePose.rotationDeg}
                  lodLevel={lodLevel}
                  isSelected={isSelected}
                  isFocused={isSelected || isConflicting}
                  isBraking={isBraking}
                  onClick={() => {}}
                  onMouseEnter={() => setHoveredTrainId(train.train_id)}
                  onMouseLeave={() => setHoveredTrainId(null)}
                />
              </g>
            );
          })}

          {/* 12. SYNCHRONIZED ELEVATION & GRADIENT PROFILE STRIP */}
          {(() => {
            const isTrainClimbing = trains.some(
              (t) => t.status === "RUNNING" && t.current_block_id?.includes("ALJN_TDL")
            );

            // Elevation mapping: NDLS(215m) -> GZB(210m) -> ALJN(178m) -> TDL(215.5m) -> ETW(150m) -> CNB(126m)
            const elevY = (elevM: number) => 368 - ((elevM - 120) / (230 - 120)) * 26;

            const pNDLS = { x: scaleX(0), y: elevY(215) };
            const pGZB = { x: scaleX(28), y: elevY(210) };
            const pALJN = { x: scaleX(131), y: elevY(178) };
            const pTDL = { x: scaleX(209), y: elevY(215.5) };
            const pETW = { x: scaleX(301), y: elevY(150) };
            const pCNB = { x: scaleX(435), y: elevY(126) };

            const areaD = `M ${pNDLS.x} 372 L ${pNDLS.x} ${pNDLS.y} L ${pGZB.x} ${pGZB.y} L ${pALJN.x} ${pALJN.y} L ${pTDL.x} ${pTDL.y} L ${pETW.x} ${pETW.y} L ${pCNB.x} ${pCNB.y} L ${pCNB.x} 372 Z`;
            const lineD = `M ${pNDLS.x} ${pNDLS.y} L ${pGZB.x} ${pGZB.y} L ${pALJN.x} ${pALJN.y} L ${pTDL.x} ${pTDL.y} L ${pETW.x} ${pETW.y} L ${pCNB.x} ${pCNB.y}`;

            return (
              <g className="elevation-profile-strip">
                {/* Background Strip Container */}
                <rect
                  x={scaleX(minKm) - 10}
                  y={336}
                  width={scaleX(maxKm) - scaleX(minKm) + 20}
                  height={38}
                  rx={4}
                  fill="#050B11"
                  stroke="#122030"
                  strokeWidth={1}
                />
                {/* Area Gradient Fill */}
                <path d={areaD} fill="#00D4FF" fillOpacity={0.06} />
                {/* Profile Line */}
                <path d={lineD} fill="none" stroke="#00D4FF" strokeWidth={1.5} />

                {/* Climb Sector Highlight (ALJN to TDL +0.50% climb) */}
                <rect
                  x={pALJN.x}
                  y={338}
                  width={pTDL.x - pALJN.x}
                  height={34}
                  rx={3}
                  fill={isTrainClimbing ? "#FF8C1A" : "#00D4FF"}
                  fillOpacity={isTrainClimbing ? 0.18 : 0.05}
                  stroke={isTrainClimbing ? "#FF8C1A" : "#1B334B"}
                  strokeWidth={1}
                  strokeDasharray={isTrainClimbing ? "none" : "3,2"}
                />
                <text
                  x={(pALJN.x + pTDL.x) / 2}
                  y={352}
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="800"
                  fontFamily="monospace"
                  fill={isTrainClimbing ? "#FF8C1A" : "#00D4FF"}
                >
                  ▲ +0.50% CLIMB {isTrainClimbing ? "(ACTIVE TRACTION RESISTANCE)" : "(GRADIENT INCLINE)"}
                </text>

                {/* Altitude Labels */}
                <text x={pNDLS.x + 4} y={368} fontSize="6" fontFamily="monospace" fill="#5A6D7C">215m</text>
                <text x={pALJN.x} y={368} textAnchor="middle" fontSize="6" fontFamily="monospace" fill="#5A6D7C">178m</text>
                <text x={pTDL.x} y={368} textAnchor="middle" fontSize="6" fontFamily="monospace" fill="#5A6D7C">215.5m</text>
                <text x={pCNB.x - 4} y={368} textAnchor="end" fontSize="6" fontFamily="monospace" fill="#5A6D7C">126m</text>

                <text x={scaleX(minKm) + 4} y={345} fontSize="6.5" fontWeight="bold" fontFamily="monospace" fill="#81909B">
                  CORRIDOR ELEVATION PROFILE & GRADIENT INCLINE (NDLS 215m → CNB 126m)
                </text>
              </g>
            );
          })()}
        </svg>
        )}

        {/* Floating Glassmorphic Context Inspector Overlay (Top Right of Canvas) */}
        {selectedEntity && (
          <div className="absolute top-4 right-4 z-20 w-[340px] floating-inspector rounded-xl p-4 text-xs font-mono shadow-2xl">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#162434]">
              <span className="px-2 py-0.5 rounded bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/50 text-[10px] font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                {selectedEntity.type} INSPECTOR
              </span>
              <button
                onClick={() => handleEntitySelect(null)}
                className="p-1 rounded hover:bg-[#162434] text-[#81909B] hover:text-[#EAF2F7] transition-all"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {selectedEntity.type === "TRAIN" && (
              <div className="space-y-2.5">
                <div>
                  <div className="text-sm font-bold text-[#EAF2F7] font-mono">
                    {selectedEntity.data.train_number} • {selectedEntity.data.train_name}
                  </div>
                  <div className="text-[10px] text-[#81909B]">
                    {selectedEntity.data.direction === "UP" ? "NDLS → CNB (UP Main)" : "CNB → NDLS (DOWN Main)"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#050B11] p-2.5 rounded-lg border border-[#162434]">
                  <div>
                    <span className="text-[#81909B] text-[9px] block">PRIORITY</span>
                    <strong className="text-[#00D4FF]">P{selectedEntity.data.priority}</strong>
                  </div>
                  <div>
                    <span className="text-[#81909B] text-[9px] block">SPEED</span>
                    <strong className="text-[#00E676]">{Math.round(selectedEntity.data.current_speed_kmh)} km/h</strong>
                  </div>
                  <div>
                    <span className="text-[#81909B] text-[9px] block">CURRENT BLOCK</span>
                    <strong className="text-[#EAF2F7] truncate block">{selectedEntity.data.current_block_id}</strong>
                  </div>
                  <div>
                    <span className="text-[#81909B] text-[9px] block">DELAY</span>
                    <strong className={selectedEntity.data.total_delay_sec > 0 ? "text-[#FFB300]" : "text-[#00E676]"}>
                      {selectedEntity.data.total_delay_sec > 0 ? `+${Math.round(selectedEntity.data.total_delay_sec / 60)}m` : "ON-TIME"}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {selectedEntity.type === "SIGNAL" && (
              <div className="space-y-2.5">
                <div>
                  <div className="text-sm font-bold text-[#EAF2F7] font-mono">
                    SIGNAL {selectedEntity.data.signalId}
                  </div>
                  <div className="text-[10px] text-[#81909B]">
                    Automatic Color-Light • Direction: {selectedEntity.data.direction}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#050B11] p-2.5 rounded-lg border border-[#162434]">
                  <div>
                    <span className="text-[#81909B] text-[9px] block">ASPECT</span>
                    <strong className={selectedEntity.data.aspect === "GREEN" ? "text-[#00E676]" : selectedEntity.data.aspect === "RED" ? "text-[#FF1744]" : "text-[#FFB300]"}>
                      {selectedEntity.data.aspect}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#81909B] text-[9px] block">PROTECTING</span>
                    <strong className="text-[#00D4FF] truncate block">{selectedEntity.data.blockId}</strong>
                  </div>
                </div>
              </div>
            )}

            {selectedEntity.type === "BLOCK" && (
              <div className="space-y-2.5">
                <div>
                  <div className="text-sm font-bold text-[#EAF2F7] font-mono">
                    BLOCK {selectedEntity.data.name || selectedEntity.data.id}
                  </div>
                  <div className="text-[10px] text-[#81909B]">
                    Length: {selectedEntity.data.length_km} km • Max Speed: {selectedEntity.data.max_speed_kmh} km/h
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#050B11] p-2.5 rounded-lg border border-[#162434]">
                  <div>
                    <span className="text-[#81909B] text-[9px] block">OCCUPANCY</span>
                    <strong className={selectedEntity.data.is_occupied ? "text-[#FF1744]" : "text-[#00E676]"}>
                      {selectedEntity.data.is_occupied ? "OCCUPIED" : "CLEAR"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#81909B] text-[9px] block">BLOCK STATUS</span>
                    <strong className={selectedEntity.data.is_blocked ? "text-[#FF1744]" : "text-[#00E676]"}>
                      {selectedEntity.data.is_blocked ? "BLOCKED" : "ACTIVE"}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {selectedEntity.type === "CONFLICT" && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-sm font-bold text-[#FF1744]">
                  <AlertTriangle className="w-4 h-4" />
                  CONFLICT {selectedEntity.data.conflict_id}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#050B11] p-2.5 rounded-lg border border-[#162434]">
                  <div>
                    <span className="text-[#81909B] text-[9px] block">SEVERITY</span>
                    <strong className="text-[#FF1744]">{selectedEntity.data.severity}</strong>
                  </div>
                  <div>
                    <span className="text-[#81909B] text-[9px] block">LOCATION BLOCK</span>
                    <strong className="text-[#EAF2F7]">{selectedEntity.data.location_block_name || selectedEntity.data.location_block_id}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#81909B] text-[9px] block">INVOLVED TRAINS</span>
                    <strong className="text-[#00D4FF]">{selectedEntity.data.involved_train_ids.join(" ↔ ")}</strong>
                  </div>
                </div>
              </div>
            )}

            {selectedEntity.type === "STATION" && (
              <div className="space-y-2.5">
                <div>
                  <div className="text-sm font-bold text-[#EAF2F7] font-mono">
                    {selectedEntity.data.name} ({selectedEntity.data.code})
                  </div>
                  <div className="text-[10px] text-[#81909B]">
                    Corridor KM: {selectedEntity.data.position_km.toFixed(1)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#050B11] p-2.5 rounded-lg border border-[#162434]">
                  <div>
                    <span className="text-[#81909B] text-[9px] block">LOOP TRACKS</span>
                    <strong className="text-[#00D4FF]">{selectedEntity.data.loop_blocks.length} TRACKS</strong>
                  </div>
                  <div>
                    <span className="text-[#81909B] text-[9px] block">PLATFORMS</span>
                    <strong className="text-[#00E676]">{selectedEntity.data.platforms?.length ?? 0}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Action Buttons */}
            <div className="pt-2 border-t border-[#162434] flex flex-col gap-1.5">
              {onExplainEntity && (
                <button
                  onClick={() => onExplainEntity(selectedEntity)}
                  className="w-full py-1.5 px-2 rounded-md bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Bot className="w-3.5 h-3.5" />
                  EXPLAIN WITH AI COPILOT
                </button>
              )}

              {onSimulateInWhatIf && (
                <button
                  onClick={() => onSimulateInWhatIf(selectedEntity)}
                  className="w-full py-1.5 px-2 rounded-md bg-[#00E676]/10 hover:bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  SIMULATE IN WHAT-IF LAB
                </button>
              )}

              {selectedEntity.type === "CONFLICT" && onOpenDecisionReview && (
                <button
                  onClick={onOpenDecisionReview}
                  className="w-full py-1.5 px-2 rounded-md bg-[#00E676] text-[#071018] font-bold text-[11px] flex items-center justify-center gap-1.5 hover:bg-[#00E676]/90 transition-all shadow-md shadow-[#00E676]/20"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  REVIEW AI OPTIMIZER
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {selectedEntity.type === "TRAIN" && onTriggerDisruption && (
                <button
                  onClick={() => onTriggerDisruption("TRAIN_DELAY", selectedEntity.id)}
                  className="w-full py-1.5 px-2 rounded-md bg-[#FFB300]/10 hover:bg-[#FFB300]/20 text-[#FFB300] border border-[#FFB300]/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Clock className="w-3.5 h-3.5" />
                  INJECT DELAY (+5M)
                </button>
              )}

              {selectedEntity.type === "BLOCK" && onTriggerDisruption && (
                <button
                  onClick={() => onTriggerDisruption("BLOCK_CLOSURE", selectedEntity.id)}
                  className="w-full py-1.5 px-2 rounded-md bg-[#FF1744]/10 hover:bg-[#FF1744]/20 text-[#FF1744] border border-[#FF1744]/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Zap className="w-3.5 h-3.5" />
                  SIMULATE BLOCK CLOSURE
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scale 3: Future Railway Theater Candidate Branch Bar */}
        {activeRecommendation && (
          <FutureRailwayTheater
            recommendation={activeRecommendation}
            selectedCandidateId={null}
            onSelectCandidate={(candId) => {
              const opt = activeRecommendation?.counterfactual_options?.find(
                (o: any) => (o.candidate_id || o.label) === candId
              );
              if (opt?.target_train_id) {
                FocusManager.focusTrain(opt.target_train_id);
              }
            }}
            onApproveSelected={() => {
              if (onOpenDecisionReview) onOpenDecisionReview();
            }}
            causalLensActive={causalLensActive}
            onToggleCausalLens={() => setCausalLensActive((prev) => !prev)}
          />
        )}
      </div>

      {/* Bottom Subtle Status & Quick Navigation Ticker */}
      <div className="bg-[#050B11]/90 border-t border-[#122030] px-6 py-2 flex items-center justify-between text-xs transition-all duration-300">
        {focusedTrain ? (
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-bold font-mono text-[#00D4FF]">
              <Navigation className="w-3.5 h-3.5" />
              TRAIN {focusedTrain.train_number} ({focusedTrain.train_name})
            </span>
            <span className="text-[#81909B]">
              Priority: <strong className="text-[#EAF2F7] font-mono">P{focusedTrain.priority}</strong>
            </span>
            <span className="text-[#81909B]">
              Current Block: <strong className="text-[#00D4FF] font-mono">{focusedTrain.current_block_id}</strong>
            </span>
            <span className="text-[#81909B]">
              Speed: <strong className="text-[#00E676] font-mono">{focusedTrain.current_speed_kmh.toFixed(0)} km/h</strong>
            </span>
            {activeConflict && (
              <span className="flex items-center gap-1 text-[#FF1744] font-bold font-mono bg-[#FF1744]/10 px-2 py-0.5 rounded border border-[#FF1744]/30">
                <AlertTriangle className="w-3.5 h-3.5 conflict-pulse-slow" />
                CONFLICT WITH {conflictingTrain?.train_name || conflictingTrainId}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[#81909B] font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-[#00E676] glow-signal-green" />
            <span>CORRIDOR CTC ACTIVE • CLICK ANY TRAIN, SIGNAL, OR BLOCK FOR DETAILS</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-[#00D4FF] font-mono text-[11px]">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <Route className="w-3.5 h-3.5" />
          <span>REAL-TIME DIGITAL TWIN</span>
        </div>
      </div>
    </div>
  );
};
