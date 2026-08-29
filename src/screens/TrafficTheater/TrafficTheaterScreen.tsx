import React, { useState, useMemo } from "react";
import type { Train, TrackBlock, Station, PredictedConflict, OperationalKPIs, SignalAspect } from "../../types/railway";
import { NXTrackCanvas, type SelectedRailwayEntity } from "../../components/NXPanel/NXTrackCanvas";
import { SignalAspectEngine } from "../../components/NXPanel/SignalAspectEngine";
import { TrafficTimelineRibbon, type TimelineMilestone } from "../../components/TrafficTheater/TrafficTimelineRibbon";
import { SimulationCockpit, type CameraViewMode } from "../../components/TrafficTheater/SimulationCockpit";
import { TrainDigitalTwinCard } from "../../components/TrafficTheater/TrainDigitalTwinCard";

interface TrafficTheaterScreenProps {
  trains: Train[];
  blocks: TrackBlock[];
  stations: Station[];
  kpis: OperationalKPIs | null;
  predictedConflicts: PredictedConflict[];
  selectedEntity: SelectedRailwayEntity | null;
  isRunning: boolean;
  timeScale: number;
  simTimeFormatted: string;
  simTimeSec?: number;
  events?: any[];
  seekingStatus?: "IDLE" | "SEEKING" | "COMPLETE";
  onTogglePlay: () => void;
  onReset: () => void;
  onScaleChange: (scale: number) => void;
  onSelectEntity: (entity: SelectedRailwayEntity | null) => void;
  onSelectTrain: (train: Train) => void;
  onSelectConflict?: (conflict: PredictedConflict) => void;
  onTriggerDisruption?: (type: string, targetId: string) => void;
  onFastForwardDemo?: () => void;
  onJumpNextConflict?: () => void;
  onSeekSimTime?: (timeSec: number) => void;
  onJumpToEvent?: (eventType: string) => void;
}

export const TrafficTheaterScreen: React.FC<TrafficTheaterScreenProps> = ({
  trains,
  blocks,
  stations,
  kpis,
  predictedConflicts,
  selectedEntity,
  isRunning,
  timeScale,
  simTimeFormatted,
  simTimeSec = 0,
  events = [],
  seekingStatus = "IDLE",
  onTogglePlay,
  onReset,
  onScaleChange,
  onSelectEntity,
  onSelectTrain,
  onSelectConflict,
  onTriggerDisruption,
  onFastForwardDemo,
  onJumpNextConflict,
  onSeekSimTime,
  onJumpToEvent
}) => {
  const [viewMode, setViewMode] = useState<CameraViewMode>("OVERVIEW");
  const [selectedTrainInternal, setSelectedTrainInternal] = useState<Train | null>(null);

  // Sync selected train: If no train is explicitly selected, keep null for network overview
  const activeTrain = useMemo(() => {
    if (selectedEntity && selectedEntity.type === "TRAIN") {
      return selectedEntity.data as Train;
    }
    if (selectedTrainInternal) {
      return trains.find(t => t.train_id === selectedTrainInternal.train_id) || selectedTrainInternal;
    }
    return null;
  }, [selectedEntity, selectedTrainInternal, trains]);

  // Compute authentic forward signal aspect for active train via SignalAspectEngine
  const forwardSignalAspect: SignalAspect = useMemo(() => {
    if (!activeTrain || !activeTrain.current_block_id) return "GREEN";
    const block = blocks.find((b) => b.id === activeTrain.current_block_id);
    if (!block) return "GREEN";
    return SignalAspectEngine.determineAspect(block, blocks);
  }, [activeTrain, blocks]);

  // Dynamically generate timeline milestones from real events and conflicts
  const dynamicMilestones: TimelineMilestone[] = useMemo(() => {
    const ms: TimelineMilestone[] = [
      { id: "m-dep", timeSec: 0, label: "00:00 ORIGIN DEPARTURES", type: "DEPARTURE", details: "Trains depart initial stations" }
    ];

    if (events && events.length > 0) {
      events.slice(-5).forEach((ev, idx) => {
        const tSec = ev.timestamp_sec || idx * 120;
        if (ev.event_type === "SIGNAL_CHANGED") {
          ms.push({ id: `ev-${idx}`, timeSec: tSec, label: `SIGNAL ASPECT CHANGED`, type: "SIGNAL_CHANGE", details: ev.message || "" });
        } else if (ev.event_type === "DECISION_APPROVED") {
          ms.push({ id: `ev-${idx}`, timeSec: tSec, label: `DISPATCH PLAN APPROVED`, type: "APPROVAL", details: ev.message || "" });
        }
      });
    }

    predictedConflicts.forEach((c) => {
      const timeSec = c.predicted_time_sec ?? c.time_to_conflict_sec ?? 600;
      ms.push({
        id: `conf-${c.conflict_id}`,
        timeSec,
        label: `CONFLICT ${c.conflict_id}`,
        type: "CONFLICT_PREDICTED",
        details: `Crossing contention at ${c.location_block_id}`
      });
    });

    return ms.sort((a, b) => a.timeSec - b.timeSec);
  }, [events, predictedConflicts]);

  const handleSeek = (targetSec: number) => {
    if (onSeekSimTime) {
      onSeekSimTime(targetSec);
    } else if (targetSec >= 600 && onFastForwardDemo) {
      onFastForwardDemo();
    }
  };

  const handleFollowTrain = (train: Train) => {
    setSelectedTrainInternal(train);
    setViewMode("FOLLOW_TRAIN");
    onSelectEntity({ type: "TRAIN", id: train.train_id, data: train });
  };

  return (
    <div className="relative w-full h-[calc(100vh-80px)] bg-[#050806] text-[#E2E8E4] flex flex-col justify-between overflow-hidden p-3 gap-2 font-sans select-none">
      {/* 1. Header Theater HUD Bar */}
      <div className="w-full bg-[#080B09]/95 backdrop-blur-md border border-[#18201A] rounded-xl px-4 py-2 flex items-center justify-between shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] animate-pulse" />
            <span className="font-display font-black text-sm text-[#00E5FF] tracking-wider">
              RAILOPT-X TRAFFIC THEATER
            </span>
          </div>
          <span className="text-xs text-[#3E4E42]">|</span>
          <span className="text-[11px] font-mono text-[#8C9A8E] uppercase tracking-wide">
            NDLS–CNB 435 KM DIGITAL TWIN WORLD
          </span>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 bg-[#0F1411] px-2.5 py-1 rounded-md border border-[#1E2822]">
            <span className="text-[#6A7A6E]">TIME:</span>
            <strong className="text-[#00E5FF]">{simTimeFormatted}</strong>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0F1411] px-2.5 py-1 rounded-md border border-[#1E2822]">
            <span className="text-[#6A7A6E]">ACTIVE:</span>
            <strong className="text-[#00E5FF]">{trains.length} Trains</strong>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0F1411] px-2.5 py-1 rounded-md border border-[#1E2822]">
            <span className="text-[#6A7A6E]">CONFLICTS:</span>
            <strong className={predictedConflicts.length > 0 ? "text-[#D62828] font-black" : "text-[#2E7D32]"}>
              {predictedConflicts.length}
            </strong>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0F1411] px-2.5 py-1 rounded-md border border-[#1E2822]">
            <span className="text-[#6A7A6E]">THROUGHPUT:</span>
            <strong className="text-[#E2E8E4]">{kpis ? `${kpis.throughput_trains_per_hr.toFixed(1)} tr/hr` : "—"}</strong>
          </div>
        </div>
      </div>

      {/* 2. Main Corridor Visualization Stage (70% Dominant Visual) */}
      <div className="relative flex-1 w-full bg-[#070A08] border border-[#18201A] rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center min-h-[360px]">
        <NXTrackCanvas
          trains={trains}
          blocks={blocks}
          stations={stations}
          predictedConflicts={predictedConflicts}
          selectedEntity={selectedEntity}
          viewMode={viewMode}
          focusedTrainId={activeTrain?.train_id}
          onSelectEntity={onSelectEntity}
          onSelectTrain={(t) => {
            setSelectedTrainInternal(t);
            onSelectTrain(t);
          }}
          onSelectConflict={(conf) => {
            onSelectEntity({ type: "CONFLICT", id: conf.conflict_id, data: conf });
            if (onSelectConflict) onSelectConflict(conf);
          }}
          onTriggerDisruption={onTriggerDisruption}
        />

        {/* Floating Digital Twin Telemetry & Diagnostic Card */}
        <div className="absolute top-4 right-4 z-30 pointer-events-auto">
          <TrainDigitalTwinCard
            train={activeTrain}
            currentBlock={blocks.find(b => b.id === activeTrain?.current_block_id)}
            forwardSignalAspect={forwardSignalAspect}
            onClose={() => {
              setSelectedTrainInternal(null);
              onSelectEntity(null);
            }}
            onFollowTrain={handleFollowTrain}
            onSimulateWhatIf={(t) => onTriggerDisruption?.("TRAIN_DELAY", t.train_id)}
          />
        </div>
      </div>

      {/* 3. Bottom Operational Timeline & Simulation Cockpit Controls */}
      <div className="w-full flex flex-col gap-2 shrink-0">
        <TrafficTimelineRibbon
          currentSimTimeSec={simTimeSec}
          totalHorizonSec={1200}
          milestones={dynamicMilestones}
          seekingStatus={seekingStatus}
          onSeek={handleSeek}
        />

        <SimulationCockpit
          isRunning={isRunning}
          timeScale={timeScale}
          viewMode={viewMode}
          onTogglePlay={onTogglePlay}
          onReset={onReset}
          onScaleChange={onScaleChange}
          onSelectViewMode={setViewMode}
          onJumpToDeparture={() => onJumpToEvent ? onJumpToEvent("DEPARTURE") : handleSeek(0)}
          onJumpToSignalChange={() => onJumpToEvent ? onJumpToEvent("SIGNAL_CHANGED") : handleSeek(150)}
          onJumpToConflict={() => {
            if (onJumpToEvent) {
              onJumpToEvent("CONFLICT_PREDICTED");
            } else if (onJumpNextConflict) {
              onJumpNextConflict();
            } else {
              handleSeek(600);
            }
          }}
          onJumpToRecommendation={() => onJumpToEvent ? onJumpToEvent("RECOMMENDATION") : handleSeek(630)}
        />
      </div>
    </div>
  );
};
