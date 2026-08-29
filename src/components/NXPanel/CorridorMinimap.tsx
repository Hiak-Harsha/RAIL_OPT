import React, { useMemo } from "react";
import type { Train, TrackBlock, Station, PredictedConflict } from "../../types/railway";

interface CorridorMinimapProps {
  trains: Train[];
  blocks: TrackBlock[];
  stations: Station[];
  predictedConflicts: PredictedConflict[];
  viewportStartKm: number;
  viewportEndKm: number;
  onSelectViewportKm?: (startKm: number) => void;
  onSelectTrain?: (train: Train) => void;
  totalCorridorKm?: number;
}

export const CorridorMinimap: React.FC<CorridorMinimapProps> = ({
  trains,
  stations,
  predictedConflicts,
  viewportStartKm,
  viewportEndKm,
  onSelectViewportKm,
  onSelectTrain,
  totalCorridorKm = 435.0,
}) => {
  const width = 1000;
  const height = 48;
  const paddingX = 40;
  const usableWidth = width - paddingX * 2;

  const kmToX = (km: number) => {
    return paddingX + (Math.max(0, Math.min(totalCorridorKm, km)) / totalCorridorKm) * usableWidth;
  };

  const viewportStartX = kmToX(viewportStartKm);
  const viewportEndX = kmToX(viewportEndKm);
  const viewportWidth = Math.max(24, viewportEndX - viewportStartX);

  const activeTrains = useMemo(() => {
    return trains.filter(
      (t) => t.status === "RUNNING" || t.status === "DELAYED" || t.status === "WAITING"
    );
  }, [trains]);

  const handleMinimapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onSelectViewportKm) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const svgX = (clickX / rect.width) * width;
    const clickedKm = ((svgX - paddingX) / usableWidth) * totalCorridorKm;
    const windowSpan = viewportEndKm - viewportStartKm;
    const newStartKm = Math.max(0, Math.min(totalCorridorKm - windowSpan, clickedKm - windowSpan / 2));
    onSelectViewportKm(newStartKm);
  };

  return (
    <div className="w-full bg-[#080C09] border-b border-[#1F2822] px-3 py-1.5 select-none">
      <div className="flex items-center justify-between text-[10px] font-mono text-[#7A8B7E] mb-1">
        <div className="flex items-center space-x-2">
          <span className="text-[#FF8C1A] font-semibold tracking-wider">CORRIDOR OVERVIEW</span>
          <span>NDLS 0.0 km ── CNB 435.0 km</span>
          <span className="text-[#4E5D52]">|</span>
          <span className="text-[#A4B89D]">
            Active Window: <span className="text-[#EAF2F7]">{viewportStartKm.toFixed(0)}km – {viewportEndKm.toFixed(0)}km</span>
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3E9142]"></span>
            <span>Running ({activeTrains.length})</span>
          </span>
          {predictedConflicts.length > 0 && (
            <span className="flex items-center space-x-1 text-[#D45B38]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D45B38] animate-pulse"></span>
              <span>Conflicts ({predictedConflicts.length})</span>
            </span>
          )}
          <span className="text-[#4E5D52]">Click minimap to jump viewport</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-8 cursor-pointer rounded bg-[#0B100C] border border-[#162018]"
        onClick={handleMinimapClick}
      >
        {/* Track Mainlines */}
        <line x1={paddingX} y1={20} x2={width - paddingX} y2={20} stroke="#1D2720" strokeWidth={2} />
        <line x1={paddingX} y1={28} x2={width - paddingX} y2={28} stroke="#1D2720" strokeWidth={2} />

        {/* Stations */}
        {stations.map((stn) => {
          const sx = kmToX(stn.position_km);
          return (
            <g key={stn.id}>
              <line x1={sx} y1={12} x2={sx} y2={36} stroke="#2E3D32" strokeWidth={1} strokeDasharray="2,2" />
              <circle cx={sx} cy={24} r={2.5} fill="#4E5D52" />
              <text
                x={sx}
                y={10}
                textAnchor="middle"
                fill="#7A8B7E"
                fontSize={8}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {stn.code}
              </text>
            </g>
          );
        })}

        {/* Conflict Markers */}
        {predictedConflicts.map((conf) => {
          const cx = kmToX(170); // fallback or estimated km
          return (
            <g key={conf.conflict_id}>
              <circle cx={cx} cy={24} r={4} fill="none" stroke="#D45B38" strokeWidth={1.5} className="animate-ping" />
              <circle cx={cx} cy={24} r={2.5} fill="#D45B38" />
            </g>
          );
        })}

        {/* Active Trains */}
        {activeTrains.map((train) => {
          const trainKm = train.corridor_position_km ?? train.current_position_km ?? 0;
          const tx = kmToX(trainKm);
          const ty = train.direction === "UP" ? 20 : 28;
          const isDelayed = train.total_delay_sec > 60;
          const color = isDelayed ? "#E5A93C" : train.priority === 5 ? "#FF8C1A" : train.priority === 4 ? "#00D4FF" : "#3E9142";

          return (
            <g
              key={train.train_id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectTrain) onSelectTrain(train);
              }}
            >
              {/* Directional train chevron */}
              <polygon
                points={train.direction === "UP"
                  ? `${tx + 5},${ty} ${tx - 4},${ty - 3.5} ${tx - 1},${ty} ${tx - 4},${ty + 3.5}`
                  : `${tx - 5},${ty} ${tx + 4},${ty - 3.5} ${tx + 1},${ty} ${tx + 4},${ty + 3.5}`
                }
                fill={color}
                stroke="#0B100C"
                strokeWidth={0.7}
              />
            </g>
          );
        })}

        {/* Active Viewport Highlight Box */}
        <rect
          x={viewportStartX}
          y={4}
          width={viewportWidth}
          height={height - 8}
          fill="rgba(255, 140, 26, 0.08)"
          stroke="#FF8C1A"
          strokeWidth={1.5}
          strokeDasharray="4,2"
          rx={2}
        />
        <text
          x={viewportStartX + viewportWidth / 2}
          y={height - 6}
          textAnchor="middle"
          fill="#FF8C1A"
          fontSize={7}
          fontFamily="monospace"
          fontWeight="bold"
        >
          VIEWPORT
        </text>
      </svg>
    </div>
  );
};
