import React from "react";
import type { Train, TrackBlock, SignalAspect } from "../../types/railway";
import { Navigation, HelpCircle, Zap, X } from "lucide-react";

interface TrainDigitalTwinCardProps {
  train: Train | null;
  currentBlock?: TrackBlock | null;
  forwardSignalAspect?: SignalAspect | null;
  onClose?: () => void;
  onFollowTrain?: (train: Train) => void;
  onSimulateWhatIf?: (train: Train) => void;
  className?: string;
}

export const TrainDigitalTwinCard: React.FC<TrainDigitalTwinCardProps> = ({
  train,
  currentBlock: _currentBlock,
  forwardSignalAspect = "GREEN",
  onClose,
  onFollowTrain,
  onSimulateWhatIf,
  className = ""
}) => {
  if (!train) {
    return (
      <div className={`w-80 bg-[#080B09]/95 border border-[#1B241E] rounded-xl p-5 text-center flex flex-col items-center justify-center text-[#6A7A6E] font-mono text-xs ${className}`}>
        <Navigation className="w-8 h-8 mb-2 text-[#243027] animate-pulse" />
        <span className="font-bold text-[#8C9A8E]">SELECT A TRAIN CONSIST</span>
        <span className="text-[10px] text-[#4E5C51] mt-1">Hover or click any train puck along the corridor to inspect its real-time telemetry</span>
      </div>
    );
  }

  const delayMin = train.total_delay_sec / 60.0;
  const isDelayed = delayMin > 1.0;

  const getPriorityBadge = (p: number) => {
    switch (p) {
      case 5: return { label: "P5 VANDE BHARAT", color: "bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/40" };
      case 4: return { label: "P4 RAJDHANI", color: "bg-[#FF8C1A]/20 text-[#FF8C1A] border-[#FF8C1A]/40" };
      case 3: return { label: "P3 EXPRESS", color: "bg-[#B388FF]/20 text-[#B388FF] border-[#B388FF]/40" };
      default: return { label: "P2 FREIGHT", color: "bg-[#78909C]/20 text-[#78909C] border-[#78909C]/40" };
    }
  };

  const prio = getPriorityBadge(train.priority);

  // Diagnostic reason for train delay or waiting state
  const getWaitingReason = () => {
    if (train.is_dwelling) {
      return {
        title: "STATION PLATFORM DWELL",
        reason: `Performing scheduled passenger boarding at platform. Dwell timer: ${Math.round(train.dwell_remaining_sec || 0)}s remaining.`,
        severity: "INFO"
      };
    }
    if (train.hold_duration_remaining_sec > 0) {
      return {
        title: "DISPATCHER PRECEDENCE HOLD",
        reason: `Held by section controller on loop line to grant precedence to higher-priority express. Hold duration remaining: ${Math.round(train.hold_duration_remaining_sec)}s.`,
        severity: "WARNING"
      };
    }
    if (forwardSignalAspect === "RED") {
      return {
        title: "RESTRICTIVE RED SIGNAL (DANGER)",
        reason: "Next block is occupied or route is unreserved. Automatic train protection enforces 0 km/h braking.",
        severity: "CRITICAL"
      };
    }
    if (forwardSignalAspect === "YELLOW") {
      return {
        title: "CAUTION SIGNAL RESTRICTION",
        reason: "Approaching occupied block downstream. Speed restricted to maximum 30 km/h.",
        severity: "WARNING"
      };
    }
    return null;
  };

  const waitingInfo = getWaitingReason();

  return (
    <div className={`w-80 bg-[#080B09]/95 backdrop-blur-xl border border-[#1B241E] rounded-xl p-4 flex flex-col gap-3 font-sans select-none shadow-2xl text-[#E2E8E4] ${className}`}>
      {/* Header with train name and close button */}
      <div className="flex items-start justify-between border-b border-[#1B241E] pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-black border ${prio.color}`}>
              {prio.label}
            </span>
            <span className="font-mono text-xs font-bold text-[#8C9A8E]">#{train.train_number}</span>
          </div>
          <h3 className="font-display font-black text-sm text-[#E2E8E4] mt-1 leading-snug">
            {train.train_name}
          </h3>
          <span className="text-[10px] font-mono text-[#6A7A6E]">
            {train.origin} ➔ {train.destination} ({train.direction} Line)
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md bg-[#121714] hover:bg-[#1A221D] text-[#8C9A8E] hover:text-[#E2E8E4] transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Speed & Acceleration Telemetry Metrics */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-[#0F1411] border border-[#1E2822] rounded-lg p-2 flex flex-col items-center">
          <span className="text-[9px] font-mono text-[#6A7A6E] uppercase">SPEED</span>
          <span className="font-mono text-base font-black text-[#00E5FF]">
            {Math.round(train.current_speed_kmh)}
            <span className="text-[9px] text-[#6A7A6E] font-normal"> km/h</span>
          </span>
          <span className="text-[8.5px] font-mono text-[#8C9A8E]">Max {train.max_speed_kmh}</span>
        </div>

        <div className="bg-[#0F1411] border border-[#1E2822] rounded-lg p-2 flex flex-col items-center">
          <span className="text-[9px] font-mono text-[#6A7A6E] uppercase">STATUS</span>
          <span className={`font-mono text-xs font-black mt-1 ${
            train.status === "RUNNING" ? "text-[#2E7D32]" : "text-[#FF8C1A]"
          }`}>
            {train.is_dwelling ? "DWELLING" : train.status}
          </span>
          <span className="text-[8.5px] font-mono text-[#6A7A6E]">
            {(train.current_accel_ms2 || 0) >= 0 ? `+${(train.current_accel_ms2 || 0).toFixed(2)}` : (train.current_accel_ms2 || 0).toFixed(2)} m/s²
          </span>
        </div>

        <div className="bg-[#0F1411] border border-[#1E2822] rounded-lg p-2 flex flex-col items-center">
          <span className="text-[9px] font-mono text-[#6A7A6E] uppercase">DELAY</span>
          <span className={`font-mono text-base font-black ${
            isDelayed ? "text-[#FF8C1A]" : "text-[#2E7D32]"
          }`}>
            {isDelayed ? `+${delayMin.toFixed(1)}m` : "ON-TIME"}
          </span>
          <span className="text-[8.5px] font-mono text-[#6A7A6E]">Adherence</span>
        </div>
      </div>

      {/* Block and Physical Track Section Info */}
      <div className="bg-[#0D120F] border border-[#1B241E] rounded-lg p-2.5 text-xs space-y-1.5 font-mono">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#6A7A6E]">Current Block:</span>
          <span className="font-bold text-[#E2E8E4]">{train.current_block_id || "TRANSIT"}</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#6A7A6E]">Corridor Position:</span>
          <span className="font-bold text-[#00E5FF]">KM {train.current_position_km.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#6A7A6E]">Signal Ahead:</span>
          <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
            forwardSignalAspect === "RED" ? "bg-[#D62828]/20 text-[#D62828]" : forwardSignalAspect === "YELLOW" ? "bg-[#E5A93C]/20 text-[#E5A93C]" : "bg-[#2E7D32]/20 text-[#2E7D32]"
          }`}>
            {forwardSignalAspect}
          </span>
        </div>
      </div>

      {/* "Why is this train waiting?" Causal Diagnostic Breakdown */}
      {waitingInfo && (
        <div className={`p-2.5 rounded-lg border text-xs font-mono flex flex-col gap-1 ${
          waitingInfo.severity === "CRITICAL"
            ? "bg-[#22100E] border-[#D62828]/50 text-[#FFA4A4]"
            : "bg-[#20170A] border-[#FF8C1A]/50 text-[#FFD4A4]"
        }`}>
          <div className="flex items-center gap-1.5 font-bold text-[11px]">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>DIAGNOSTIC: {waitingInfo.title}</span>
          </div>
          <p className="text-[10px] leading-relaxed text-[#D0DAD2]">
            {waitingInfo.reason}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        {onFollowTrain && (
          <button
            onClick={() => onFollowTrain(train)}
            className="flex-1 py-1.5 px-3 rounded-lg bg-[#142018] hover:bg-[#1E3024] border border-[#2E7D32]/40 text-[#00E5FF] font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>FOLLOW TRAIN</span>
          </button>
        )}

        {onSimulateWhatIf && (
          <button
            onClick={() => onSimulateWhatIf(train)}
            className="py-1.5 px-3 rounded-lg bg-[#1B150D] hover:bg-[#281E13] border border-[#FF8C1A]/40 text-[#FF8C1A] font-mono text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Inject disruption on this train"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>WHAT-IF</span>
          </button>
        )}
      </div>
    </div>
  );
};
