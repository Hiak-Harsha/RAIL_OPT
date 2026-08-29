import React, { useEffect, useRef, useState } from "react";
import { Terminal, Cpu, AlertTriangle, ShieldCheck, Activity, Zap } from "lucide-react";

export interface TeleprinterLog {
  id: string;
  timestamp: string;
  type: "INFO" | "CANDIDATE" | "REJECTED" | "FEASIBLE" | "BEST" | "OPTIMAL" | "SAFETY_PASS" | "DECISION";
  message: string;
  meta?: Record<string, any>;
}

interface TrafficTeleprinterProps {
  logs?: TeleprinterLog[];
  activeRecommendation?: any;
  solverStatus?: "READY" | "RUNNING" | "OPTIMAL" | "FEASIBLE" | "INFEASIBLE";
  onOpenCounterfactual?: () => void;
  className?: string;
}

export const TrafficTeleprinter: React.FC<TrafficTeleprinterProps> = ({
  logs = [],
  activeRecommendation,
  solverStatus = "READY",
  onOpenCounterfactual,
  className = "h-[340px]"
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [typedLatestText, setTypedLatestText] = useState<string>("");
  const latestLogIdRef = useRef<string | null>(null);

  // Typewriter effect for the newest log entry
  useEffect(() => {
    if (logs.length === 0) return;
    const latestLog = logs[logs.length - 1];
    if (!latestLog) return;

    if (latestLogIdRef.current === latestLog.id) {
      return;
    }
    latestLogIdRef.current = latestLog.id;

    let charIdx = 0;
    const fullText = latestLog.message;
    setTypedLatestText("");

    const interval = setInterval(() => {
      charIdx += 2; // type 2 chars per tick for responsive speed
      if (charIdx >= fullText.length) {
        setTypedLatestText(fullText);
        clearInterval(interval);
      } else {
        setTypedLatestText(fullText.slice(0, charIdx));
      }
    }, 20);

    return () => clearInterval(interval);
  }, [logs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, typedLatestText]);

  const getLogBadge = (type: TeleprinterLog["type"]) => {
    switch (type) {
      case "BEST":
      case "OPTIMAL":
        return <span className="px-1.5 py-0.5 rounded bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40 font-bold">BEST OPTIMUM</span>;
      case "FEASIBLE":
        return <span className="px-1.5 py-0.5 rounded bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40 font-bold">FEASIBLE</span>;
      case "REJECTED":
        return <span className="px-1.5 py-0.5 rounded bg-[#FF1744]/20 text-[#FF1744] border border-[#FF1744]/40 font-bold">REJECTED</span>;
      case "CANDIDATE":
        return <span className="px-1.5 py-0.5 rounded bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40 font-bold">SEARCH</span>;
      case "SAFETY_PASS":
        return <span className="px-1.5 py-0.5 rounded bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40 font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> VERIFIED</span>;
      case "DECISION":
        return <span className="px-1.5 py-0.5 rounded bg-[#FFB300]/20 text-[#FFB300] border border-[#FFB300]/40 font-bold">DECISION</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded bg-[#1F2E3D] text-[#81909B] font-bold">TRACE</span>;
    }
  };

  const currentSolverName = activeRecommendation?.solver_name || "CP-SAT";
  const currentSolverStatus = activeRecommendation?.solver_status || solverStatus;
  const isRunning = currentSolverStatus === "RUNNING";
  const isOptimal = currentSolverStatus === "OPTIMAL";

  return (
    <div className={`bg-[#0A131D] border border-[#162434] rounded-xl shadow-2xl overflow-hidden flex flex-col ${className}`}>
      {/* Teleprinter Header */}
      <div className="bg-[#071018] border-b border-[#162434] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-[#00D4FF]" />
          <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-[#EAF2F7]">
            AI TRAFFIC TELEPRINTER & MATHEMATICAL SOLVER TRACE
          </h3>
        </div>

        {/* Solver Telemetry Status Strip */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border ${
            isRunning
              ? "bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/40 solver-status-running"
              : isOptimal
              ? "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/40 glow-signal-green"
              : "bg-[#050B11] text-[#CAD6E2] border-[#162434]"
          }`}>
            <Cpu className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : isOptimal ? "text-[#00E676]" : "text-[#81909B]"}`} />
            <span>{currentSolverName}: <strong>{currentSolverStatus}</strong></span>
          </div>

          {onOpenCounterfactual && activeRecommendation && (
            <button
              onClick={onOpenCounterfactual}
              className="text-[10px] font-mono font-bold text-[#00D4FF] hover:underline bg-[#00D4FF]/10 px-2 py-1 rounded border border-[#00D4FF]/30 transition-all flex items-center gap-1"
            >
              <Zap className="w-3 h-3" />
              COUNTERFACTUAL ➔
            </button>
          )}
        </div>
      </div>

      {/* Teleprinter CRT Log Stream */}
      <div
        ref={scrollRef}
        className="flex-1 p-4 teleprinter-scanlines overflow-y-auto space-y-2 font-mono text-xs select-text"
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#81909B] text-xs space-y-2 py-8">
            <Activity className="w-5 h-5 text-[#00D4FF] animate-pulse" />
            <div className="text-center font-mono">
              <div>AWAITING MATHEMATICAL SOLVER TRACE / SIMULATION DISRUPTION</div>
              <div className="text-[10px] text-[#4B5E71] mt-1">Live telemetry stream listening on /ws/live</div>
            </div>
          </div>
        ) : (
          logs.map((log, idx) => {
            const isLast = idx === logs.length - 1;
            const messageToShow = isLast && typedLatestText ? typedLatestText : log.message;

            return (
              <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                <span className="text-[#81909B] text-[10px] select-none shrink-0 mt-0.5">{log.timestamp}</span>
                <div className="shrink-0">{getLogBadge(log.type)}</div>
                <span className={`flex-1 ${
                  log.type === "BEST" || log.type === "OPTIMAL"
                    ? "text-[#00E676] font-bold"
                    : log.type === "REJECTED"
                    ? "text-[#FF4D4D]"
                    : "text-[#CAD6E2]"
                }`}>
                  {messageToShow}
                  {isLast && typedLatestText.length < log.message.length && (
                    <span className="teleprinter-cursor" />
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Active AI Recommendation Banner */}
      {activeRecommendation && (
        <div className="bg-[#050B11] border-t border-[#162434] px-5 py-2.5 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-[#FFB300]">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
            <span>
              PENDING ACTION: <strong>{activeRecommendation.action} TRAIN {activeRecommendation.primary_train_id}</strong>
              {activeRecommendation.duration_sec ? ` (DURATION: ${Math.round(activeRecommendation.duration_sec/60)}M)` : ""}
            </span>
          </div>
          <span className="text-[#00E676] font-bold">
            SAFETY VALIDATED: {activeRecommendation.safety_valid ? "PASSED" : "FAILED"}
          </span>
        </div>
      )}
    </div>
  );
};
