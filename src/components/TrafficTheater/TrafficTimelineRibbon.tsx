import React from "react";
import { Clock, AlertTriangle, ArrowRight, ShieldCheck, Flag, Zap, Loader2, CheckCircle2 } from "lucide-react";

export interface TimelineMilestone {
  id: string;
  timeSec: number;
  label: string;
  type: "DEPARTURE" | "SIGNAL_CHANGE" | "CONFLICT_PREDICTED" | "RECOMMENDATION" | "APPROVAL" | "ARRIVAL";
  details?: string;
}

interface TrafficTimelineRibbonProps {
  currentSimTimeSec: number;
  totalHorizonSec?: number;
  milestones?: TimelineMilestone[];
  seekingStatus?: "IDLE" | "SEEKING" | "COMPLETE";
  onSeek: (timeSec: number) => void;
  className?: string;
}

export const TrafficTimelineRibbon: React.FC<TrafficTimelineRibbonProps> = ({
  currentSimTimeSec,
  totalHorizonSec = 1200,
  milestones = [],
  seekingStatus = "IDLE",
  onSeek,
  className = ""
}) => {
  const currentRatio = Math.min(1.0, Math.max(0.0, currentSimTimeSec / totalHorizonSec));

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getMilestoneIcon = (type: TimelineMilestone["type"]) => {
    switch (type) {
      case "DEPARTURE": return <Flag className="w-3 h-3 text-[#00E5FF]" />;
      case "SIGNAL_CHANGE": return <Zap className="w-3 h-3 text-[#E5A93C]" />;
      case "CONFLICT_PREDICTED": return <AlertTriangle className="w-3 h-3 text-[#D62828]" />;
      case "RECOMMENDATION": return <Clock className="w-3 h-3 text-[#FF8C1A]" />;
      case "APPROVAL": return <ShieldCheck className="w-3 h-3 text-[#2E7D32]" />;
      case "ARRIVAL": return <ArrowRight className="w-3 h-3 text-[#00E676]" />;
    }
  };

  return (
    <div className={`w-full bg-[#0A0D0B] border border-[#1B241E] rounded-xl px-4 py-2.5 flex flex-col gap-2 select-none shadow-lg ${className}`}>
      {/* Top Header info */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FF8C1A] animate-pulse" />
          <span className="font-mono font-bold tracking-wider text-[#E2E8E4] uppercase">
            OPERATIONAL TIMELINE RIBBON
          </span>
          {seekingStatus === "SEEKING" && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#00E5FF] bg-[#00E5FF]/10 px-2 py-0.5 rounded border border-[#00E5FF]/30 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" /> SEEKING...
            </span>
          )}
          {seekingStatus === "COMPLETE" && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#00E676] bg-[#00E676]/10 px-2 py-0.5 rounded border border-[#00E676]/30">
              <CheckCircle2 className="w-3 h-3" /> SEEK COMPLETE
            </span>
          )}
        </div>
        <div className="font-mono text-[11px] text-[#8C9A8E] flex items-center gap-3">
          <span>NOW: <strong className="text-[#00E5FF] font-black">{formatSec(currentSimTimeSec)}</strong></span>
          <span>HORIZON: <strong>{formatSec(totalHorizonSec)}</strong></span>
        </div>
      </div>

      {/* Scrubbable Track Timeline Bar */}
      <div
        className="relative w-full h-5 bg-[#121714] rounded-md border border-[#232E27] cursor-pointer group flex items-center"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, clickX / rect.width));
          onSeek(ratio * totalHorizonSec);
        }}
      >
        {/* Traversed Time Progress Fill */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-[#00E5FF]/20 via-[#FF8C1A]/25 to-[#2E7D32]/35 rounded-l-md pointer-events-none transition-all duration-150"
          style={{ width: `${currentRatio * 100}%` }}
        />

        {/* Milestone Event Nodes along the timeline */}
        {milestones.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-[#4A5D4F] pointer-events-none">
            OBSERVING EVENT STREAM — CLICK ANYWHERE TO SEEK SIMULATION
          </div>
        ) : (
          milestones.map((m) => {
            const posRatio = Math.min(1, Math.max(0, m.timeSec / totalHorizonSec));
            const isPassed = currentSimTimeSec >= m.timeSec;

            return (
              <div
                key={m.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(m.timeSec);
                }}
                style={{ left: `${posRatio * 100}%` }}
                className={`absolute -translate-x-1/2 flex flex-col items-center group/node cursor-pointer z-10 transition-transform hover:scale-125 ${
                  isPassed ? "opacity-90" : "opacity-60 hover:opacity-100"
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border shadow-md transition-all ${
                    m.type === "CONFLICT_PREDICTED"
                      ? "bg-[#D62828] border-[#FFA8A8] ring-2 ring-[#D62828]/40"
                      : m.type === "RECOMMENDATION"
                      ? "bg-[#FF8C1A] border-[#FFD8A8]"
                      : m.type === "APPROVAL"
                      ? "bg-[#2E7D32] border-[#A3E635]"
                      : "bg-[#1E2822] border-[#3E4E42]"
                  }`}
                >
                  {getMilestoneIcon(m.type)}
                </div>

                {/* Milestone Tooltip Hover popup */}
                <div className="absolute bottom-6 opacity-0 group-hover/node:opacity-100 transition-opacity bg-[#080B09]/95 border border-[#232E27] rounded-lg px-2.5 py-1 text-[10px] font-mono pointer-events-none whitespace-nowrap shadow-xl z-30 flex flex-col gap-0.5">
                  <div className="font-bold text-[#E2E8E4] flex items-center gap-1.5">
                    <span>{formatSec(m.timeSec)}</span>
                    <span className="text-[#00E5FF]">•</span>
                    <span>{m.label}</span>
                  </div>
                  {m.details && <div className="text-[#8C9A8E] text-[9px]">{m.details}</div>}
                </div>
              </div>
            );
          })
        )}

        {/* Current Time Needle Indicator */}
        <div
          style={{ left: `${currentRatio * 100}%` }}
          className="absolute -top-1 -bottom-1 w-1 bg-[#00E5FF] rounded shadow-[0_0_8px_#00E5FF] pointer-events-none z-20 transition-all duration-100"
        >
          <div className="w-2.5 h-2.5 bg-[#00E5FF] rotate-45 -translate-x-[3px] -translate-y-1 shadow-sm" />
        </div>
      </div>
    </div>
  );
};
