import React from "react";
import { Play, Pause, RotateCcw, Navigation, AlertTriangle, Flag, Zap, Clock, Eye } from "lucide-react";

export type CameraViewMode = "OVERVIEW" | "FOLLOW_TRAIN" | "CONFLICT_FOCUS" | "INFRASTRUCTURE";

interface SimulationCockpitProps {
  isRunning: boolean;
  timeScale: number;
  viewMode: CameraViewMode;
  onTogglePlay: () => void;
  onReset: () => void;
  onScaleChange: (scale: number) => void;
  onSelectViewMode: (mode: CameraViewMode) => void;
  onJumpToDeparture: () => void;
  onJumpToSignalChange: () => void;
  onJumpToConflict: () => void;
  onJumpToRecommendation: () => void;
  className?: string;
}

export const SimulationCockpit: React.FC<SimulationCockpitProps> = ({
  isRunning,
  timeScale,
  viewMode,
  onTogglePlay,
  onReset,
  onScaleChange,
  onSelectViewMode,
  onJumpToDeparture,
  onJumpToSignalChange,
  onJumpToConflict,
  onJumpToRecommendation,
  className = ""
}) => {
  return (
    <div className={`w-full bg-[#080B09] border border-[#1B241E] rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-3 select-none shadow-xl ${className}`}>
      {/* 1. Core Transport Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onTogglePlay}
          className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
            isRunning
              ? "bg-[#16221A] text-[#2E7D32] hover:bg-[#1C2C21] border border-[#2E7D32]/40"
              : "bg-[#2A1D0E] text-[#FF8C1A] hover:bg-[#382613] border border-[#FF8C1A]/40"
          }`}
          title={isRunning ? "Pause Simulation" : "Resume Simulation"}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5 text-[#2E7D32]" /> : <Play className="w-3.5 h-3.5 text-[#FF8C1A]" />}
          <span>{isRunning ? "RUNNING" : "PAUSED"}</span>
        </button>

        <button
          onClick={onReset}
          className="p-1.5 rounded-lg bg-[#0F1411] hover:bg-[#1A221D] border border-[#1E2822] text-[#8C9A8E] hover:text-[#E2E8E4] transition-all"
          title="Reset Simulation State"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Speed Scale Selector */}
        <div className="flex items-center bg-[#0F1411] border border-[#1E2822] rounded-lg p-0.5">
          {[1, 2, 5, 10].map((scale) => (
            <button
              key={scale}
              onClick={() => onScaleChange(scale)}
              className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md transition-all ${
                timeScale === scale
                  ? "bg-[#FF8C1A] text-[#080B09] shadow-sm"
                  : "text-[#8C9A8E] hover:text-[#E2E8E4]"
              }`}
            >
              {scale}×
            </button>
          ))}
        </div>
      </div>

      {/* 2. Camera Viewport Selector */}
      <div className="flex items-center gap-1 bg-[#0F1411] border border-[#1E2822] rounded-lg p-0.5">
        {(
          [
            { id: "OVERVIEW", label: "CORRIDOR", icon: Eye },
            { id: "FOLLOW_TRAIN", label: "FOLLOW", icon: Navigation },
            { id: "CONFLICT_FOCUS", label: "CONFLICT", icon: AlertTriangle },
            { id: "INFRASTRUCTURE", label: "STATIONS", icon: Zap },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onSelectViewMode(id)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all ${
              viewMode === id
                ? "bg-[#1E2C22] text-[#00E5FF] border border-[#00E5FF]/40 shadow-sm"
                : "text-[#7A8A7C] hover:text-[#C5D0C7]"
            }`}
          >
            <Icon className="w-3 h-3" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* 3. Event-Driven Jump Shortcuts */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9.5px] font-mono text-[#5A6A5C] uppercase tracking-wider hidden xl:inline">JUMP:</span>
        <button
          onClick={onJumpToDeparture}
          className="px-2 py-1 rounded-md bg-[#0F1411] hover:bg-[#162019] border border-[#1E2822] text-[#8C9A8E] hover:text-[#00E5FF] text-[10px] font-mono flex items-center gap-1 transition-all"
          title="Jump to next train departure"
        >
          <Flag className="w-2.5 h-2.5 text-[#00E5FF]" />
          <span>DEPARTURE</span>
        </button>

        <button
          onClick={onJumpToSignalChange}
          className="px-2 py-1 rounded-md bg-[#0F1411] hover:bg-[#162019] border border-[#1E2822] text-[#8C9A8E] hover:text-[#E5A93C] text-[10px] font-mono flex items-center gap-1 transition-all"
          title="Advance to next signal aspect change"
        >
          <Zap className="w-2.5 h-2.5 text-[#E5A93C]" />
          <span>SIGNAL</span>
        </button>

        <button
          onClick={onJumpToConflict}
          className="px-2 py-1 rounded-md bg-[#1C1210] hover:bg-[#281916] border border-[#D62828]/40 text-[#D62828] text-[10px] font-mono font-bold flex items-center gap-1 transition-all animate-pulse"
          title="Advance to active/predicted conflict"
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          <span>CONFLICT</span>
        </button>

        <button
          onClick={onJumpToRecommendation}
          className="px-2 py-1 rounded-md bg-[#1D170D] hover:bg-[#2A2012] border border-[#FF8C1A]/40 text-[#FF8C1A] text-[10px] font-mono font-bold flex items-center gap-1 transition-all"
          title="Advance to next AI recommendation"
        >
          <Clock className="w-2.5 h-2.5" />
          <span>RECOMMENDATION</span>
        </button>
      </div>
    </div>
  );
};
