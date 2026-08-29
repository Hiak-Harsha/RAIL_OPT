/**
 * RAILOPT-X 2.0 — First-Run Landing Choice Modal
 * 
 * Offers the user an immediate, discoverable choice between:
 * 1. Watching the 75-second problem-story cinematic replay
 * 2. Entering the live digital twin operations control center immediately
 */

import React, { useState } from "react";
import { ShieldCheck, Sparkles, MonitorPlay } from "lucide-react";

interface WelcomeChoiceModalProps {
  isOpen: boolean;
  onSelectCinematic: () => void;
  onSelectOCC: () => void;
}

export const WelcomeChoiceModal: React.FC<WelcomeChoiceModalProps> = ({
  isOpen,
  onSelectCinematic,
  onSelectOCC,
}) => {
  const [rememberChoice, setRememberChoice] = useState(true);

  if (!isOpen) return null;

  const handleChoice = (choice: "cinematic" | "occ") => {
    if (rememberChoice) {
      localStorage.setItem("railopt_preferred_landing", choice);
      localStorage.setItem("railopt_first_run_completed", "true");
    }
    if (choice === "cinematic") {
      onSelectCinematic();
    } else {
      onSelectOCC();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-xl rounded-2xl border border-[#1F2E3D] bg-[#071018] p-6 shadow-2xl space-y-6">
        {/* Header Ribbon */}
        <div className="flex items-center gap-3 border-b border-[#162434] pb-4">
          <div className="p-2.5 rounded-xl bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-mono font-black tracking-wide text-[#EAF2F7]">
                RAILOPT-X 2.0
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#00D4FF]/20 text-[#00D4FF] font-bold font-mono border border-[#00D4FF]/40">
                SIH PS-25022
              </span>
            </div>
            <p className="text-xs text-[#81909B] font-mono mt-0.5">
              Explainable Railway Digital Twin & AI Dispatch Controller
            </p>
          </div>
        </div>

        {/* Introduction */}
        <p className="text-xs text-[#CAD6E2] font-sans leading-relaxed">
          Welcome to the high-density NDLS–CNB corridor digital twin. How would you like to begin your session?
        </p>

        {/* Choice Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Option 1: Problem Story */}
          <button
            onClick={() => handleChoice("cinematic")}
            className="group relative flex flex-col justify-between p-4 rounded-xl border border-[#1F2E3D] bg-[#0B1520] hover:bg-[#101D2C] hover:border-[#00D4FF]/60 transition-all text-left space-y-3 cursor-pointer shadow-lg hover:shadow-[0_0_20px_rgba(0,212,255,0.2)]"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-[#FF8C1A]/10 text-[#FF8C1A] border border-[#FF8C1A]/30 group-hover:scale-110 transition-transform">
                <MonitorPlay className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold text-[#FF8C1A] bg-[#FF8C1A]/10 px-2 py-0.5 rounded">
                75 SECONDS
              </span>
            </div>
            <div>
              <h3 className="text-sm font-mono font-bold text-[#EAF2F7] group-hover:text-[#00D4FF] transition-colors">
                Watch Problem Story
              </h3>
              <p className="text-[11px] text-[#81909B] mt-1 leading-snug">
                6-beat cinematic journey through corridor congestion, conflict radar, and AI resolution.
              </p>
            </div>
          </button>

          {/* Option 2: Live Operations */}
          <button
            onClick={() => handleChoice("occ")}
            className="group relative flex flex-col justify-between p-4 rounded-xl border border-[#1F2E3D] bg-[#0B1520] hover:bg-[#101D2C] hover:border-[#00E676]/60 transition-all text-left space-y-3 cursor-pointer shadow-lg hover:shadow-[0_0_20px_rgba(0,230,118,0.2)]"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold text-[#00E676] bg-[#00E676]/10 px-2 py-0.5 rounded">
                LIVE TWIN
              </span>
            </div>
            <div>
              <h3 className="text-sm font-mono font-bold text-[#EAF2F7] group-hover:text-[#00E676] transition-colors">
                Enter Live Operations
              </h3>
              <p className="text-[11px] text-[#81909B] mt-1 leading-snug">
                Direct access to the real-time OCC digital twin, 3D rolling stock, and solver controls.
              </p>
            </div>
          </button>
        </div>

        {/* Footer with Remember Option */}
        <div className="flex items-center justify-between border-t border-[#162434] pt-4 text-xs font-mono text-[#81909B]">
          <label className="flex items-center gap-2 cursor-pointer hover:text-[#CAD6E2] transition-colors">
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              className="rounded border-[#1F2E3D] bg-[#071018] text-[#00D4FF] focus:ring-0 focus:outline-none cursor-pointer"
            />
            <span>Remember my choice (replay available in header)</span>
          </label>
        </div>
      </div>
    </div>
  );
};
