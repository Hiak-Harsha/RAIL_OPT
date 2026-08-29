import React from "react";
import { 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  ArrowRight
} from "lucide-react";
import type { 
  WaitReason, 
  ConflictExplanation, 
  RecommendationRationale,
  ResolutionTradeoff
} from "../../types/railway";

export type ExplainablePayload =
  | { kind: "WAIT_REASON"; data: WaitReason; trainId?: string }
  | { kind: "CONFLICT"; data: ConflictExplanation }
  | { kind: "RECOMMENDATION"; data: RecommendationRationale };

interface WhyPanelProps {
  payload: ExplainablePayload;
  onLocateEntity?: (entityId: string) => void;
  onSelectOption?: (action: string) => void;
  className?: string;
}

export const WhyPanel: React.FC<WhyPanelProps> = ({
  payload,
  onLocateEntity,
  className = ""
}) => {
  if (payload.kind === "WAIT_REASON") {
    const { data, trainId } = payload;
    return (
      <div className={`p-3 bg-[#161B16] border border-[#2A322A] space-y-2.5 font-mono text-xs ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2A322A] pb-2">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-[#1C1811] text-[#FF8C1A] border border-[#B8935A]/50">
              <Clock className="w-3.5 h-3.5" />
            </span>
            <div>
              <span className="text-[9px] text-[#9A9688] uppercase font-bold block">OPERATIONAL HOLD CAUSE</span>
              <span className="font-bold text-[#E8E4D8]">{trainId ? `Train ${trainId}` : "Train"}</span>
            </div>
          </div>
          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase ${
            data.severity === "CRITICAL" ? "bg-[#220F0F] text-[#D62828] border border-[#D62828]" :
            data.severity === "HIGH" ? "bg-[#1C1811] text-[#FF8C1A] border border-[#FF8C1A]" :
            "bg-[#1C1811] text-[#B8935A] border border-[#B8935A]"
          }`}>
            {data.type}
          </span>
        </div>

        {/* WHY (Root Cause) */}
        <div>
          <span className="text-[9px] font-bold text-[#FF8C1A] tracking-wider uppercase block mb-1">
            WHY IS THIS TRAIN HELD?
          </span>
          <p className="text-[#E8E4D8] text-[11px] leading-relaxed bg-[#0B0D0A] p-2 border border-[#2A322A]">
            {data.message}
          </p>
        </div>

        {/* WHAT (Impact) */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-[#0B0D0A] p-2 border border-[#2A322A]">
            <span className="text-[#9A9688] text-[9px] block uppercase">ESTIMATED REMAINING</span>
            <span className="text-[#3E9142] font-bold">{Math.round(data.remaining_sec)}s</span>
          </div>
          <div className="bg-[#0B0D0A] p-2 border border-[#2A322A]">
            <span className="text-[#9A9688] text-[9px] block uppercase">TARGET ENTITY</span>
            <button 
              onClick={() => data.entity_id && onLocateEntity?.(data.entity_id)}
              className="text-[#FF8C1A] hover:underline font-bold truncate block w-full text-left"
            >
              {data.entity_id || "Track Section"} →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (payload.kind === "CONFLICT") {
    const { data } = payload;
    return (
      <div className={`p-3 bg-[#161B16] border border-[#2A322A] space-y-2.5 font-mono text-xs ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2A322A] pb-2">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-[#220F0F] text-[#D62828] border border-[#D62828]">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
            </span>
            <div>
              <span className="text-[9px] text-[#9A9688] uppercase font-bold block">CONFLICT RADAR INCIDENT</span>
              <span className="font-bold text-[#E8E4D8]">{data.conflict_id} • {data.location_block_name}</span>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[9px] font-bold bg-[#220F0F] text-[#D62828] border border-[#D62828] uppercase">
            T-{Math.round(data.time_to_impact_sec)}s IMPACT
          </span>
        </div>

        {/* 1. WHY (Root Cause) */}
        <div>
          <span className="text-[9px] font-bold text-[#FF8C1A] tracking-wider uppercase block mb-1">
            1. WHY THIS CONFLICT OCCURS (ROOT CAUSE)
          </span>
          <p className="text-[#E8E4D8] text-[11px] leading-relaxed bg-[#0B0D0A] p-2 border border-[#2A322A]">
            {data.root_cause}
          </p>
        </div>

        {/* 2. WHAT (Operational Impact) */}
        <div>
          <span className="text-[9px] font-bold text-[#FF8C1A] tracking-wider uppercase block mb-1">
            2. WHAT HAPPENS WITHOUT INTERVENTION (IMPACT)
          </span>
          <p className="text-[#9A9688] text-[11px] leading-relaxed bg-[#0B0D0A] p-2 border border-[#2A322A]">
            {data.impact_summary}
          </p>
        </div>

        {/* 3. HOW (Candidate Resolutions & Tradeoffs) */}
        {data.candidate_resolutions && data.candidate_resolutions.length > 0 && (
          <div>
            <span className="text-[9px] font-bold text-[#3E9142] tracking-wider uppercase block mb-1">
              3. HOW TO RESOLVE (CANDIDATE DISPATCH OPTIONS & TRADEOFFS)
            </span>
            <div className="space-y-1.5">
              {data.candidate_resolutions.map((res: ResolutionTradeoff, idx: number) => (
                <div 
                  key={idx}
                  className="bg-[#0B0D0A] p-2 border border-[#2A322A] hover:border-[#FF8C1A] transition-colors flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#FF8C1A] text-[11px]">{res.action}</span>
                    <span className="text-[9px] text-[#9A9688] font-bold">Target: {res.target_train_id}</span>
                  </div>
                  <p className="text-[#3E9142] text-[10px] font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 shrink-0" />
                    <span>{res.expected_effect}</span>
                  </p>
                  <p className="text-[#9A9688] text-[9px] flex items-center gap-1">
                    <ArrowRight className="w-2.5 h-2.5 text-[#FF8C1A] shrink-0" />
                    <span>Tradeoff: {res.tradeoff}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (payload.kind === "RECOMMENDATION") {
    const { data } = payload;
    return (
      <div className={`p-3 bg-[#161B16] border border-[#2A322A] space-y-2.5 font-mono text-xs ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2A322A] pb-2">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-[#0E1E10] text-[#3E9142] border border-[#3E9142]">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
            <div>
              <span className="text-[9px] text-[#9A9688] uppercase font-bold block">RECOMMENDATION RATIONALE</span>
              <span className="font-bold text-[#E8E4D8]">{data.recommendation_id} • {data.action}</span>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[9px] font-bold bg-[#0E1E10] text-[#3E9142] border border-[#3E9142] uppercase">
            SAFETY VALIDATED
          </span>
        </div>

        {/* WHY CHOSEN */}
        <div>
          <span className="text-[9px] font-bold text-[#FF8C1A] tracking-wider uppercase block mb-1">
            WHY THIS CANDIDATE WAS SELECTED OVER ALTERNATIVES
          </span>
          <p className="text-[#E8E4D8] text-[11px] leading-relaxed bg-[#0B0D0A] p-2 border border-[#2A322A]">
            {data.why_chosen}
          </p>
        </div>

        {/* BINDING CONSTRAINTS */}
        {data.binding_constraints.length > 0 && (
          <div>
            <span className="text-[9px] font-bold text-[#FF8C1A] tracking-wider uppercase block mb-1">
              BINDING OPERATIONAL CONSTRAINTS
            </span>
            <div className="flex flex-wrap gap-1">
              {data.binding_constraints.map((c: string, i: number) => (
                <span key={i} className="px-1.5 py-0.5 bg-[#0B0D0A] border border-[#2A322A] text-[9px] text-[#9A9688]">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* WHAT HAPPENS IF REJECTED */}
        <div>
          <span className="text-[9px] font-bold text-[#D62828] tracking-wider uppercase block mb-1">
            CONSEQUENCE IF ORDER REJECTED
          </span>
          <p className="text-[#E8B93A] text-[10px] leading-relaxed bg-[#0B0D0A] p-2 border border-[#2A322A]">
            {data.rejection_consequence}
          </p>
        </div>
      </div>
    );
  }

  return null;
};
