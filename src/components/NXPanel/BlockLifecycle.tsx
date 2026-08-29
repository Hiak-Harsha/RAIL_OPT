import React from "react";
import type { TrackBlock } from "../../types/railway";
import { ShieldCheck, X } from "lucide-react";

interface BlockLifecycleProps {
  block: TrackBlock;
  simTimeSec?: number;
  onClose: () => void;
}

export const BlockLifecycle: React.FC<BlockLifecycleProps> = ({
  block,
  onClose
}) => {
  // Determine lifecycle state
  let state: "FREE" | "RESERVED" | "OCCUPIED" | "BLOCKED" = "FREE";
  if (block.is_blocked) {
    state = "BLOCKED";
  } else if (block.is_occupied) {
    state = "OCCUPIED";
  }

  const speedLimit = block.current_speed_limit_kmh;

  return (
    <div className="absolute left-4 bottom-16 z-30 w-72 bg-[#0D120E] border border-[#263529] rounded-lg shadow-2xl overflow-hidden font-sans text-xs text-[#EAF2F7] animate-in fade-in slide-in-from-left-4 duration-200">
      <div className="bg-[#131B15] border-b border-[#263529] px-3 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            state === "OCCUPIED" ? "bg-[#D62828]" :
            state === "BLOCKED" ? "bg-[#D45B38]" :
            "bg-[#3E9142]"
          }`}></span>
          <span className="font-bold font-mono tracking-wide text-[#EAF2F7]">{block.id}</span>
        </div>
        <button
          onClick={onClose}
          className="text-[#7A8B7E] hover:text-[#EAF2F7] p-1 rounded hover:bg-[#1C261F] transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-2.5 font-mono text-[11px]">
        {/* Name & Type */}
        <div className="flex justify-between items-center text-[#A4B89D]">
          <span>{block.name}</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-[#1C261F] rounded border border-[#2A382E] text-[#8FA393]">
            {block.block_type}
          </span>
        </div>

        {/* Lifecycle Flow Indicator (Finding #29) */}
        <div>
          <div className="text-[9px] text-[#7A8B7E] mb-1">INTERLOCKING LIFECYCLE</div>
          <div className="grid grid-cols-4 gap-1 text-[9px] text-center">
            <div className={`p-1 rounded border ${state === "FREE" ? "bg-[#1B3622] text-[#3E9142] border-[#3E9142] font-bold" : "bg-[#111712] text-[#4E5D52] border-[#1C261F]"}`}>
              FREE
            </div>
            <div className={`p-1 rounded border ${(state as string) === "RESERVED" ? "bg-[#332A15] text-[#E5A93C] border-[#E5A93C] font-bold" : "bg-[#111712] text-[#4E5D52] border-[#1C261F]"}`}>
              RESERVED
            </div>
            <div className={`p-1 rounded border ${state === "OCCUPIED" ? "bg-[#3D1414] text-[#D62828] border-[#D62828] font-bold" : "bg-[#111712] text-[#4E5D52] border-[#1C261F]"}`}>
              OCCUPIED
            </div>
            <div className={`p-1 rounded border ${state === "BLOCKED" ? "bg-[#3D2216] text-[#D45B38] border-[#D45B38] font-bold" : "bg-[#111712] text-[#4E5D52] border-[#1C261F]"}`}>
              BLOCKED
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-[#111712] p-2 rounded border border-[#1E2A20] space-y-1 text-[10px]">
          <div className="flex justify-between">
            <span className="text-[#7A8B7E]">Occupant:</span>
            <span className="text-[#EAF2F7] font-semibold">{block.occupied_by_train_id || "NONE"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7A8B7E]">Speed Limit:</span>
            <span className="text-[#EAF2F7]">{speedLimit} km/h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7A8B7E]">Length:</span>
            <span className="text-[#EAF2F7]">{block.length_km.toFixed(1)} km</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7A8B7E]">Signals:</span>
            <span className="text-[#EAF2F7]">{block.signals?.join(", ") || "None"}</span>
          </div>
        </div>

        {/* Safety Rule Note */}
        <div className="text-[9px] text-[#7A8B7E] flex items-center space-x-1">
          <ShieldCheck className="w-3 h-3 text-[#3E9142]" />
          <span>180s Headway Invariant Active</span>
        </div>
      </div>
    </div>
  );
};
