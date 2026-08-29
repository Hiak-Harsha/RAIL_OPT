import React from "react";
import type { Train } from "../../types/railway";

interface PhysicalTrainPuckProps {
  train: Train;
  x: number;
  y: number;
  pixelLength: number;
  isSelected: boolean;
  isSpotlightDimmed: boolean;
  onClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const PhysicalTrainPuck: React.FC<PhysicalTrainPuckProps> = ({
  train,
  x,
  y,
  pixelLength,
  isSelected,
  isSpotlightDimmed,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  const isUp = train.direction !== "DOWN";
  const isBraking = train.status === "BRAKING" || (train.current_speed_kmh > 0 && train.current_speed_kmh < 45 && train.held_at_block_id);
  const isDwelling = train.is_dwelling || train.status === "DWELLING";
  const isWaiting = train.status === "WAITING" || Boolean(train.held_at_block_id);
  const isFreight = train.priority === 4 || train.train_id.startsWith("T0");

  const primaryColor = isFreight
    ? "#38BDF8"
    : train.priority === 1
    ? "#FF8C1A"
    : "#22C55E";

  const numCars = Math.max(3, Math.min(8, Math.round(pixelLength / 14)));
  const carWidth = Math.max(8, (pixelLength - 8) / numCars);

  return (
    <g
      transform={`translate(${x}, ${y})`}
      className={`cursor-pointer transition-opacity duration-300 ${
        isSpotlightDimmed ? "opacity-25" : "opacity-100"
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Braking Decal Zone Ahead */}
      {isBraking && (
        <rect
          x={isUp ? pixelLength / 2 : -pixelLength / 2 - 40}
          y={-10}
          width={40}
          height={20}
          rx={4}
          fill="url(#brakingZoneGradient)"
          className="conflict-pulse-slow pointer-events-none"
        />
      )}

      {/* Train Selection Aura Ring */}
      {isSelected && (
        <rect
          x={-pixelLength / 2 - 4}
          y={-12}
          width={pixelLength + 8}
          height={24}
          rx={8}
          fill="none"
          stroke={primaryColor}
          strokeWidth={2}
          strokeDasharray="4 2"
          className="route-wake-active"
        />
      )}

      {/* Physical Multi-Car Rake Consist */}
      <g>
        {Array.from({ length: numCars }).map((_, idx) => {
          const carX = -pixelLength / 2 + idx * (carWidth + 1.5);
          const isLocomotive = isUp ? idx === numCars - 1 : idx === 0;

          return (
            <rect
              key={idx}
              x={carX}
              y={-6}
              width={carWidth}
              height={12}
              rx={isLocomotive ? 3 : 1.5}
              fill={isLocomotive ? primaryColor : "#131D18"}
              stroke={isSelected ? "#E2E8E4" : isLocomotive ? primaryColor : "#1E2B23"}
              strokeWidth={isLocomotive ? 1.5 : 1}
            />
          );
        })}
      </g>

      {/* Train Identification Tag & Speed Badge */}
      <g transform={`translate(0, ${isUp ? -18 : 22})`}>
        <rect
          x={-36}
          y={-8}
          width={72}
          height={16}
          rx={4}
          fill="#070C0A"
          stroke={isSelected ? primaryColor : "#1E2B23"}
          strokeWidth={1}
          opacity={0.95}
        />
        <text
          x={0}
          y={3}
          textAnchor="middle"
          fill={isSelected ? primaryColor : "#E2E8E4"}
          fontSize={8.5}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
        >
          {train.train_id} • {train.current_speed_kmh.toFixed(0)}k
        </text>
      </g>

      {/* Operational State Pill (DWELL / BRAKE / HOLD) */}
      {(isBraking || isDwelling || isWaiting) && (
        <g transform={`translate(${isUp ? pixelLength / 2 + 10 : -pixelLength / 2 - 32}, 0)`}>
          <rect
            x={-18}
            y={-6}
            width={36}
            height={12}
            rx={3}
            fill={isBraking ? "#EF4444" : isDwelling ? "#EAB308" : "#FF8C1A"}
          />
          <text
            x={0}
            y={3}
            textAnchor="middle"
            fill="#070C0A"
            fontSize={7}
            fontFamily="JetBrains Mono, monospace"
            fontWeight={900}
          >
            {isBraking ? "BRAKE" : isDwelling ? "DWELL" : "HOLD"}
          </text>
        </g>
      )}
    </g>
  );
};
