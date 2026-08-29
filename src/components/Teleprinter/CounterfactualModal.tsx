import React from "react";
import type { Recommendation } from "../../types/railway";
import { X, Scale, CheckCircle2, XCircle, ArrowRight, Info } from "lucide-react";

interface CounterfactualModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: Recommendation | null;
}

export const CounterfactualModal: React.FC<CounterfactualModalProps> = ({
  isOpen,
  onClose,
  recommendation
}) => {
  if (!isOpen) return null;

  const options = recommendation?.counterfactual_options || [];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0A131D] border border-[#162434] w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-[#071018] border-b border-[#162434] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-mono tracking-wider uppercase text-[#EAF2F7]">
                COUNTERFACTUAL DECISION COMPARISON ENGINE
              </h3>
              <p className="text-xs text-[#81909B]">
                Comparative mathematical evaluation of candidate dispatch actions & delay penalties
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#81909B] hover:text-[#EAF2F7] hover:bg-[#1F2E3D] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {options.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-[#81909B] space-y-2">
              <Info className="w-6 h-6 text-[#00D4FF]" />
              <p className="text-xs text-center font-mono">
                No active counterfactual alternatives generated for the current network state.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {options.map((opt) => (
                <div
                  key={opt.option_id}
                  className={`rounded-xl p-4 space-y-3 border ${
                    opt.is_recommended
                      ? "bg-[#050B11] border-2 border-[#00E676]/60"
                      : "bg-[#050B11] border border-[#FF1744]/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-1 rounded font-mono text-xs font-bold flex items-center gap-1.5 ${
                        opt.is_recommended
                          ? "bg-[#00E676]/20 text-[#00E676]"
                          : "bg-[#FF1744]/20 text-[#FF1744]"
                      }`}
                    >
                      {opt.is_recommended ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      {opt.label} {opt.is_recommended ? "(SELECTED OPTIMUM)" : "(REJECTED ALTERNATIVE)"}
                    </span>
                  </div>

                  <div className="text-xs space-y-1.5 text-[#CAD6E2]">
                    <p>• {opt.controller_summary}</p>
                    <p>• Projected Total Delay: <strong className={opt.is_recommended ? "text-[#00E676]" : "text-[#FF4D4D]"}>+{(opt.total_delay_min ?? opt.projected_total_delay_min ?? 0.0).toFixed(1)} min</strong></p>
                    <p>• Conflict Severity Risk: <strong>{opt.conflict_risk || opt.safety || "NOMINAL"}</strong></p>
                    <p>• Relative Evaluation: <strong>{opt.relative_preference || opt.throughput_impact || "Standard Headway"}</strong></p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Operational Justification */}
          {recommendation && recommendation.reasons_bullet_points.length > 0 && (
            <div className="bg-[#0D1720] border border-[#1F2E3D] rounded-xl p-4">
              <h4 className="text-xs font-bold text-[#00D4FF] font-mono uppercase mb-2 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5" /> XAI Mathematical Rationale
              </h4>
              <ul className="space-y-1.5 text-xs text-[#CAD6E2] leading-relaxed">
                {recommendation.reasons_bullet_points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#00D4FF] font-bold">▸</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#071018] border-t border-[#162434] px-6 py-3 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold bg-[#13202E] hover:bg-[#1F2E3D] text-[#EAF2F7] rounded-lg transition-colors"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
