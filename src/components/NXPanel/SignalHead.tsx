import React from "react";
import type { SignalAspect } from "./SignalAspectEngine";

export type { SignalAspect };

interface SignalHeadProps {
  signalId: string;
  name?: string;
  aspect: SignalAspect;
  direction: "UP" | "DOWN";
  x: number;
  y: number;
  isSelected?: boolean;
  onClick?: () => void;
}

export const SignalHead: React.FC<SignalHeadProps> = ({
  signalId,
  name,
  aspect,
  direction,
  x,
  y,
  isSelected = false,
  onClick
}) => {
  const isUp = direction === "UP";

  // 4-aspect lamp activation logic
  const isRedOn = aspect === "RED";
  const isYellow1On = aspect === "YELLOW" || aspect === "DOUBLE_YELLOW";
  const isYellow2On = aspect === "DOUBLE_YELLOW";
  const isGreenOn = aspect === "GREEN";

  return (
    <g
      transform={`translate(${x}, ${y})`}
      className="cursor-pointer group select-none"
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick();
      }}
    >
      {/* Selection Glow Halo */}
      {isSelected && (
        <circle
          cx={0}
          cy={isUp ? -20 : 20}
          r={18}
          fill="none"
          stroke="#FF8C1A"
          strokeWidth={1.5}
          opacity={0.9}
        />
      )}

      {/* Signal Mast Post */}
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={isUp ? -16 : 16}
        stroke={isSelected ? "#FF8C1A" : "#4C5750"}
        strokeWidth="2"
      />

      {/* Signal Target Plate / Head (4-lens vertical housing) */}
      <rect
        x={-7}
        y={isUp ? -36 : 12}
        width={14}
        height={32}
        rx={2}
        fill="#0A0F0D"
        stroke={isSelected ? "#FF8C1A" : "#223127"}
        strokeWidth={isSelected ? 1.5 : 1}
      />

      {/* 1. Red Lamp (Top) */}
      <circle
        cx={0}
        cy={isUp ? -31 : 17}
        r={3}
        fill={isRedOn ? "#EF4444" : "#261515"}
        className={isRedOn ? "glow-signal-red" : ""}
      />

      {/* 2. Yellow 1 Lamp */}
      <circle
        cx={0}
        cy={isUp ? -24 : 24}
        r={3}
        fill={isYellow1On ? "#F59E0B" : "#262015"}
        className={isYellow1On ? "glow-signal-amber" : ""}
      />

      {/* 3. Yellow 2 Lamp (for DOUBLE_YELLOW) */}
      <circle
        cx={0}
        cy={isUp ? -17 : 31}
        r={3}
        fill={isYellow2On ? "#EAB308" : "#262015"}
        className={isYellow2On ? "glow-signal-amber" : ""}
      />

      {/* 4. Green Lamp (Bottom) */}
      <circle
        cx={0}
        cy={isUp ? -10 : 38}
        r={3}
        fill={isGreenOn ? "#22C55E" : "#142618"}
        className={isGreenOn ? "glow-signal-green" : ""}
      />

      {/* Signal Identifier Tooltip Label */}
      <text
        x={isUp ? 10 : -10}
        y={isUp ? -20 : 25}
        textAnchor={isUp ? "start" : "end"}
        fontSize="7"
        fontFamily="monospace"
        fill={isSelected ? "#FF8C1A" : "#7A8B7E"}
        className="opacity-0 group-hover:opacity-100 transition-opacity font-bold select-none"
      >
        {name || signalId} ({aspect})
      </text>
    </g>
  );
};
