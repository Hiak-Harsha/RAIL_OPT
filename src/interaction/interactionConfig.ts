export const INTERACTION_CONFIG = {
  // Proximity Radii in SVG units / px
  awarenessRadius: 120,
  focusRadius: 52,
  relatedRadius: 180,

  // Spring Physics Constants
  spring: {
    stiffness: 260,
    damping: 26,
    mass: 0.45,
  },

  // Scoring Weights for Attention Engine
  weights: {
    proximity: 0.45,
    severity: 0.20,
    relationship: 0.20,
    operational: 0.15,
  },

  // Visual Response Multipliers
  response: {
    maxScale: 1.08,
    awareScale: 1.03,
    maxGlow: 0.9,
    maxLabelOpacity: 1.0,
    awareLabelOpacity: 0.7,
  },

  // Magnetic Strengths by Tier
  magnetic: {
    primaryStrength: 14,
    secondaryStrength: 6,
    safetyAckGlowRadius: 24,
  },

  // Tooltip Delays (ms)
  delays: {
    awarenessTooltipMs: 120,
    focusTooltipMs: 0,
    decayMs: 300,
  }
} as const;

export type InteractionState = "ambient" | "aware" | "focused" | "selected";
