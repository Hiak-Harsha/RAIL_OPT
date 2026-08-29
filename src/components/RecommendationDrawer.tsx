import React, { useState } from "react";
import type { Recommendation } from "../types/railway";
import { Check, X, Sliders, ShieldCheck, ShieldAlert, Sparkles, BrainCircuit, AlertTriangle } from "lucide-react";
import { WhyPanel } from "./Explain/WhyPanel";

interface RecommendationDrawerProps {
  recommendation: Recommendation | null;
  onDecision: (action: "APPROVE" | "REJECT" | "OVERRIDE", overrideReason?: string) => void;
  canApproveDecision?: boolean;
  onOpenDecisionReview?: () => void;
}

export const RecommendationDrawer: React.FC<RecommendationDrawerProps> = ({
  recommendation,
  onDecision,
  canApproveDecision = true,
  onOpenDecisionReview
}) => {
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState("Field Operational Priority Adjustment");

  if (!recommendation) {
    return (
      <div className="bg-[#121513] border border-[#232A25] rounded-xl p-5 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#3E9142]/10 text-[#3E9142] border border-[#3E9142]/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#E2E8E4] tracking-wide">NETWORK STATE STABILIZED & CONFLICT-FREE</div>
            <div className="text-xs text-[#8C9A8E]">
              Continuous OR-Tools CP-SAT scan active. All active block separations and headway margins satisfied.
            </div>
          </div>
        </div>
        <div className="text-xs px-3 py-1.5 rounded bg-[#181C19] text-[#FF8C1A] border border-[#FF8C1A]/30 font-mono font-bold">
          RADAR SCAN: NORMAL
        </div>
      </div>
    );
  }

  const isApplied = recommendation.applied;
  const isSafe = recommendation.safety_valid && recommendation.operational_status !== "NO_SAFE_PLAN";
  const isNoSafePlan = recommendation.operational_status === "NO_SAFE_PLAN" || !recommendation.safety_valid;

  return (
    <div className={`bg-[#121513] border-2 ${
      isApplied 
        ? "border-[#3E9142]/80" 
        : isNoSafePlan 
        ? "border-[#D62828]/80" 
        : "border-[#FF8C1A]/80"
    } rounded-xl p-5 shadow-2xl relative overflow-hidden`}>
      <div className="flex items-center justify-between pb-3 border-b border-[#232A25]">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-md ${
            isApplied 
              ? "bg-[#3E9142]/20 text-[#3E9142] border border-[#3E9142]/40" 
              : isNoSafePlan
              ? "bg-[#D62828]/20 text-[#D62828] border border-[#D62828]/40"
              : "bg-[#FF8C1A]/20 text-[#FF8C1A] border border-[#FF8C1A]/40"
          }`}>
            {isApplied ? (
              <Check className="w-4 h-4" />
            ) : isNoSafePlan ? (
              <ShieldAlert className="w-4 h-4 text-[#D62828]" />
            ) : (
              <Sparkles className="w-4 h-4 text-[#FF8C1A]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${isNoSafePlan ? "text-[#D62828]" : "text-[#FF8C1A]"}`}>
                {isNoSafePlan ? "SAFETY VALIDATION REJECTED • NO SAFE AUTOMATED PLAN" : "RAILOPT-X DECISION SUPPORT"}
              </span>
              <span className="text-[10px] text-[#8C9A8E] font-mono">
                {isApplied ? "• DECISION EXECUTED & AUDITED" : "• PENDING CONTROLLER APPROVAL"}
              </span>
            </div>
            <h3 className="text-base font-bold text-[#E2E8E4] mt-0.5">
              {recommendation.reason_summary}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-[#8C9A8E] uppercase font-mono">
              {recommendation.solver_name || "OR-Tools CP-SAT"}
            </div>
            <div className={`font-mono text-xs font-bold ${isSafe ? "text-[#3E9142]" : "text-[#D62828]"}`}>
              {recommendation.solver_status || "STATUS UNAVAILABLE"} ({isSafe ? "VALID" : "UNSAFE"})
            </div>
          </div>
        </div>
      </div>

      {isNoSafePlan && (
        <div className="my-3 p-3 rounded-lg bg-[#D62828]/10 border border-[#D62828]/40 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-[#D62828] shrink-0 mt-0.5" />
          <div className="text-xs text-[#E2E8E4]">
            <strong className="text-[#D62828]">Safety Validation Notice:</strong> All candidate dispatch options produce physical headway or crossing conflicts. Routine automated approval is locked. If emergency clearance is required, use <strong>Manual Controller Override</strong> with logged justification.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
        <div className="md:col-span-2 space-y-2">
          <div className="text-xs font-semibold text-[#8C9A8E] uppercase tracking-wider">
            Operational Justification (Explainable AI):
          </div>
          <ul className="space-y-1.5">
            {recommendation.reasons_bullet_points.map((bullet, idx) => (
              <li key={idx} className="text-xs text-[#E2E8E4] flex items-start gap-2 bg-[#181C19] p-2 rounded border border-[#232A25]">
                <span className="text-[#FF8C1A] font-bold mt-0.5">▸</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#181C19] p-3 rounded-lg border border-[#232A25] flex flex-col justify-between">
          <div className="text-xs font-semibold text-[#8C9A8E] uppercase tracking-wider mb-2">
            Projected Impact (Single Source of Truth):
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#8C9A8E]">Projected Delay Saved:</span>
              <span className="font-mono font-bold text-[#3E9142]">
                {recommendation.projected_metrics_diff?.delay_saved_min !== undefined
                  ? `+${recommendation.projected_metrics_diff.delay_saved_min.toFixed(1)} min`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#8C9A8E]">Throughput Gain:</span>
              <span className="font-mono font-bold text-[#FF8C1A]">
                {recommendation.projected_metrics_diff?.throughput_gain_pct !== undefined
                  ? `+${recommendation.projected_metrics_diff.throughput_gain_pct.toFixed(1)}%`
                  : "+0.0%"}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#8C9A8E]">Safety Validation:</span>
              <span className={`font-mono font-bold ${isSafe ? "text-[#3E9142]" : "text-[#D62828]"}`}>
                {isSafe ? "PASSED (0 Violations)" : "FAILED (Unsafe)"}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-[#232A25] text-[10px] text-[#8C9A8E]">
            {isApplied ? "Plan Active in Physical Simulation" : "Requires Section Controller Confirmation"}
          </div>
        </div>
      </div>

      {recommendation.counterfactual_options && recommendation.counterfactual_options.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-[#8C9A8E] uppercase tracking-wider mb-2">
            Projected Dispatch Alternatives ("Why Not The Other Options?"):
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {recommendation.counterfactual_options.map((opt) => (
              <div
                key={opt.option_id}
                className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                  opt.is_recommended
                    ? "bg-[#FF8C1A]/10 border-[#FF8C1A]/50 text-[#E2E8E4]"
                    : "bg-[#181C19] border-[#232A25] text-[#8C9A8E]"
                }`}
              >
                <div>
                  <div className="flex justify-between items-center font-bold mb-1">
                    <span className="text-xs truncate">{opt.label}</span>
                    {opt.is_recommended && (
                      <span className="text-[9px] bg-[#FF8C1A] text-[#0B0D0A] px-1.5 py-0.5 rounded font-extrabold shrink-0 ml-1">
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] mt-1 space-y-0.5">
                    <div>Total Delay: <strong className={opt.is_recommended ? "text-[#3E9142]" : "text-[#E5A93C]"}>+{opt.total_delay_min || opt.projected_total_delay_min || 0}m</strong></div>
                    <div>Safety / Feasibility: <strong className={opt.safety?.includes("PASSED") || opt.is_recommended ? "text-[#3E9142]" : "text-[#D62828]"}>{opt.safety || "PASSED"}</strong></div>
                    {opt.relative_preference && (
                      <div className="text-[10px] text-[#FF8C1A] font-mono mt-0.5">{opt.relative_preference}</div>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-[#8C9A8E] mt-2 pt-1 border-t border-[#232A25]">
                  {opt.controller_summary}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendation.explanation && (
        <div className="mb-4">
          <WhyPanel payload={{ kind: "CONFLICT", data: recommendation.explanation }} />
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-[#232A25]">
        <div className="text-xs text-[#8C9A8E] flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isApplied ? "bg-[#3E9142]" : isNoSafePlan ? "bg-[#D62828]" : "bg-[#FF8C1A] animate-pulse"}`} />
          <span>{isApplied ? "DECISION APPLIED TO DIGITAL TWIN" : "HUMAN-IN-THE-LOOP ACTIVE: Controller holds final authority"}</span>
        </div>

        {isApplied ? (
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded bg-[#3E9142]/10 text-[#3E9142] border border-[#3E9142]/30 text-xs font-mono font-bold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              PLAN APPLIED • EXECUTION IN PROGRESS
            </span>
          </div>
        ) : (
          <div className={`flex items-center gap-3 ${!canApproveDecision ? "opacity-40 pointer-events-none" : ""}`}
               title={!canApproveDecision ? "Controller or Supervisor role required" : undefined}>
            {onOpenDecisionReview && (
              <button
                onClick={onOpenDecisionReview}
                className="px-3.5 py-2 text-xs font-bold bg-[#181C19] hover:bg-[#232A25] text-[#FF8C1A] border border-[#FF8C1A]/40 rounded-lg flex items-center gap-1.5 transition-colors font-mono"
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                REVIEW EVIDENCE
              </button>
            )}

            <button
              onClick={() => onDecision("REJECT")}
              disabled={!canApproveDecision}
              className="px-3.5 py-2 text-xs font-bold bg-[#D62828]/20 hover:bg-[#D62828]/30 text-[#D62828] border border-[#D62828]/40 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              REJECT PLAN
            </button>

            {isSafe ? (
              <button
                onClick={() => onDecision("APPROVE")}
                disabled={!canApproveDecision}
                className="px-5 py-2 text-xs font-extrabold bg-[#3E9142] hover:bg-[#3E9142]/90 text-[#0B0D0A] rounded-lg flex items-center gap-1.5 shadow-lg shadow-[#3E9142]/20 transition-all hover:scale-105"
              >
                <Check className="w-4 h-4" />
                APPROVE & EXECUTE
              </button>
            ) : (
              <button
                onClick={() => setShowOverrideModal(true)}
                disabled={!canApproveDecision}
                className="px-5 py-2 text-xs font-extrabold bg-[#FF8C1A] hover:bg-[#FF8C1A]/90 text-[#0B0D0A] rounded-lg flex items-center gap-1.5 shadow-lg shadow-[#FF8C1A]/20 transition-all hover:scale-105"
              >
                <Sliders className="w-4 h-4" />
                CONTROLLER OVERRIDE (REQUIRES REASON)
              </button>
            )}
          </div>
        )}
      </div>

      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#121513] border border-[#232A25] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h4 className="text-base font-bold text-[#E2E8E4] mb-2 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#FF8C1A]" />
              Controller Manual Override Justification
            </h4>
            <p className="text-xs text-[#8C9A8E] mb-4">
              A safety-critical manual override requires an explicit reason logged to the immutable SHA-256 regulatory ledger:
            </p>

            <select
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full bg-[#181C19] border border-[#232A25] text-sm text-[#E2E8E4] rounded-lg p-2.5 mb-5 focus:outline-none focus:border-[#FF8C1A]"
            >
              <option value="Field Loco / Brake Defect Resolution">Field Loco / Brake Defect Resolution</option>
              <option value="Station Master Manual Dispatch Order">Station Master Manual Dispatch Order</option>
              <option value="Emergency Medical / VIP Movement Priority">Emergency Medical / VIP Movement Priority</option>
              <option value="Track Gang Maintenance Window Extension">Track Gang Maintenance Window Extension</option>
              <option value="Signal Aspect Visual Restriction">Signal Aspect Visual Restriction</option>
            </select>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2 text-xs text-[#8C9A8E] hover:text-[#E2E8E4]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowOverrideModal(false);
                  onDecision("OVERRIDE", overrideReason);
                }}
                className="px-4 py-2 text-xs font-bold bg-[#FF8C1A] text-[#0B0D0A] rounded-lg"
              >
                Authorize & Log Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
