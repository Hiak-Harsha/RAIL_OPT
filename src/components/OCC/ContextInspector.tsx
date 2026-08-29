import React from "react";
import type { Train, TrackBlock, Station, PredictedConflict, Recommendation, OperationalKPIs } from "../../types/railway";
import type { SelectedRailwayEntity } from "../NXPanel/NXTrackCanvas";
import { 
  ShieldCheck, AlertTriangle, Zap, Clock, 
  Bot, FlaskConical, Sparkles, ArrowRight, X, Activity
} from "lucide-react";
import { WhyPanel } from "../Explain/WhyPanel";

interface ContextInspectorProps {
  selectedEntity: SelectedRailwayEntity | null;
  trains: Train[];
  blocks: TrackBlock[];
  stations: Station[];
  predictedConflicts: PredictedConflict[];
  activeRecommendation?: Recommendation | null;
  kpis?: OperationalKPIs | null;
  safetyInvariants?: { checked: number; passed: number; failed: number; percentage: number } | null;
  onClearSelection: () => void;
  onSelectEntity?: (entity: SelectedRailwayEntity | null) => void;
  onExplainEntity?: (entity: SelectedRailwayEntity) => void;
  onSimulateInWhatIf?: (entity: SelectedRailwayEntity) => void;
  onOpenDecisionReview?: () => void;
  onTriggerDisruption?: (type: string, targetId: string) => void;
  canInjectDisruption?: boolean;
}

export const ContextInspector: React.FC<ContextInspectorProps> = ({
  selectedEntity,
  trains,
  blocks,
  stations: _stations,
  predictedConflicts,
  activeRecommendation: _activeRecommendation,
  kpis: _kpis,
  safetyInvariants,
  onClearSelection,
  onSelectEntity: _onSelectEntity,
  onExplainEntity,
  onSimulateInWhatIf,
  onOpenDecisionReview,
  onTriggerDisruption,
  canInjectDisruption = true
}) => {
  // If nothing is selected, display the global Network Overview Surface
  if (!selectedEntity) {
    const delayedCount = trains.filter(t => t.total_delay_sec > 60).length;
    const runningCount = trains.filter(t => t.status === "RUNNING").length;
    const occupiedBlocks = blocks.filter(b => b.is_occupied).length;

    return (
      <div className="bg-[#0A131D] border border-[#162434] rounded-xl p-4 shadow-2xl space-y-3.5 select-none">
        <div className="flex items-center justify-between pb-2 border-b border-[#162434]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
            <h4 className="text-xs font-mono font-bold text-[#EAF2F7] uppercase tracking-wider">
              CORRIDOR NETWORK STATUS
            </h4>
          </div>
          <span className="text-[10px] font-mono text-[#00D4FF]">LIVE MONITOR</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-[#050B11] p-2.5 rounded-lg border border-[#162434]">
            <span className="text-[9px] text-[#81909B] block">ACTIVE TRAINS</span>
            <strong className="text-sm text-[#00D4FF]">{trains.length}</strong>
            <span className="text-[9.5px] text-[#81909B] block mt-0.5">{runningCount} Running • {delayedCount} Delayed</span>
          </div>

          <div className="bg-[#050B11] p-2.5 rounded-lg border border-[#162434]">
            <span className="text-[9px] text-[#81909B] block">TRACK OCCUPANCY</span>
            <strong className="text-sm text-[#EAF2F7]">{occupiedBlocks} / {blocks.length}</strong>
            <span className="text-[9.5px] text-[#81909B] block mt-0.5">Blocks Active</span>
          </div>

          <div className="bg-[#050B11] p-2.5 rounded-lg border border-[#162434]">
            <span className="text-[9px] text-[#81909B] block">ACTIVE RISKS</span>
            <strong className={`text-sm ${predictedConflicts.length > 0 ? "text-[#FF1744]" : "text-[#00E676]"}`}>
              {predictedConflicts.length}
            </strong>
            <span className="text-[9.5px] text-[#81909B] block mt-0.5">
              {predictedConflicts.length > 0 ? "Potential Bottleneck" : "Equilibrium"}
            </span>
          </div>

          <div className="bg-[#050B11] p-2.5 rounded-lg border border-[#162434]">
            <span className="text-[9px] text-[#81909B] block">SAFETY SHIELD</span>
            <strong className={`text-sm ${safetyInvariants ? "text-[#00E676]" : "text-[#81909B]"}`}>
              {safetyInvariants ? `${safetyInvariants.percentage.toFixed(0)}%` : "—"}
            </strong>
            <span className="text-[9.5px] text-[#81909B] block mt-0.5">
              {safetyInvariants ? `${safetyInvariants.passed}/${safetyInvariants.checked} Passed` : "Awaiting Validation"}
            </span>
          </div>
        </div>

        <div className="bg-[#050B11]/80 p-2 rounded-lg border border-[#162434]/80 text-[10px] font-mono text-[#81909B] flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[#00D4FF] shrink-0" />
          <span>Click any Train, Track Block, Signal, or Conflict marker on the NX Stage to inspect.</span>
        </div>
      </div>
    );
  }

  // An Entity is selected
  return (
    <div className="bg-[#0A131D] border border-[#00D4FF]/40 rounded-xl p-4 shadow-2xl space-y-3 text-xs font-mono select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#162434]">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/50 text-[10px] font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            {selectedEntity.type} INSPECTOR
          </span>
        </div>
        <button
          onClick={onClearSelection}
          className="p-1 rounded hover:bg-[#162434] text-[#81909B] hover:text-[#EAF2F7] transition-all"
          title="Close Inspector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Train Details */}
      {selectedEntity.type === "TRAIN" && (
        <div className="space-y-3">
          <div>
            <div className="text-sm font-bold text-[#EAF2F7]">
              {selectedEntity.data.train_number} • {selectedEntity.data.train_name}
            </div>
            <div className="text-[10px] text-[#81909B]">
              {selectedEntity.data.direction === "UP" ? "NDLS → CNB (UP Main)" : "CNB → NDLS (DOWN Main)"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#050B11] p-2.5 rounded-lg border border-[#162434]">
            <div>
              <span className="text-[#81909B] text-[9px] block">PRIORITY CLASS</span>
              <strong className="text-[#00D4FF]">P{selectedEntity.data.priority}</strong>
            </div>
            <div>
              <span className="text-[#81909B] text-[9px] block">CURRENT SPEED</span>
              <strong className="text-[#00E676]">{Math.round(selectedEntity.data.current_speed_kmh)} km/h</strong>
            </div>
            <div>
              <span className="text-[#81909B] text-[9px] block">BLOCK OCCUPIED</span>
              <strong className="text-[#EAF2F7] truncate block">{selectedEntity.data.current_block_id || "MAIN"}</strong>
            </div>
            <div>
              <span className="text-[#81909B] text-[9px] block">TOTAL DELAY</span>
              <strong className={selectedEntity.data.total_delay_sec > 0 ? "text-[#FFB300]" : "text-[#00E676]"}>
                {selectedEntity.data.total_delay_sec > 0 ? `+${Math.round(selectedEntity.data.total_delay_sec / 60)}m` : "ON-TIME"}
              </strong>
            </div>
          </div>

          {selectedEntity.data.wait_reason && (
            <div className="mt-2">
              <WhyPanel
                payload={{ kind: "WAIT_REASON", data: selectedEntity.data.wait_reason, trainId: selectedEntity.data.train_id }}
              />
            </div>
          )}
        </div>
      )}

      {/* Signal Details */}
      {selectedEntity.type === "SIGNAL" && (
        <div className="space-y-3">
          <div>
            <div className="text-sm font-bold text-[#EAF2F7]">
              SIGNAL {selectedEntity.data.signalId}
            </div>
            <div className="text-[10px] text-[#81909B]">
              Direction: {selectedEntity.data.direction} • Interlocking Automatic Signal
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#050B11] p-2.5 rounded-lg border border-[#162434]">
            <div>
              <span className="text-[#81909B] text-[9px] block">SIGNAL ASPECT</span>
              <strong className={
                selectedEntity.data.aspect === "GREEN" ? "text-[#00E676]" :
                selectedEntity.data.aspect === "RED" ? "text-[#FF1744]" : "text-[#FFB300]"
              }>
                {selectedEntity.data.aspect}
              </strong>
            </div>
            <div>
              <span className="text-[#81909B] text-[9px] block">PROTECTING BLOCK</span>
              <strong className="text-[#00D4FF] truncate block">{selectedEntity.data.blockId}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Block Details */}
      {selectedEntity.type === "BLOCK" && (
        <div className="space-y-3">
          <div>
            <div className="text-sm font-bold text-[#EAF2F7]">
              BLOCK {selectedEntity.data.name || selectedEntity.data.id}
            </div>
            <div className="text-[10px] text-[#81909B]">
              Length: {selectedEntity.data.length_km} km • Max Speed: {selectedEntity.data.max_speed_kmh} km/h
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#050B11] p-2.5 rounded-lg border border-[#162434]">
            <div>
              <span className="text-[#81909B] text-[9px] block">OCCUPANCY STATE</span>
              <strong className={selectedEntity.data.is_occupied ? "text-[#FF1744]" : "text-[#00E676]"}>
                {selectedEntity.data.is_occupied ? "OCCUPIED" : "CLEAR"}
              </strong>
            </div>
            <div>
              <span className="text-[#81909B] text-[9px] block">OPERATIONAL STATUS</span>
              <strong className={selectedEntity.data.is_blocked ? "text-[#FF1744]" : "text-[#00E676]"}>
                {selectedEntity.data.is_blocked ? "BLOCKED" : "ACTIVE"}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Details */}
      {selectedEntity.type === "CONFLICT" && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-sm font-bold text-[#FF1744]">
            <AlertTriangle className="w-4 h-4" />
            CROSSING CONFLICT {selectedEntity.data.conflict_id}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#050B11] p-2.5 rounded-lg border border-[#162434]">
            <div>
              <span className="text-[#81909B] text-[9px] block">SEVERITY</span>
              <strong className="text-[#FF1744]">{selectedEntity.data.severity}</strong>
            </div>
            <div>
              <span className="text-[#81909B] text-[9px] block">LOCATION</span>
              <strong className="text-[#EAF2F7]">{selectedEntity.data.location_block_name || selectedEntity.data.location_block_id}</strong>
            </div>
            <div className="col-span-2">
              <span className="text-[#81909B] text-[9px] block">INVOLVED TRAINS</span>
              <strong className="text-[#00D4FF]">{selectedEntity.data.involved_train_ids.join(" ↔ ")}</strong>
            </div>
          </div>

          {selectedEntity.data.explanation && (
            <div className="mt-2">
              <WhyPanel payload={{ kind: "CONFLICT", data: selectedEntity.data.explanation }} />
            </div>
          )}
        </div>
      )}

      {/* Station Details */}
      {selectedEntity.type === "STATION" && (
        <div className="space-y-3">
          <div>
            <div className="text-sm font-bold text-[#EAF2F7]">
              {selectedEntity.data.name} ({selectedEntity.data.code})
            </div>
            <div className="text-[10px] text-[#81909B]">
              Corridor Position: {selectedEntity.data.position_km.toFixed(1)} KM
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

      {/* Action Buttons Section */}
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

        {selectedEntity.type === "TRAIN" && onTriggerDisruption && canInjectDisruption && (
          <button
            onClick={() => onTriggerDisruption("TRAIN_DELAY", selectedEntity.id)}
            className="w-full py-1.5 px-2 rounded-md bg-[#FFB300]/10 hover:bg-[#FFB300]/20 text-[#FFB300] border border-[#FFB300]/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
          >
            <Clock className="w-3.5 h-3.5" />
            INJECT DELAY (+5M)
          </button>
        )}

        {selectedEntity.type === "BLOCK" && onTriggerDisruption && canInjectDisruption && (
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
  );
};
