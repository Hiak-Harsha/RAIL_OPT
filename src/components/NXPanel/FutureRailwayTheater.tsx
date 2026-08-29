import React, { useEffect, useState } from "react";
import type { Recommendation } from "../../types/railway";
import { GitBranch, ShieldCheck, Check, Eye } from "lucide-react";
import { fetchCandidatePreview, type CandidatePreview } from "../../services/api";

interface FutureRailwayTheaterProps {
  recommendation?: Recommendation | null;
  selectedCandidateId: string | null;
  onSelectCandidate: (candidateId: string) => void;
  onApproveSelected: () => void;
  causalLensActive: boolean;
  onToggleCausalLens: () => void;
}

export const FutureRailwayTheater: React.FC<FutureRailwayTheaterProps> = ({
  recommendation,
  selectedCandidateId,
  onSelectCandidate,
  onApproveSelected,
  causalLensActive,
  onToggleCausalLens,
}) => {
  const [preview, setPreview] = useState<CandidatePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  if (!recommendation || !recommendation.counterfactual_options || recommendation.counterfactual_options.length === 0) {
    return null;
  }

  const activeOption =
    recommendation.counterfactual_options.find(
      (opt) => (opt.candidate_id || opt.option_id || opt.label) === selectedCandidateId
    ) || recommendation.counterfactual_options.find((opt) => opt.is_recommended);

  useEffect(() => {
    const candidateId = activeOption?.candidate_id || activeOption?.option_id;
    if (!candidateId || activeOption?.safety_valid === false) {
      setPreview(null);
      return;
    }
    let alive = true;
    setPreviewError(null);
    fetchCandidatePreview(recommendation.recommendation_id, candidateId)
      .then((next) => { if (alive) setPreview(next); })
      .catch((error) => { if (alive) { setPreview(null); setPreviewError(error instanceof Error ? error.message : "Preview unavailable"); } });
    return () => { alive = false; };
  }, [recommendation.recommendation_id, activeOption?.candidate_id, activeOption?.option_id, activeOption?.safety_valid]);

  return (
    <div className="absolute bottom-4 left-4 right-4 z-30 pointer-events-auto bg-[#070C0A]/95 border border-[#1E2B23] backdrop-blur-md rounded-xl p-3 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 rail-fade-in">
      {/* Left: Future Candidate Selector Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#131D18] rounded border border-[#1E2B23] text-[#8C9A8E] text-[10px] font-mono font-bold uppercase shrink-0">
          <GitBranch className="w-3.5 h-3.5 text-[#FF8C1A]" />
          <span>FUTURES</span>
        </div>

        {recommendation.counterfactual_options.map((opt, idx) => {
          const optId = opt.candidate_id || opt.option_id || opt.label || `opt_${idx}`;
          const optLabel = opt.label || opt.option_id || opt.candidate_id || `Option ${idx + 1}`;
          const isSelected = (selectedCandidateId || (opt.is_recommended ? optId : null)) === optId;
          const isOpt = opt.is_recommended;

          return (
            <button
              key={optId}
              onClick={() => onSelectCandidate(optId)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                isSelected
                  ? "bg-[#FF8C1A]/20 border-[#FF8C1A] text-[#FF8C1A] shadow-md shadow-[#FF8C1A]/10"
                  : "bg-[#0D1310] border-[#1E2B23] text-[#8C9A8E] hover:border-[#34463A] hover:text-[#E2E8E4]"
              }`}
            >
              <span>{optLabel}</span>
              {isOpt && (
                <span className="text-[8px] bg-[#FF8C1A] text-[#070C0A] px-1 py-0.2 rounded font-black">
                  REC
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Center: Realtime Selected Future Metrics Strip */}
      {activeOption && (
        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-[9px] text-[#8C9A8E] block uppercase">PROJECTED DELAY</span>
            <strong className={activeOption.is_recommended ? "text-[#22C55E]" : "text-[#FF8C1A]"}>
              +{activeOption.metrics?.total_delay_min ?? activeOption.total_delay_min ?? activeOption.projected_total_delay_min ?? 0}m
            </strong>
          </div>

          <div>
            <span className="text-[9px] text-[#8C9A8E] block uppercase">SAFETY INVARIANT</span>
            <span className="inline-flex items-center gap-1 text-[#22C55E] font-bold">
              <ShieldCheck className="w-3 h-3" />
              {activeOption.safety || (activeOption.safety_valid === false ? "FAILED" : "PASSED")}
            </span>
          </div>

          <button
            onClick={onToggleCausalLens}
            className={`px-2.5 py-1 rounded border text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors ${
              causalLensActive
                ? "bg-[#38BDF8]/20 border-[#38BDF8] text-[#38BDF8]"
                : "bg-[#0D1310] border-[#1E2B23] text-[#8C9A8E] hover:text-[#E2E8E4]"
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>CAUSAL LENS {causalLensActive ? "ON" : "OFF"}</span>
          </button>
        </div>
      )}

      {preview && (
        <div className="w-full md:w-auto text-[10px] font-mono text-[#8C9A8E] border-l border-[#1E2B23] pl-3">
          <span className="text-[#E2E8E4]">PHYSICAL PREVIEW</span> · {preview.frames?.length ?? 0} sampled states / {preview.horizon_sec ?? 0}s
          <span className="block">{(preview.applied_actions ?? []).map((a) => `${a.action_type} ${a.train_id}`).join(" · ") || "No intervention"}</span>
        </div>
      )}
      {previewError && <span className="text-[10px] text-[#D62828] font-mono">Preview unavailable: branch was not executed.</span>}

      {/* Right: Approve Selected Dispatch Plan */}
      <button
        onClick={onApproveSelected}
        disabled={activeOption?.safety_valid === false}
        className="px-4 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] disabled:bg-[#34463A] disabled:text-[#8C9A8E] text-[#070C0A] font-mono text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-[#22C55E]/20 shrink-0 cursor-pointer disabled:cursor-not-allowed"
      >
        <Check className="w-4 h-4 stroke-[3]" />
        <span>APPROVE {activeOption?.label || activeOption?.option_id || "PLAN"}</span>
      </button>
    </div>
  );
};
