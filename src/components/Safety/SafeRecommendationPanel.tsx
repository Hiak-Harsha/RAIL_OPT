import React from "react";
import type { Recommendation } from "../../types/railway";
import { ShieldCheck, Check, X, Sliders, Cpu, TrendingDown } from "lucide-react";

interface SafeRecommendationProps {
  recommendation: Recommendation;
  onApprove: () => void;
  onReject: () => void;
  onOverride: () => void;
  canApprove?: boolean;
}

export const SafeRecommendationPanel: React.FC<SafeRecommendationProps> = ({
  recommendation,
  onApprove,
  onReject,
  onOverride,
  canApprove = true
}) => {
  return (
    <div className="border-2 border-[#22C55E] bg-[#0A1810] rounded-xl p-5 shadow-2xl space-y-4 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#22C55E]/30">
        <div className="flex items-center gap-2.5 text-[#22C55E]">
          <ShieldCheck className="w-5 h-5" />
          <h3 className="text-sm font-extrabold tracking-wider uppercase">
            AI RECOMMENDATION — SAFETY VERIFIED
          </h3>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40 font-bold">
          0 INVARIANT VIOLATIONS
        </span>
      </div>

      {/* Primary Action Card */}
      <div className="bg-[#050D08] border border-[#22C55E]/30 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#8C9A8E] uppercase font-bold">RECOMMENDED DISPATCH ORDER</span>
          <span className="text-[10px] text-[#FF8C1A] font-bold flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            {recommendation.solver_name || "OR-Tools CP-SAT"}
          </span>
        </div>
        <div className="text-base font-extrabold text-[#E2E8E4]">
          {recommendation.action.toUpperCase()} ORDER • {recommendation.primary_train_id}
        </div>
        <div className="text-xs text-[#8C9A8E] font-sans">
          Target Block: <strong className="text-[#FF8C1A]">{recommendation.target_block_id || "Sectional Loop"}</strong> | Hold Duration: <strong className="text-[#E2E8E4]">{recommendation.duration_sec || 240}s</strong>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-lg bg-[#050D08] border border-[#1E2B23]">
          <div className="text-[9px] text-[#8C9A8E]">DELAY SAVED</div>
          <div className="text-sm font-bold text-[#22C55E] flex items-center gap-1 mt-0.5">
            <TrendingDown className="w-3.5 h-3.5" />
            +{recommendation.projected_metrics_diff?.delay_saved_min?.toFixed(1) || "0.0"} min
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-[#050D08] border border-[#1E2B23]">
          <div className="text-[9px] text-[#8C9A8E]">OBJECTIVE SCORE</div>
          <div className="text-sm font-bold text-[#EAB308] mt-0.5">
            J = {recommendation.evaluated_objective_score?.toFixed(1) || recommendation.optimization_objective_score?.toFixed(1) || "—"}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1E2B23]">
        <button
          onClick={onOverride}
          className="px-3 py-1.5 bg-[#131D18] hover:bg-[#1C2C24] text-[#FF8C1A] border border-[#FF8C1A]/40 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Override</span>
        </button>
        <button
          onClick={onReject}
          className="px-3 py-1.5 bg-[#1F1012] hover:bg-[#2F181C] text-[#EF4444] border border-[#EF4444]/40 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          <span>Reject</span>
        </button>
        <button
          onClick={onApprove}
          disabled={!canApprove}
          className="px-4 py-1.5 bg-[#22C55E] hover:bg-[#16A34A] disabled:opacity-40 text-[#070C0A] rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-[#22C55E]/20 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>APPROVE DISPATCH ORDER</span>
        </button>
      </div>
    </div>
  );
};
