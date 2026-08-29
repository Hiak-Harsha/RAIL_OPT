import React from "react";
import type { Station, Train, PredictedConflict } from "../../types/railway";

interface CorridorOverviewProps {
  stations: Station[];
  trains: Train[];
  predictedConflicts: PredictedConflict[];
  viewportStartKm: number;
  viewportEndKm: number;
  onPanToKm: (centerKm: number) => void;
}

export const CorridorOverview: React.FC<CorridorOverviewProps> = ({
  stations,
  trains,
  predictedConflicts,
  viewportStartKm,
  viewportEndKm,
  onPanToKm,
}) => {
  const TOTAL_KM = 435.0;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickKm = (clickX / rect.width) * TOTAL_KM;
    onPanToKm(clickKm);
  };

  return (
    <div className="w-full bg-[#070C0A] border-b border-[#1E2B23] px-4 py-1.5 flex items-center gap-3 select-none">
      <span className="text-[9px] font-mono font-bold text-[#8C9A8E] uppercase tracking-wider shrink-0">
        435 KM CORRIDOR OVERVIEW
      </span>

      <div className="relative flex-1 h-7 bg-[#0D1310] border border-[#1E2B23] rounded flex items-center px-2 overflow-hidden">
        <svg
          className="w-full h-full cursor-pointer"
          viewBox={`0 0 ${TOTAL_KM} 28`}
          preserveAspectRatio="none"
          onClick={handleClick}
        >
          {/* Main Corridor Spine Line */}
          <line
            x1="0"
            y1="14"
            x2={TOTAL_KM}
            y2="14"
            stroke="#1E2B23"
            strokeWidth="3"
          />

          {/* Station Ticks */}
          {stations.map((stn) => (
            <g key={stn.id} transform={`translate(${stn.position_km}, 14)`}>
              <circle r="2.5" fill="#8C9A8E" />
              <text
                y="11"
                textAnchor="middle"
                fill="#8C9A8E"
                fontSize="6"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="700"
              >
                {stn.code}
              </text>
            </g>
          ))}

          {/* Active Trains Directional Chevrons */}
          {trains.map((t) => {
            const tx = t.corridor_position_km ?? t.current_position_km ?? 0;
            const ty = t.direction === "DOWN" ? 18 : 10;
            const color = t.priority === 5 ? "#FF8C1A" : t.priority === 4 ? "#00D4FF" : "#22C55E";
            return (
              <polygon
                key={t.train_id}
                points={t.direction === "DOWN"
                  ? `${tx - 2.5},${ty} ${tx + 2},${ty - 2} ${tx + 2},${ty + 2}`
                  : `${tx + 2.5},${ty} ${tx - 2},${ty - 2} ${tx - 2},${ty + 2}`
                }
                fill={color}
              />
            );
          })}

          {/* Conflict Markers */}
          {predictedConflicts.map((c) => (
            <rect
              key={c.conflict_id}
              x={150 - 4}
              y="10"
              width="8"
              height="8"
              fill="#EF4444"
              className="conflict-pulse-slow"
            />
          ))}

          {/* Active Operational Viewport Highlight Frame */}
          <rect
            x={viewportStartKm}
            y="2"
            width={Math.max(20, viewportEndKm - viewportStartKm)}
            height="24"
            fill="rgba(255, 140, 26, 0.12)"
            stroke="#FF8C1A"
            strokeWidth="1.5"
            rx="3"
          />
        </svg>
      </div>

      <div className="text-[9px] font-mono text-[#FF8C1A] shrink-0 font-bold">
        {viewportStartKm.toFixed(0)}km – {viewportEndKm.toFixed(0)}km
      </div>
    </div>
  );
};
