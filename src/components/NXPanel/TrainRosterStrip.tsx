import React from "react";
import type { Train, PredictedConflict } from "../../types/railway";
import { THEME_TOKENS } from "../../visual/tokens";
import { Train as TrainIcon, AlertTriangle } from "lucide-react";

interface TrainRosterStripProps {
  trains: Train[];
  predictedConflicts?: PredictedConflict[];
  selectedTrainId?: string | null;
  onSelectTrain: (train: Train) => void;
}

export const TrainRosterStrip: React.FC<TrainRosterStripProps> = ({
  trains,
  predictedConflicts = [],
  selectedTrainId,
  onSelectTrain
}) => {
  const delayedCount = trains.filter((t) => t.total_delay_sec > 60).length;
  const conflictTrainIds = new Set(predictedConflicts.flatMap((c) => c.involved_train_ids));

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 5: return THEME_TOKENS.railway.p1VandeBharat;
      case 4: return THEME_TOKENS.railway.p2Rajdhani;
      case 3: return THEME_TOKENS.railway.p3Express;
      case 2: return THEME_TOKENS.railway.p4Freight;
      default: return "#78909C";
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 5: return "P5 VB";
      case 4: return "P4 RAJ";
      case 3: return "P3 EXP";
      case 2: return "P2 FRT";
      default: return `P${priority}`;
    }
  };

  return (
    <div className="bg-[#071018] border border-[#162434] rounded-xl p-3 shadow-xl space-y-2">
      {/* Header Summary Row */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <TrainIcon className="w-3.5 h-3.5 text-[#00D4FF]" />
          <h3 className="text-xs font-mono font-bold text-[#EAF2F7] uppercase tracking-wider">
            LIVE SECTION TRAIN ROSTER ({trains.length})
          </h3>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1 text-[#00E676]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />
            {trains.length - delayedCount} ON-TIME
          </span>
          {delayedCount > 0 && (
            <span className="flex items-center gap-1 text-[#FFB300]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFB300] animate-pulse" />
              {delayedCount} DELAYED
            </span>
          )}
          {conflictTrainIds.size > 0 && (
            <span className="flex items-center gap-1 text-[#FF1744] font-bold">
              <AlertTriangle className="w-3 h-3" />
              {conflictTrainIds.size} IN CONFLICT
            </span>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Train Roster Cards */}
      <div className="train-roster-scroll">
        {trains.length === 0 ? (
          <div className="text-xs text-[#81909B] font-mono py-2 px-1">
            No active trains on corridor section...
          </div>
        ) : (
          trains.map((train) => {
            const isSelected = selectedTrainId === train.train_id;
            const isDelayed = train.total_delay_sec > 60;
            const hasConflict = conflictTrainIds.has(train.train_id);
            const priorityColor = getPriorityColor(train.priority);
            const priorityLabel = getPriorityLabel(train.priority);
            const isUp = train.direction === "UP";

            return (
              <div
                key={train.train_id}
                onClick={() => onSelectTrain(train)}
                className={`train-roster-card ${
                  isSelected ? "selected" : hasConflict ? "conflict" : isDelayed ? "delayed" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-1 mb-1 border-b border-[#162434]/60">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="px-1 py-0.5 rounded text-[8.5px] font-mono font-extrabold"
                      style={{
                        backgroundColor: `${priorityColor}20`,
                        color: priorityColor,
                        border: `1px solid ${priorityColor}60`
                      }}
                    >
                      {priorityLabel}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#EAF2F7]">
                      {train.train_number}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono font-bold text-[#CAD6E2] flex items-center gap-0.5">
                    {isUp ? (
                      <span className="text-[#00D4FF]">UP ▶</span>
                    ) : (
                      <span className="text-[#FFB300]">◀ DN</span>
                    )}
                  </span>
                </div>

                <div className="text-[10px] text-[#81909B] font-sans truncate max-w-[190px]">
                  {train.train_name}
                </div>

                <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t border-[#162434]/40 text-[9.5px] font-mono">
                  <span className="text-[#00E676] font-bold">
                    {Math.round(train.current_speed_kmh)} km/h
                  </span>
                  <span className="text-[#81909B] truncate max-w-[80px]">
                    {train.current_block_id || "MAIN"}
                  </span>
                  <span
                    className={`font-bold ${
                      isDelayed ? "text-[#FFB300]" : "text-[#00E676]"
                    }`}
                  >
                    {isDelayed
                      ? `+${Math.round(train.total_delay_sec / 60)}m`
                      : "0m"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
