import React, { useState, useEffect, useCallback } from "react";
import { ReactiveRailField } from "./ReactiveRailField";
import { Magnetic } from "../../components/interaction/Magnetic";
import { usePointerPosition } from "../../interaction/InteractionProvider";
import { ShieldCheck, Terminal, Zap, ArrowRight, Radio } from "lucide-react";

interface ColdOpenProps {
  onComplete: () => void;
}

const BOOT_LOGS = [
  { time: 400, text: "INITIALIZING RAILOPT-X SPATIAL TWIN KERNEL..." },
  { time: 900, text: "NDLS–CNB 435 KM CORRIDOR TOPOLOGY LOADED (59 GRANULAR BLOCKS)" },
  { time: 1400, text: "4-ASPECT AUTOMATIC SIGNAL INTERLOCKING & HEADWAY GATES ACTIVE" },
  { time: 1900, text: "OR-TOOLS CP-SAT SCHEDULER & CSP FALLBACK READY" },
  { time: 2400, text: "CLOSED-LOOP PHYSICAL SAFETY INVARIANTS ARMED" },
  { time: 2900, text: "ALL OCC SYSTEMS SYNCHRONIZED — READY FOR DISPATCH" },
];

export const ColdOpen: React.FC<ColdOpenProps> = ({ onComplete }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const { pointerRef, reducedMotion } = usePointerPosition();
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Keyboard shortcut listener (Enter / Space / Escape immediately bypasses intro)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSkip]);

  // Custom cursor positioning on cold open
  useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => {
      const p = pointerRef.current;
      if (p.isActive) {
        setCursorPos({ x: p.x, y: p.y });
      }
    }, 16);
    return () => clearInterval(interval);
  }, [pointerRef, reducedMotion]);

  // Sequential boot logs
  useEffect(() => {
    BOOT_LOGS.forEach((item) => {
      const timer = setTimeout(() => {
        setLogs((prev) => [...prev, item.text]);
      }, item.time);
      return () => clearTimeout(timer);
    });

    const progInterval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(progInterval);
          setIsReady(true);
          return 100;
        }
        return p + 4;
      });
    }, 100);

    return () => clearInterval(progInterval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#060806] text-[#E4E8E4] flex flex-col justify-between p-8 select-none overflow-hidden font-mono cursor-crosshair">
      {/* Background Interactive Spatial Rail Field */}
      <ReactiveRailField />

      {/* Custom Crosshair Cursor */}
      {!reducedMotion && cursorPos.x >= 0 && (
        <div
          className="pointer-events-none fixed z-50 transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
          style={{ left: cursorPos.x, top: cursorPos.y }}
        >
          <div className="w-8 h-8 rounded-full border border-[#FF8C1A]/60 flex items-center justify-center animate-pulse">
            <div className="w-1.5 h-1.5 rounded-full bg-[#3E9142]" />
          </div>
          <div className="absolute top-1/2 left-0 w-8 h-[1px] bg-[#FF8C1A]/40 -translate-y-1/2 -translate-x-full" />
          <div className="absolute top-1/2 right-0 w-8 h-[1px] bg-[#FF8C1A]/40 -translate-y-1/2 translate-x-full" />
          <div className="absolute top-0 left-1/2 w-[1px] h-8 bg-[#FF8C1A]/40 -translate-x-1/2 -translate-y-full" />
          <div className="absolute bottom-0 left-1/2 w-[1px] h-8 bg-[#FF8C1A]/40 -translate-x-1/2 translate-y-full" />
        </div>
      )}

      {/* Top Header Bar */}
      <div className="relative z-10 flex items-center justify-between border-b border-[#1F2822] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#FF8C1A]/10 border border-[#FF8C1A]/30 text-[#FF8C1A]">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest text-[#E4E8E4]">
              RAILOPT-X // OCC INTELLIGENCE SUITE
            </h1>
            <div className="text-[10px] text-[#8C9A8E]">
              INDIAN RAILWAYS SMART AUTOMATED DISPATCH & TRAFFIC OPTIMIZER
            </div>
          </div>
        </div>

        <button
          onClick={handleSkip}
          className="px-3 py-1.5 text-xs text-[#8C9A8E] hover:text-[#FF8C1A] hover:border-[#FF8C1A] rounded border border-[#1F2822] transition-all flex items-center gap-1.5"
        >
          <span>SKIP [ENTER]</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center Console Terminal View */}
      <div className="relative z-10 max-w-2xl mx-auto w-full my-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF8C1A]/10 border border-[#FF8C1A]/30 text-[#FF8C1A] text-xs font-bold">
            <Zap className="w-3.5 h-3.5" />
            HIGH-DENSITY CORRIDOR DIGITAL TWIN
          </div>
          <h2 className="text-3xl font-black text-[#E4E8E4] tracking-tight">
            NDLS–CNB SECTION REAL-TIME CTC
          </h2>
          <p className="text-xs text-[#8C9A8E] max-w-lg mx-auto">
            Discrete-event physics simulation with continuous spatial investigation, closed-loop safety invariants, and mathematical optimization.
          </p>
        </div>

        {/* Boot Telemetry Box */}
        <div className="bg-[#0B0F0C]/90 border border-[#1F2822] rounded-xl p-5 shadow-2xl backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between text-xs text-[#8C9A8E] border-b border-[#1F2822] pb-2">
            <span className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[#FF8C1A]" />
              SYSTEM INITIALIZATION LOG
            </span>
            <span className="font-mono text-[#3E9142]">{progress}%</span>
          </div>

          <div className="space-y-1.5 min-h-[140px] text-[11px] font-mono">
            {logs.map((log, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[#E4E8E4]">
                <span className="text-[#3E9142]">✓</span>
                <span className="text-[#8C9A8E]">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-[#FF8C1A]">{log}</span>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#121713] h-1.5 rounded-full overflow-hidden border border-[#1F2822]">
            <div
              className="h-full bg-gradient-to-r from-[#FF8C1A] via-[#E5A93C] to-[#3E9142] transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center pt-2">
          <Magnetic tier="strong">
            <button
              onClick={handleSkip}
              className="px-8 py-3.5 rounded-lg font-black text-sm tracking-wider uppercase transition-all shadow-xl flex items-center gap-2.5 mx-auto bg-[#FF8C1A] hover:bg-[#FFA33E] text-[#060806] hover:shadow-[0_0_25px_rgba(255,140,26,0.4)]"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>ENTER OPERATIONS CONTROL CENTER</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </Magnetic>
        </div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 flex items-center justify-between text-[10px] text-[#4C5750] border-t border-[#1F2822] pt-4">
        <div className="flex items-center gap-4">
          <span>CORRIDOR: 435.0 KM CONTINUOUS CTC</span>
          <span>SOLVER: OR-TOOLS CP-SAT + RESILIENT CSP</span>
          <span>HEADWAY: 180s ABSOLUTE MINIMUM</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isReady ? "bg-[#3E9142] animate-ping" : "bg-[#E5A93C] animate-pulse"}`} />
          <span className="text-[#8C9A8E]">{isReady ? "TELEMETRY BUS SYNCHRONIZED" : "INITIALIZING TELEMETRY..."}</span>
        </div>
      </div>
    </div>
  );
};
