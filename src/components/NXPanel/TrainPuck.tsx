import React from "react";
import type { Train } from "../../types/railway";
import type { InteractionState } from "../../interaction/interactionConfig";
import { THEME_TOKENS } from "../../visual/tokens";

interface TrainPuckProps {
  train: Train;
  x: number;
  y: number;
  isHovered: boolean;
  attentionWeight?: number; // 0.0 (far) to 1.0 (dead center)
  interactionState?: InteractionState;
  onHover: (trainId: string | null) => void;
  onClick: (train: Train) => void;
}

export const TrainPuck: React.FC<TrainPuckProps> = ({
  train,
  x,
  y,
  isHovered,
  attentionWeight = 0,
  interactionState = "ambient",
  onHover,
  onClick
}) => {
  const isUp = train.direction === "UP";

  // Priority color according to authentic railway tokens
  const getPriorityColor = () => {
    switch (train.priority) {
      case 5: return THEME_TOKENS.railway.p5VandeBharat; // P5 Vande Bharat / Rajdhani Gold/Amber (#FF8C1A)
      case 4: return THEME_TOKENS.railway.p4Express;      // P4 Superfast Express Slate Blue (#7EA8BE)
      case 3: return THEME_TOKENS.railway.p3Passenger;    // P3 Passenger / MEMU Teal (#5E9387)
      case 2: return THEME_TOKENS.railway.p2Freight;      // P2 Freight Steel (#8C9A8E)
      case 1: return THEME_TOKENS.railway.p1Maintenance;  // P1 Maintenance Brass (#A77C40)
      default: return THEME_TOKENS.railway.p2Freight;
    }
  };

  const getStatusColor = () => {
    if (train.status === "WAITING") return "#E5A93C";
    if (train.status === "STOPPED" || train.status === "DISRUPTED") return "#D62828";
    if (train.total_delay_sec > 300) return "#E5A93C";
    return "#2E7D32";
  };

  const priorityColor = getPriorityColor();
  const statusColor = getStatusColor();
  const isSelected = interactionState === "selected";
  const isFocused = isHovered || isSelected || interactionState === "focused" || attentionWeight > 0.4;
  const isAware = isFocused || interactionState === "aware" || attentionWeight > 0.15;
  const isHighDelay = train.total_delay_sec > 60;

  // Scale multiplier from spatial interaction state
  const scale = isSelected ? 1.08 : isFocused ? 1.06 : isAware ? 1.03 : 1.0;

  // Compute length-scaled coaches (1 to 8 coach segments based on physical length_meters)
  const lengthMeters = train.length_meters || 500;
  const coachCount = Math.max(1, Math.min(8, Math.round(lengthMeters / 150)));
  const coachWidth = 10;
  const coachHeight = 10;
  const coachGap = 2.5;
  const locoWidth = 16;
  const locoHeight = 12;

  // Total rake offset: center train around x=0
  const totalRakeLength = locoWidth + coachCount * (coachWidth + coachGap);
  const startX = isUp ? -totalRakeLength / 2 : totalRakeLength / 2;

  // Granular motion state determination
  let motionBadge = "CRUISING";
  let motionBadgeColor = "#2E7D32";
  const accel = train.current_accel_ms2 || 0.0;

  if (train.is_dwelling) {
    motionBadge = "DWELLING";
    motionBadgeColor = "#00D4FF";
  } else if (train.status === "WAITING") {
    motionBadge = "HOLD";
    motionBadgeColor = "#E5A93C";
  } else if (train.status === "STOPPED" || train.current_speed_kmh <= 1.0) {
    motionBadge = "STOPPED";
    motionBadgeColor = "#D62828";
  } else if (accel > 0.08) {
    motionBadge = "ACCEL";
    motionBadgeColor = "#00E676";
  } else if (accel < -0.08) {
    motionBadge = "BRAKING";
    motionBadgeColor = "#FF8C1A";
  }

  // Speed trail wake
  const maxSpeed = 160;
  const speedRatio = Math.min(1, train.current_speed_kmh / maxSpeed);
  const trailLength = speedRatio * 60;
  const trailDirection = isUp ? -1 : 1;
  const trailColor = train.current_speed_kmh > 80 ? "#2E7D32" : train.current_speed_kmh > 30 ? "#FF8C1A" : "#D62828";

  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale})`}
      className="cursor-pointer select-none transition-transform duration-200"
      onMouseEnter={() => onHover(train.train_id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onClick(train);
      }}
    >
      {/* Speed Trail Wake */}
      {train.current_speed_kmh > 5 && trailLength > 3 && (
        <g className="speed-trail-wake pointer-events-none">
          <defs>
            <linearGradient
              id={`trail-${train.train_id}`}
              x1={trailDirection > 0 ? "0%" : "100%"}
              y1="0%"
              x2={trailDirection > 0 ? "100%" : "0%"}
              y2="0%"
            >
              <stop offset="0%" stopColor={trailColor} stopOpacity={0.45} />
              <stop offset="100%" stopColor={trailColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <rect
            x={trailDirection > 0 ? -totalRakeLength / 2 - trailLength : totalRakeLength / 2}
            y={-3}
            width={trailLength}
            height={6}
            rx={3}
            fill={`url(#trail-${train.train_id})`}
          />
        </g>
      )}

      {/* Dynamic Forward Headlight Beam Projection */}
      {train.current_speed_kmh > 0 && (
        <polygon
          points={
            isUp
              ? `${totalRakeLength / 2}, -3 ${totalRakeLength / 2 + 45}, -14 ${totalRakeLength / 2 + 45}, 14 ${totalRakeLength / 2}, 3`
              : `${-totalRakeLength / 2}, -3 ${-totalRakeLength / 2 - 45}, -14 ${-totalRakeLength / 2 - 45}, 14 ${-totalRakeLength / 2}, 3`
          }
          fill="#FFF9D2"
          fillOpacity={isFocused ? 0.28 : 0.15}
          className="pointer-events-none"
        />
      )}

      {/* Ambient Spatial Proximity Field Glow */}
      {attentionWeight > 0.1 && (
        <circle
          cx={0}
          cy={0}
          r={totalRakeLength / 2 + 16 + attentionWeight * 14}
          fill={priorityColor}
          fillOpacity={attentionWeight * 0.15}
          className="pointer-events-none"
        />
      )}

      {/* Focus Selection Outline */}
      {isFocused && (
        <rect
          x={-totalRakeLength / 2 - 6}
          y={-12}
          width={totalRakeLength + 12}
          height={24}
          rx={6}
          fill="none"
          stroke={priorityColor}
          strokeWidth={1.5}
          strokeDasharray="4,2"
          opacity={0.9}
        />
      )}

      {/* MULTI-SEGMENT TRAIN RAKE */}
      <g className="train-rake-silhouette">
        {/* Trailing Coach Segments */}
        {Array.from({ length: coachCount }).map((_, idx) => {
          // Coaches are ordered trailing behind the locomotive
          const coachX = isUp
            ? startX + idx * (coachWidth + coachGap)
            : startX - idx * (coachWidth + coachGap) - coachWidth;

          const isRearCoach = idx === 0;

          return (
            <g key={idx}>
              {/* Coach Body */}
              <rect
                x={coachX}
                y={-coachHeight / 2}
                width={coachWidth}
                height={coachHeight}
                rx={2}
                fill="#181C19"
                stroke={statusColor}
                strokeWidth={1}
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
              />
              {/* Coach Window Notch */}
              <rect
                x={coachX + 2}
                y={-2}
                width={coachWidth - 4}
                height={4}
                rx={1}
                fill={priorityColor}
                fillOpacity={0.8}
              />
              {/* Rear Red Marker Lamps on trailing end */}
              {isRearCoach && (
                <circle
                  cx={isUp ? coachX + 1 : coachX + coachWidth - 1}
                  cy={0}
                  r={1.2}
                  fill="#FF3333"
                />
              )}
              {/* Coupler link */}
              {idx < coachCount - 1 && (
                <line
                  x1={isUp ? coachX + coachWidth : coachX}
                  y1={0}
                  x2={isUp ? coachX + coachWidth + coachGap : coachX - coachGap}
                  y2={0}
                  stroke="#5A675D"
                  strokeWidth={1.5}
                />
              )}
            </g>
          );
        })}

        {/* Coupler to Locomotive */}
        <line
          x1={isUp ? startX + coachCount * (coachWidth + coachGap) - coachGap : startX - coachCount * (coachWidth + coachGap) + coachGap}
          y1={0}
          x2={isUp ? startX + coachCount * (coachWidth + coachGap) : startX - coachCount * (coachWidth + coachGap)}
          y2={0}
          stroke="#5A675D"
          strokeWidth={1.5}
        />

        {/* Leading Locomotive Segment */}
        {isUp ? (
          <g transform={`translate(${totalRakeLength / 2 - locoWidth}, ${-locoHeight / 2})`}>
            {/* Aerodynamic / Angled Loco Nose */}
            <path
              d={`M 0 0 L ${locoWidth - 5} 0 L ${locoWidth} ${locoHeight / 2} L ${locoWidth - 5} ${locoHeight} L 0 ${locoHeight} Z`}
              fill="#0B0D0A"
              stroke={priorityColor}
              strokeWidth={1.5}
              filter="drop-shadow(0 2px 6px rgba(0,0,0,0.9))"
            />
            {/* Windshield */}
            <polygon
              points={`${locoWidth - 7}, 2 ${locoWidth - 2}, ${locoHeight / 2} ${locoWidth - 7}, ${locoHeight - 2}`}
              fill="#FF8C1A"
              fillOpacity={0.9}
            />
            {/* High-Intensity Forward Headlight */}
            <circle cx={locoWidth - 1} cy={locoHeight / 2} r={1.5} fill="#FFF9D2" />
          </g>
        ) : (
          <g transform={`translate(${-totalRakeLength / 2}, ${-locoHeight / 2})`}>
            {/* Aerodynamic / Angled Loco Nose (Facing Left) */}
            <path
              d={`M 5 0 L ${locoWidth} 0 L ${locoWidth} ${locoHeight} L 5 ${locoHeight} L 0 ${locoHeight / 2} Z`}
              fill="#0B0D0A"
              stroke={priorityColor}
              strokeWidth={1.5}
              filter="drop-shadow(0 2px 6px rgba(0,0,0,0.9))"
            />
            {/* Windshield */}
            <polygon
              points={`7, 2 2, ${locoHeight / 2} 7, ${locoHeight - 2}`}
              fill="#FF8C1A"
              fillOpacity={0.9}
            />
            {/* High-Intensity Forward Headlight */}
            <circle cx={1} cy={locoHeight / 2} r={1.5} fill="#FFF9D2" />
          </g>
        )}
      </g>

      {/* Train Number Label badge above rake */}
      <g transform="translate(0, -14)">
        <rect
          x={-24}
          y={-7}
          width={48}
          height={14}
          rx={3}
          fill="#121513"
          stroke="#232A25"
          strokeWidth={1}
        />
        <text
          x={0}
          y={3}
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="800"
          fontFamily="monospace"
          fill="#E2E8E4"
        >
          {train.train_number}
        </text>
      </g>

      {/* Interactive Telemetry & Motion Badge below rake */}
      <g transform="translate(0, 16)">
        <rect
          x={-34}
          y={-6}
          width={68}
          height={13}
          rx={3}
          fill="#0B0D0A"
          stroke={isHighDelay ? "#FF8C1A" : "#232A25"}
          strokeWidth={1}
        />
        <text
          x={0}
          y={3.5}
          textAnchor="middle"
          fontSize="7"
          fontWeight="700"
          fontFamily="monospace"
          fill={motionBadgeColor}
        >
          {Math.round(train.current_speed_kmh)}k • {motionBadge}
        </text>
      </g>
    </g>
  );
};
