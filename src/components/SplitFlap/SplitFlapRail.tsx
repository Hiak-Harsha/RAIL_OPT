import React from "react";
import type { OperationalKPIs } from "../../types/railway";
import { SplitFlapDisplay } from "./SplitFlapDisplay";
import { Play, Pause, RotateCcw, ShieldCheck, Zap, Activity } from "lucide-react";

interface SplitFlapRailProps {
  kpis: OperationalKPIs | null;
  safetyInvariants?: { checked: number; passed: number; failed: number; percentage: number } | null;
  simTimeFormatted: string;
  isRunning: boolean;
  timeScale: number;
  onTogglePlay: () => void;
  onScaleChange: (scale: number) => void;
  onReset: () => void;
  canControlSimulation?: boolean;
  controlStatus?: string | null;
}

export const SplitFlapRail: React.FC<SplitFlapRailProps> = ({
  kpis,
  safetyInvariants,
  simTimeFormatted,
  isRunning,
  timeScale,
  onTogglePlay,
  onScaleChange,
  onReset,
  canControlSimulation = true,
  controlStatus
}) => {
  return (
    <header className="bg-[#121513] border-b border-[#232A25] px-6 py-3 shadow-2xl relative z-30">
      <div className="flex flex-wrap items-center justify-between gap-6">
        
        {/* Left: Clock & Simulation Master Speed Controls */}
        <div className="flex items-center gap-4">
          <div className="bg-[#0B0D0A] px-3.5 py-2 rounded-lg border border-[#232A25] flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? "bg-[#3E9142] animate-pulse" : "bg-[#FF8C1A]"}`} />
            <div>
              <div className="text-[9px] uppercase font-bold text-[#8C9A8E] tracking-wider font-mono">OCC MASTER CLOCK</div>
              <div className="font-mono text-lg font-bold text-[#FF8C1A] tracking-widest">{simTimeFormatted || "00:00:00"}</div>
            </div>
          </div>

          {controlStatus && (
            <div className="px-3 py-1.5 rounded-lg bg-[#FF8C1A]/10 border border-[#FF8C1A]/40 text-[#FF8C1A] text-xs font-mono font-bold animate-pulse flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              {controlStatus}
            </div>
          )}

          <div className={`flex items-center gap-1.5 bg-[#0B0D0A] p-1.5 rounded-lg border border-[#232A25] ${!canControlSimulation ? "opacity-40 pointer-events-none" : ""}`}
               title={!canControlSimulation ? "Supervisor or Controller role required" : undefined}>
            <button
              onClick={onTogglePlay}
              disabled={!canControlSimulation}
              className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
                isRunning
                  ? "bg-[#FF8C1A]/20 text-[#FF8C1A] border border-[#FF8C1A]/50 hover:bg-[#FF8C1A]/30"
                  : "bg-[#3E9142]/20 text-[#3E9142] border border-[#3E9142]/50 hover:bg-[#3E9142]/30"
              }`}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isRunning ? "PAUSE" : "RESUME"}
            </button>

            <div className="flex items-center gap-1 px-1">
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => onScaleChange(s)}
                  disabled={!canControlSimulation}
                  className={`px-2 py-1 text-[11px] font-mono font-bold rounded transition-colors ${
                    timeScale === s
                      ? "bg-[#FF8C1A] text-[#0B0D0A]"
                      : "text-[#8C9A8E] hover:text-[#E2E8E4]"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <button
              onClick={onReset}
              disabled={!canControlSimulation}
              className="p-1.5 text-[#8C9A8E] hover:text-[#D62828] hover:bg-[#D62828]/10 rounded-md transition-colors"
              title={!canControlSimulation ? "Supervisor or Controller role required" : "Reset Simulation to Initial State"}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Master Split-Flap Mechanical Display Tile Rail */}
        <div className="flex flex-wrap items-center gap-4">
          <SplitFlapDisplay
            label="Section Clearances"
            value={kpis && kpis.section_clearances_per_hr !== undefined ? kpis.section_clearances_per_hr.toFixed(1) : "0.0"}
            unit="clr/hr"
            digitCount={4}
            variant="cyan"
          />

          <div className="h-8 w-[1px] bg-[#232A25]" />

          <SplitFlapDisplay
            label="End-to-End Throughput"
            value={kpis ? kpis.throughput_trains_per_hr.toFixed(1) : "0.0"}
            unit="tr/hr"
            digitCount={4}
            variant="amber"
          />

          <div className="h-8 w-[1px] bg-[#232A25]" />

          <SplitFlapDisplay
            label="Avg Section Delay"
            value={kpis ? kpis.average_delay_minutes.toFixed(1) : "—"}
            unit="min"
            digitCount={4}
            variant="amber"
          />

          <div className="h-8 w-[1px] bg-[#232A25]" />

          <SplitFlapDisplay
            label="Section Punctuality"
            value={kpis ? kpis.punctuality_otp_pct.toFixed(1) : "—"}
            unit="OTP %"
            digitCount={5}
            variant="green"
          />

          <div className="h-8 w-[1px] bg-[#232A25]" />

          <SplitFlapDisplay
            label="Track Utilization"
            value={kpis ? kpis.track_utilization_pct.toFixed(1) : "—"}
            unit="%"
            digitCount={4}
            variant="default"
          />

          <div className="h-8 w-[1px] bg-[#232A25]" />

          <SplitFlapDisplay
            label="Active Conflicts"
            value={kpis ? kpis.active_conflicts_predicted : "0"}
            unit="active"
            digitCount={2}
            variant={kpis && kpis.active_conflicts_predicted > 0 ? "red" : "green"}
          />

          <div className="h-8 w-[1px] bg-[#232A25]" />

          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[#8C9A8E] tracking-wider uppercase mb-1 flex items-center gap-1 font-mono">
              <ShieldCheck className="w-3 h-3 text-[#3E9142]" />
              SAFETY INVARIANTS
            </span>
            <div className="flex items-center gap-1.5 bg-[#0B0D0A] px-2.5 py-1 rounded border border-[#3E9142]/30">
              <Activity className="w-3 h-3 text-[#3E9142]" />
              <span className="font-mono text-xs font-bold text-[#3E9142]">
                {safetyInvariants
                  ? `${safetyInvariants.passed}/${safetyInvariants.checked} PASSED (${safetyInvariants.percentage.toFixed(0)}%)`
                  : (kpis ? "INVARIANTS ACTIVE" : "—")}
              </span>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};
