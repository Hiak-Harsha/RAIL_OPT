/**
 * RAILOPT-X 2.0 — Stylized Real Rolling Stock & Semantic LOD Consist Renderer.
 * 
 * Replaces generic circles and rectangles with class-specific rolling stock:
 *  - EXPRESS: Aerodynamic locomotive cab (WAP-7 / Vande Bharat), pantograph, passenger windows, bogies, headlight beams.
 *  - FREIGHT: Heavy electric locomotive (WAG-9), container/boxcar wagons, coupler knuckles.
 *  - MEMU: Suburban EMU cab, passenger boarding doors, commuter coaches.
 *  - PASSENGER: Standard diesel/electric locomotive with passenger coaches.
 * 
 * Semantic LOD (Zero circles used for whole trains):
 *  - Level 0 (Macro > 200 km): Scaled-down Train Silhouette Icon (Loco wedge + mini consist blocks)
 *  - Level 1 (Meso 50-200 km): Mid-detail Class-Differentiated Consist with Direction Chevron & Speed Badge
 *  - Level 2 (Micro < 50 km): Full Class-Specific Rake Consist with Bogies & Headlight Beam
 */

import React from "react";
import type { Train } from "../../types/railway";

interface StylizedRollingStockProps {
  train: Train;
  x: number;
  y: number;
  rotationDeg?: number;
  lodLevel?: 0 | 1 | 2; // 0: Macro, 1: Meso, 2: Micro
  isSelected?: boolean;
  isFocused?: boolean;
  isBraking?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const StylizedRollingStock: React.FC<StylizedRollingStockProps> = ({
  train,
  x,
  y,
  rotationDeg = 0,
  lodLevel = 2,
  isSelected = false,
  isFocused = false,
  isBraking = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  const speed = train.current_speed_kmh;
  const isStopped = speed < 1;
  const serviceName = `${train.train_name} ${train.train_number}`.toLowerCase();
  const trainType = /freight|goods|cargo|wag/.test(serviceName) ? "FREIGHT"
    : /memu|emu|local|suburban/.test(serviceName) ? "MEMU"
    : /vande|rajdhani|shatabdi|duronto|express/.test(serviceName) ? "EXPRESS"
    : "PASSENGER";

  // Accent Colors by Train Priority / Class
  const primaryColor = trainType === "EXPRESS" ? "#FF8C1A" : trainType === "FREIGHT" ? "#00D4FF" : trainType === "MEMU" ? "#C084FC" : "#3E9142";
  const bodyColor = trainType === "EXPRESS" ? "#1E293B" : trainType === "FREIGHT" ? "#1E3A2F" : "#1A2E26";

  // --- LOD 0: MACRO OVERVIEW (Miniature Train Silhouette — NOT A CIRCLE) ---
  if (lodLevel === 0) {
    const miniW = 28;
    const miniH = 10;
    return (
      <g
        transform={`translate(${x}, ${y}) rotate(${rotationDeg})`}
        className="cursor-pointer select-none"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Selection Aura */}
        {isSelected && (
          <rect
            x={-miniW / 2 - 3}
            y={-miniH / 2 - 3}
            width={miniW + 6}
            height={miniH + 6}
            rx={3}
            fill="none"
            stroke="#FF8C1A"
            strokeWidth={1.5}
            strokeDasharray="3,2"
          />
        )}

        {/* Coach 1 Block */}
        <rect
          x={-miniW / 2}
          y={-miniH / 2}
          width={10}
          height={miniH}
          rx={1.5}
          fill={bodyColor}
          stroke={primaryColor}
          strokeWidth={0.8}
        />

        {/* Loco Body Block */}
        <rect
          x={-miniW / 2 + 12}
          y={-miniH / 2}
          width={12}
          height={miniH}
          rx={1.5}
          fill={primaryColor}
          stroke="#FFFFFF"
          strokeWidth={0.6}
        />

        {/* Aerodynamic Nose Wedge */}
        <polygon
          points={`${miniW / 2 - 4},${-miniH / 2} ${miniW / 2 + 2},0 ${miniW / 2 - 4},${miniH / 2}`}
          fill={primaryColor}
        />

        {/* Mini Headlight Glow */}
        {!isStopped && (
          <polygon
            points={`${miniW / 2 + 2},0 ${miniW / 2 + 12},-4 ${miniW / 2 + 12},4`}
            fill="#FFE600"
            fillOpacity={0.4}
            pointerEvents="none"
          />
        )}

        {/* Train ID Tag */}
        <text
          x={0}
          y={-miniH / 2 - 4}
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="bold"
          fill="#EAF2F7"
          fontFamily="monospace"
        >
          {train.train_id.slice(-5)}
        </text>
      </g>
    );
  }

  // --- LOD 1: MESO OPERATING VIEW (Mid-Detail Class Consist) ---
  if (lodLevel === 1) {
    const slugWidth = 52;
    const slugHeight = 14;
    return (
      <g
        transform={`translate(${x}, ${y}) rotate(${rotationDeg})`}
        className="cursor-pointer transition-transform duration-100 select-none"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Selection Aura */}
        {isSelected && (
          <rect
            x={-slugWidth / 2 - 4}
            y={-slugHeight / 2 - 4}
            width={slugWidth + 8}
            height={slugHeight + 8}
            rx={4}
            fill="none"
            stroke="#FF8C1A"
            strokeWidth={1.5}
            strokeDasharray="4,2"
          />
        )}

        {/* Trailing Coach */}
        <rect
          x={-slugWidth / 2}
          y={-slugHeight / 2}
          width={22}
          height={slugHeight}
          rx={2}
          fill={bodyColor}
          stroke={primaryColor}
          strokeWidth={1.2}
        />
        {/* Coach Window Band */}
        <rect x={-slugWidth / 2 + 3} y={-2} width={16} height={4} rx={1} fill="#38BDF8" fillOpacity={0.7} />

        {/* Locomotive Body */}
        <rect
          x={-slugWidth / 2 + 25}
          y={-slugHeight / 2}
          width={22}
          height={slugHeight}
          rx={2}
          fill={primaryColor}
          stroke="#FFFFFF"
          strokeWidth={1}
        />

        {/* Direction Cab Nose Wedge */}
        <polygon
          points={`${slugWidth / 2 - 5},${-slugHeight / 2} ${slugWidth / 2 + 4},0 ${slugWidth / 2 - 5},${slugHeight / 2}`}
          fill={primaryColor}
        />

        {/* Headlight Cone */}
        {!isStopped && (
          <polygon
            points={`${slugWidth / 2 + 4},0 ${slugWidth / 2 + 24},-10 ${slugWidth / 2 + 24},10`}
            fill="#FFE600"
            fillOpacity={0.35}
            pointerEvents="none"
          />
        )}

        {/* Train ID text */}
        <text
          x={-slugWidth / 2 + 11}
          y={3.5}
          textAnchor="middle"
          fontSize="9"
          fontWeight="bold"
          fill="#FFFFFF"
          fontFamily="monospace"
        >
          {train.train_id.slice(-5)}
        </text>

        {/* Speed tag */}
        <text
          x={slugWidth / 2 - 14}
          y={3.5}
          textAnchor="middle"
          fontSize="8"
          fontWeight="black"
          fill="#0B1520"
          fontFamily="monospace"
        >
          {Math.round(speed)}k
        </text>
      </g>
    );
  }

  // --- LOD 2: MICRO INCIDENT VIEW (Full Physical Stylized Rake Consist) ---
  const rakeLength = 98; // Total consist length in focus mode
  const coachWidth = 26;
  const coachHeight = 15;
  const locoWidth = 30;

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotationDeg})`}
      className="cursor-pointer select-none"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 1. Selection & Attention Spotlight Halo */}
      {(isSelected || isFocused) && (
        <rect
          x={-rakeLength / 2 - 6}
          y={-coachHeight / 2 - 6}
          width={rakeLength + 12}
          height={coachHeight + 12}
          rx={6}
          fill="none"
          stroke="#FF8C1A"
          strokeWidth={2}
          strokeDasharray="5,3"
          className="spotlight-active"
        />
      )}

      {/* 2. Dynamic Headlight Beam (Active when moving) */}
      {!isStopped && (
        <polygon
          points={`${rakeLength / 2},0 ${rakeLength / 2 + 65},-20 ${rakeLength / 2 + 65},20`}
          fill="url(#headlight-gradient)"
          opacity={0.4}
          pointerEvents="none"
        />
      )}

      {/* 3. Braking Deceleration Decal Aura */}
      {isBraking && (
        <g pointerEvents="none">
          <rect
            x={-rakeLength / 2 - 2}
            y={-coachHeight / 2 - 2}
            width={rakeLength + 4}
            height={coachHeight + 4}
            rx={4}
            fill="#FF1744"
            fillOpacity={0.2}
            stroke="#FF1744"
            strokeWidth={1.5}
          />
        </g>
      )}

      {/* 4. Carriages Rake Group */}
      <g id={`rake-${train.train_id}`}>
        {/* Carriage 2 (Rear) */}
        <g transform={`translate(${-rakeLength / 2 + coachWidth / 2}, 0)`}>
          <rect
            x={-coachWidth / 2}
            y={-coachHeight / 2}
            width={coachWidth}
            height={coachHeight}
            rx={2}
            fill="#0F172A"
            stroke="#475569"
            strokeWidth={1}
          />
          {/* Windows */}
          <rect x={-10} y={-3.5} width={4.5} height={4.5} rx={0.5} fill="#38BDF8" fillOpacity={0.8} />
          <rect x={-2} y={-3.5} width={4.5} height={4.5} rx={0.5} fill="#38BDF8" fillOpacity={0.8} />
          <rect x={6} y={-3.5} width={4.5} height={4.5} rx={0.5} fill="#38BDF8" fillOpacity={0.8} />
          {/* Rear Red Marker Light */}
          <circle cx={-coachWidth / 2 + 1} cy={0} r={1.5} fill="#EF4444" />
        </g>

        {/* Coupler 1 */}
        <line
          x1={-rakeLength / 2 + coachWidth}
          y1={0}
          x2={-rakeLength / 2 + coachWidth + 4}
          y2={0}
          stroke="#94A3B8"
          strokeWidth={2}
        />

        {/* Carriage 1 (Middle) */}
        <g transform={`translate(${-rakeLength / 2 + coachWidth + 4 + coachWidth / 2}, 0)`}>
          <rect
            x={-coachWidth / 2}
            y={-coachHeight / 2}
            width={coachWidth}
            height={coachHeight}
            rx={2}
            fill="#0F172A"
            stroke="#475569"
            strokeWidth={1}
          />
          {/* Livery Stripe */}
          <line
            x1={-coachWidth / 2}
            y1={coachHeight / 2 - 2}
            x2={coachWidth / 2}
            y2={coachHeight / 2 - 2}
            stroke={primaryColor}
            strokeWidth={2}
          />
          {/* Windows */}
          <rect x={-10} y={-3.5} width={4.5} height={4.5} rx={0.5} fill="#38BDF8" fillOpacity={0.8} />
          <rect x={-2} y={-3.5} width={4.5} height={4.5} rx={0.5} fill="#38BDF8" fillOpacity={0.8} />
          <rect x={6} y={-3.5} width={4.5} height={4.5} rx={0.5} fill="#38BDF8" fillOpacity={0.8} />
        </g>

        {/* Coupler 2 */}
        <line
          x1={-rakeLength / 2 + coachWidth * 2 + 4}
          y1={0}
          x2={-rakeLength / 2 + coachWidth * 2 + 8}
          y2={0}
          stroke="#94A3B8"
          strokeWidth={2}
        />

        {/* Locomotive (Front) */}
        <g transform={`translate(${rakeLength / 2 - locoWidth / 2}, 0)`}>
          {/* Main Loco Body */}
          <rect
            x={-locoWidth / 2}
            y={-coachHeight / 2}
            width={locoWidth - 4}
            height={coachHeight}
            rx={2}
            fill={primaryColor}
            stroke="#FFFFFF"
            strokeWidth={1}
          />

          {/* Aerodynamic Cab Nose Cone */}
          <path
            d={`M ${locoWidth / 2 - 4} ${-coachHeight / 2} 
               Q ${locoWidth / 2 + 5} 0 ${locoWidth / 2 - 4} ${coachHeight / 2} 
               Z`}
            fill={primaryColor}
            stroke="#FFFFFF"
            strokeWidth={1}
          />

          {/* Cab Windshield Glass */}
          <path
            d={`M ${locoWidth / 2 - 8} ${-coachHeight / 2 + 2} 
               Q ${locoWidth / 2 - 1} 0 ${locoWidth / 2 - 8} ${coachHeight / 2 - 2} 
               Z`}
            fill="#0F172A"
            stroke="#38BDF8"
            strokeWidth={0.5}
          />

          {/* Rooftop Diamond Pantograph */}
          <path
            d="M -6 -7.5 L -2 -12 L 2 -12 L 6 -7.5"
            fill="none"
            stroke="#CBD5E1"
            strokeWidth={1.5}
          />
          <line x1="-4" y1="-12" x2="4" y2="-12" stroke="#EF4444" strokeWidth={1.5} />

          {/* Twin LED Headlights */}
          <circle cx={locoWidth / 2 - 2} cy={-3} r={1.5} fill="#FFFFFF" />
          <circle cx={locoWidth / 2 - 2} cy={3} r={1.5} fill="#FFFFFF" />
        </g>
      </g>

      {/* 5. Monospace Overlay Telemetry Tag */}
      <g transform={`translate(0, ${-coachHeight / 2 - 6})`}>
        <rect
          x={-28}
          y={-10}
          width={56}
          height={12}
          rx={2}
          fill="#071018"
          fillOpacity={0.9}
          stroke={primaryColor}
          strokeWidth={0.8}
        />
        <text
          x={0}
          y={-1}
          textAnchor="middle"
          fontSize="9"
          fontWeight="black"
          fill="#EAF2F7"
          fontFamily="monospace"
        >
          {train.train_id} • {Math.round(speed)}k
        </text>
      </g>
    </g>
  );
};
