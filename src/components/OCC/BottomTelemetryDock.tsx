import React from "react";
import type { OperationalKPIs, Recommendation } from "../../types/railway";
import { SplitFlapRail } from "../SplitFlap/SplitFlapRail";
import { TrafficTeleprinter } from "../Teleprinter/TrafficTeleprinter";
import type { TeleprinterLog } from "../Teleprinter/TrafficTeleprinter";

interface BottomTelemetryDockProps {
  kpis: OperationalKPIs | null;
  safetyInvariants?: { checked: number; passed: number; failed: number; percentage: number } | null;
  simTimeFormatted: string;
  isRunning: boolean;
  timeScale: number;
  onTogglePlay: () => void;
  onScaleChange: (scale: number) => void;
  onReset: () => void;
  canControlSimulation: boolean;
  controlStatus: string | null;
  teleprinterLogs: TeleprinterLog[];
  activeRecommendation: Recommendation | null;
  onOpenCounterfactual: () => void;
  events: any[];
  onEventClick: (event: any) => void;
}

export const BottomTelemetryDock: React.FC<BottomTelemetryDockProps> = ({
  kpis,
  safetyInvariants,
  simTimeFormatted,
  isRunning,
  timeScale,
  onTogglePlay,
  onScaleChange,
  onReset,
  canControlSimulation,
  controlStatus,
  teleprinterLogs,
  activeRecommendation,
  onOpenCounterfactual,
  events,
  onEventClick
}) => {
  return (
    <div className="space-y-4">
      {/* 1. Mechanical Split-Flap KPI Telemetry Rail */}
      <SplitFlapRail
        kpis={kpis}
        safetyInvariants={safetyInvariants}
        simTimeFormatted={simTimeFormatted}
        isRunning={isRunning}
        timeScale={timeScale}
        onTogglePlay={onTogglePlay}
        onScaleChange={onScaleChange}
        onReset={onReset}
        canControlSimulation={canControlSimulation}
        controlStatus={controlStatus}
      />

      {/* 2. Side-by-Side: AI Traffic Teleprinter & Live Section Event Bus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrafficTeleprinter
          logs={teleprinterLogs}
          activeRecommendation={activeRecommendation}
          onOpenCounterfactual={onOpenCounterfactual}
        />

        <div className="bg-[#0A131D] border border-[#162434] rounded-xl p-4 shadow-2xl flex flex-col h-[340px]">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#162434]">
            <h4 className="text-xs font-bold text-[#81909B] uppercase tracking-wider flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
              Live Section Event Bus (Click to Locate)
            </h4>
            <span className="text-[10px] text-[#00D4FF] font-mono">CLICK STREAM EVENT</span>
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto font-mono text-xs text-[#81909B] pr-1">
            {events.length === 0 ? (
              <div className="text-[11px] py-4 text-[#81909B] text-center">
                Monitoring live sectional track transitions & solver dispatches...
              </div>
            ) : (
              events.slice(0, 20).map((ev, i) => (
                <div
                  key={i}
                  onClick={() => onEventClick(ev)}
                  className="flex items-center gap-3 py-1 px-2 rounded hover:bg-[#13202E] cursor-pointer transition-colors border-b border-[#162434]/40"
                >
                  <span className="text-[#00D4FF] text-[10px] shrink-0 font-bold">{ev.sim_time_sec}s</span>
                  <span className="text-[#EAF2F7] font-bold shrink-0 text-[11px]">{ev.event_type}</span>
                  <span className="text-[#CAD6E2] truncate text-[11px] font-sans">
                    {ev.event_type === "RECOMMENDATION_CREATED"
                      ? `HOLD ${ev.payload?.primary_train_id} at ${ev.payload?.target_block_id}`
                      : ev.event_type === "DECISION_APPROVED"
                      ? `Approved action for ${ev.payload?.train_id}`
                      : ev.event_type === "DISRUPTION_INJECTED"
                      ? `Disruption injected on ${ev.payload?.target_id}`
                      : JSON.stringify(ev.payload || {})}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. System Build Stamp & Deployment Identity Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#070C0A] border border-[#1E2B23] rounded-lg text-[10px] font-mono text-[#8C9A8E]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
          <span>RAILOPT-X 2.0 DIGITAL TWIN STUDIO</span>
          <span className="text-[#3E4D43]">|</span>
          <span className="text-[#E2E8E4]">BUILD: 2026.08.26-1930-v2.0</span>
        </div>
        <div className="flex items-center gap-3">
          <span>PIPELINE: CP-SAT ➔ SIMULATION ➔ XAI ➔ AUDIT</span>
          <span className="text-[#3E4D43]">|</span>
          <span className="text-[#22C55E]">STATUS: ACTIVE VERIFIED</span>
        </div>
      </div>
    </div>
  );
};
