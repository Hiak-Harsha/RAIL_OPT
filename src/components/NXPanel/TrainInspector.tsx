import React from "react";
import type { Train, TrackBlock } from "../../types/railway";
import { X, AlertCircle, Route, Zap } from "lucide-react";
import { FocusManager } from "../../interaction/FocusManager";

interface TrainInspectorProps {
  train: Train;
  currentBlock?: TrackBlock | null;
  onClose: () => void;
  onAction?: (action: string, trainId: string, durationSec?: number) => void;
  onOpenDecisionReview?: () => void;
  onLocateBlock?: (blockId: string) => void;
}

export const TrainInspector: React.FC<TrainInspectorProps> = ({
  train,
  currentBlock,
  onClose,
  onAction,
  onOpenDecisionReview,
  onLocateBlock,
}) => {
  const currentSpeed = train.current_speed_kmh || 0;
  const blockLimit = currentBlock?.current_speed_limit_kmh || train.max_speed_kmh;
  const maxSpeed = train.max_speed_kmh;
  const isDelayed = train.total_delay_sec > 60;
  const delayMin = (train.total_delay_sec / 60).toFixed(1);

  // Physical braking calculation
  const speedMs = currentSpeed / 3.6;
  const decelMs2 = train.deceleration_ms2 || 0.7;
  const brakingDistMeters = Math.round((speedMs * speedMs) / (2 * decelMs2));

  // Determine signal aspect limit
  const targetSpeed = Math.min(blockLimit, maxSpeed);
  const isWaiting = train.status === "WAITING" || train.hold_duration_remaining_sec > 0 || (train.wait_reason !== undefined && train.wait_reason !== null);

  const handleLocateBlock = (blockId: string) => {
    if (onLocateBlock) {
      onLocateBlock(blockId);
    } else {
      FocusManager.locateBlock(blockId);
    }
  };

  return (
    <div className="absolute right-4 top-16 z-30 w-88 bg-[#0D120E] border border-[#263529] rounded-lg shadow-2xl overflow-hidden font-sans text-xs text-[#EAF2F7] animate-in fade-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="bg-[#131B15] border-b border-[#263529] px-3 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF8C1A]"></span>
          <div>
            <div className="font-bold text-[#EAF2F7] tracking-wide flex items-center space-x-1">
              <span>{train.train_id}</span>
              <span className="text-[#8FA393] font-normal text-[10px]">({train.train_name})</span>
            </div>
            <div className="text-[10px] font-mono text-[#7A8B7E]">
              {train.origin} ──► {train.destination} | Priority P{train.priority}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[#7A8B7E] hover:text-[#EAF2F7] p-1 rounded hover:bg-[#1C261F] transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Status Badge & Delay */}
        <div className="flex items-center justify-between bg-[#162018] p-2 rounded border border-[#212E24]">
          <div>
            <div className="text-[10px] text-[#7A8B7E] font-mono">STATUS</div>
            <div className={`font-mono font-bold ${isDelayed ? "text-[#E5A93C]" : "text-[#3E9142]"}`}>
              {train.status} {isDelayed ? `(+${delayMin}m)` : "(ON TIME)"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[#7A8B7E] font-mono">DIRECTION</div>
            <div className="font-mono font-bold text-[#7EA8BE]">{train.direction} LINE</div>
          </div>
        </div>

        {/* WHY IS THIS TRAIN WAITING? (PS 25022 Operational Inquiry) */}
        {isWaiting && (
          <div className="bg-[#1A1A12] border border-[#F59E0B]/40 rounded-lg p-2.5 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[#F59E0B]">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-[#F59E0B]" />
                WHY IS THIS TRAIN WAITING?
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B]">
                OPERATIONAL CAUSE
              </span>
            </div>

            <div className="space-y-1.5 font-mono text-[10px]">
              {/* Primary Wait Reason */}
              <div className="flex items-start justify-between text-[#CAD6E2] bg-[#121513] p-1.5 rounded border border-[#263529]">
                <span className="text-[#8FA393]">Reason:</span>
                <span className="text-right font-semibold text-[#EAF2F7]">
                  {train.wait_reason?.message || (train.hold_duration_remaining_sec > 0 ? "Controller Hold Applied" : "Interlocking Route Pending")}
                </span>
              </div>

              {/* Block & Signal Ahead with Click to Locate */}
              {train.current_block_id && (
                <div className="flex items-center justify-between text-[#CAD6E2] bg-[#121513] p-1.5 rounded border border-[#263529]">
                  <span className="text-[#8FA393]">Location:</span>
                  <button
                    onClick={() => handleLocateBlock(train.current_block_id!)}
                    className="text-[#FF8C1A] hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Route className="w-3 h-3" />
                    <span>{train.current_block_id} (Locate)</span>
                  </button>
                </div>
              )}

              {/* Hold Duration Remaining */}
              {train.hold_duration_remaining_sec > 0 && (
                <div className="flex items-center justify-between text-[#CAD6E2] bg-[#121513] p-1.5 rounded border border-[#263529]">
                  <span className="text-[#8FA393]">Hold Remaining:</span>
                  <span className="text-[#EF4444] font-bold">{train.hold_duration_remaining_sec.toFixed(0)}s</span>
                </div>
              )}

              {/* Station Dwell Remaining */}
              {train.is_dwelling && (
                <div className="flex items-center justify-between text-[#CAD6E2] bg-[#121513] p-1.5 rounded border border-[#263529]">
                  <span className="text-[#8FA393]">Dwell Remaining:</span>
                  <span className="text-[#EAB308] font-bold">{train.dwell_remaining_sec?.toFixed(0)}s</span>
                </div>
              )}
            </div>

            {onOpenDecisionReview && (
              <button
                onClick={onOpenDecisionReview}
                className="w-full mt-1.5 py-1 px-2 rounded bg-[#FF8C1A]/20 hover:bg-[#FF8C1A]/30 text-[#FF8C1A] border border-[#FF8C1A]/40 text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition"
              >
                <Zap className="w-3 h-3" />
                <span>View AI Conflict Resolution Options</span>
              </button>
            )}
          </div>
        )}

        {/* Target-Speed Ribbon */}
        <div>
          <div className="text-[10px] font-mono text-[#7A8B7E] mb-1 flex items-center justify-between">
            <span>SPEED RIBBON & BRAKING</span>
            <span className="text-[#A4B89D]">{currentSpeed.toFixed(0)} km/h</span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
            <div className="bg-[#1A241D] p-1.5 rounded border border-[#263529]">
              <div className="text-[8px] text-[#7A8B7E]">CURRENT</div>
              <div className="font-bold text-[#FF8C1A] text-xs">{currentSpeed.toFixed(0)}</div>
            </div>
            <div className="bg-[#1A241D] p-1.5 rounded border border-[#263529]">
              <div className="text-[8px] text-[#7A8B7E]">TARGET</div>
              <div className="font-bold text-[#3E9142] text-xs">{targetSpeed.toFixed(0)}</div>
            </div>
            <div className="bg-[#1A241D] p-1.5 rounded border border-[#263529]">
              <div className="text-[8px] text-[#7A8B7E]">BLOCK</div>
              <div className="font-bold text-[#E5A93C] text-xs">{blockLimit.toFixed(0)}</div>
            </div>
            <div className="bg-[#1A241D] p-1.5 rounded border border-[#263529]">
              <div className="text-[8px] text-[#7A8B7E]">MAX</div>
              <div className="font-bold text-[#7EA8BE] text-xs">{maxSpeed.toFixed(0)}</div>
            </div>
          </div>
        </div>

        {/* Physics & Telemetry */}
        <div className="bg-[#111712] p-2.5 rounded border border-[#1E2A20] space-y-1.5 font-mono text-[10px]">
          <div className="flex justify-between">
            <span className="text-[#7A8B7E]">Current Block:</span>
            <span className="text-[#EAF2F7] font-semibold">{train.current_block_id || "TRANSIT"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7A8B7E]">Braking Distance:</span>
            <span className="text-[#EAF2F7]">{brakingDistMeters} meters ({decelMs2} m/s²)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7A8B7E]">Acceleration:</span>
            <span className="text-[#EAF2F7]">{train.current_accel_ms2?.toFixed(2) || "0.00"} m/s²</span>
          </div>
          {train.current_position_km !== undefined && (
            <div className="flex justify-between">
              <span className="text-[#7A8B7E]">Corridor KM:</span>
              <span className="text-[#EAF2F7]">{train.current_position_km.toFixed(2)} km</span>
            </div>
          )}
        </div>

        {/* Route Progress */}
        <div>
          <div className="text-[10px] font-mono text-[#7A8B7E] mb-1">ROUTE PROGRESS</div>
          <div className="w-full bg-[#1A241D] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#3E9142] h-full transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(5, ((train.route_index || 0) / Math.max(1, train.route_block_ids?.length || 1)) * 100))}%`
              }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-[#7A8B7E] mt-1">
            <span>Block {train.route_index + 1} of {train.route_block_ids?.length || 1}</span>
            <span>{train.destination}</span>
          </div>
        </div>

        {/* Quick Dispatcher Actions */}
        <div className="pt-1 border-t border-[#1F2B21] space-y-1.5">
          <div className="text-[10px] font-mono text-[#7A8B7E]">CONTROLLER COMMANDS</div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onAction && onAction("HOLD", train.train_id, 300)}
              className="px-2 py-1.5 bg-[#2A1810] hover:bg-[#3D2216] text-[#FF8C1A] border border-[#4A2E1E] rounded text-[10px] font-mono font-semibold transition text-center cursor-pointer"
            >
              HOLD (5 min)
            </button>
            <button
              onClick={() => onAction && onAction("RELEASE", train.train_id)}
              className="px-2 py-1.5 bg-[#142618] hover:bg-[#1B3622] text-[#3E9142] border border-[#24422A] rounded text-[10px] font-mono font-semibold transition text-center cursor-pointer"
            >
              RELEASE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
