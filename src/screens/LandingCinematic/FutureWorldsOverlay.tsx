import React from "react";
import type { CandidatePlanPreview } from "../../data/gridlockSequence";
import { GitBranch, ShieldCheck, AlertTriangle } from "lucide-react";

interface FutureWorldsOverlayProps {
  plans?: CandidatePlanPreview[];
  onSelectPlan?: (planId: string) => void;
}

export const FutureWorldsOverlay: React.FC<FutureWorldsOverlayProps> = ({ plans }) => {
  if (!plans || plans.length === 0) return null;

  return (
    <div className="absolute top-16 right-6 z-25 pointer-events-none max-w-sm w-full rail-fade-in">
      <div className="bg-[#070C0A]/90 border border-[#1E2B23] backdrop-blur-md rounded-xl p-3.5 shadow-2xl space-y-2.5">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between pb-2 border-b border-[#1E2B23]">
          <div className="flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5 text-[#FF8C1A]" />
            <span className="text-[10px] font-mono font-extrabold text-[#E2E8E4] uppercase tracking-wider">
              FUTURE WORLDS SEARCH
            </span>
          </div>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FF8C1A]/15 text-[#FF8C1A] border border-[#FF8C1A]/30">
            PRESENTATION SCENARIO
          </span>
        </div>

        {/* Compact Candidate Comparison List */}
        <div className="space-y-1.5">
          {plans.map((plan) => {
            const isOpt = plan.isOptimal;
            const isUnsafe = plan.safetyStatus === "UNSAFE";

            return (
              <div
                key={plan.id}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors flex items-center justify-between ${
                  isOpt
                    ? "bg-[#22C55E]/10 border-[#22C55E]/60 text-[#E2E8E4]"
                    : isUnsafe
                    ? "bg-[#EF4444]/10 border-[#EF4444]/40 text-[#EF4444] opacity-60"
                    : "bg-[#0D1310] border-[#1E2B23] text-[#8C9A8E]"
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold">{plan.name}</span>
                  {isOpt && (
                    <span className="text-[8px] bg-[#22C55E] text-[#070C0A] px-1 py-0.2 rounded font-black">
                      BEST
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 text-[10px]">
                  <span className={isOpt ? "text-[#22C55E] font-bold" : "text-[#8C9A8E]"}>
                    +{plan.delayMin}m
                  </span>
                  <span className={isUnsafe ? "text-[#EF4444]" : "text-[#22C55E]"}>
                    {isUnsafe ? <AlertTriangle className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
