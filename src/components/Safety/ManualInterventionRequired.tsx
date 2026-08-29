import React, { useState } from "react";
import type { PredictedConflict } from "../../types/railway";
import { AlertTriangle, ShieldAlert, Sliders } from "lucide-react";

interface ManualInterventionProps {
  conflict: PredictedConflict;
  reason?: string;
  onConfirmOverride: (action: string, justification: string) => void;
  onDismiss?: () => void;
}

export const ManualInterventionRequired: React.FC<ManualInterventionProps> = ({
  conflict,
  reason = "All automated dispatch candidate branches violate strict safety invariants (headway or block occupancy).",
  onConfirmOverride,
  onDismiss
}) => {
  const [selectedAction, setSelectedAction] = useState<string>("HOLD_PRIMARY");
  const [justification, setJustification] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim()) return;
    onConfirmOverride(selectedAction, justification);
  };

  return (
    <div className="border-2 border-[#EF4444] bg-[#1A0D0F] rounded-xl p-5 shadow-2xl space-y-4 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#EF4444]/30">
        <div className="flex items-center gap-2.5 text-[#EF4444]">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
          <h3 className="text-sm font-extrabold tracking-wider uppercase">
            MANUAL INTERVENTION REQUIRED
          </h3>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40 font-bold">
          SAFETY OVERRIDE
        </span>
      </div>

      {/* Rationale Box */}
      <div className="bg-[#0D0507] border border-[#EF4444]/40 rounded-lg p-3 space-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-[#EF4444] font-bold">
          <AlertTriangle className="w-4 h-4" />
          <span>Automated Planning Rejection</span>
        </div>
        <p className="text-[#E2E8E4] font-sans text-xs leading-relaxed">
          {reason}
        </p>
        <div className="text-[10px] text-[#8C9A8E] pt-1">
          Conflict: <strong className="text-[#E2E8E4]">{conflict.conflict_id}</strong> on block <strong className="text-[#FF8C1A]">{conflict.location_block_name || conflict.location_block_id}</strong> between <strong className="text-[#E2E8E4]">{conflict.involved_train_names?.join(" & ") || conflict.involved_train_ids?.join(" & ")}</strong>.
        </div>
      </div>

      {/* Manual Override Form */}
      <form onSubmit={handleSubmit} className="space-y-3 pt-1">
        <div>
          <label className="block text-[10px] text-[#8C9A8E] uppercase mb-1 font-bold">
            Select Manual Controller Action
          </label>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full bg-[#0D0507] border border-[#232A25] rounded-lg p-2 text-xs text-[#E2E8E4] focus:border-[#EF4444] focus:outline-none"
          >
            <option value="HOLD_PRIMARY">Hold Primary Train at Origin/Station Loop</option>
            <option value="HOLD_SECONDARY">Hold Conflicting Train at Approach Signal</option>
            <option value="REDUCE_SPEED">Impose 30 km/h Caution Speed Limit</option>
            <option value="REROUTE_LOOP">Divert into Intermediate Station Loop</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] text-[#8C9A8E] uppercase mb-1 font-bold">
            Mandatory Operational Justification (Recorded in SHA-256 Audit Trail)
          </label>
          <textarea
            required
            rows={2}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Specify regulatory or dispatch operational reason for manual override..."
            className="w-full bg-[#0D0507] border border-[#232A25] rounded-lg p-2 text-xs text-[#E2E8E4] font-sans focus:border-[#EF4444] focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 bg-[#181C19] hover:bg-[#232A25] text-[#8C9A8E] text-xs rounded-lg transition"
            >
              Dismiss
            </button>
          )}
          <button
            type="submit"
            disabled={!justification.trim()}
            className="px-4 py-2 bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-40 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition shadow-lg cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>CONFIRM MANUAL OVERRIDE</span>
          </button>
        </div>
      </form>
    </div>
  );
};
