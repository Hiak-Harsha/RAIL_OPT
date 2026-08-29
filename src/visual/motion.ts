/**
 * RAILOPT-X Motion & Physics Interpolation Engine
 */

export const MOTION_PHYSICS = {
  // Train continuous lerp interpolation alpha: p_(t+1) = p_t + alpha * (p_target - p_t)
  lerpAlpha: 0.16,
  lerpThreshold: 0.05,

  // Spatial Proximity Engine Attention Radii (in SVG viewport units)
  proximity: {
    ambientAura: 90,     // Train starts subtle ambient luminance
    routePreview: 55,    // Progressive route path begins to glow
    operationalFocus: 25,// Full operational HUD & signal halos ignite
  },

  // Easing presets
  easings: {
    industrialSpring: "cubic-bezier(0.16, 1, 0.3, 1)",
    pulseGlow: "cubic-bezier(0.4, 0, 0.6, 1)",
    decisionShockwave: "cubic-bezier(0, 0, 0.2, 1)",
  },

  // Durations
  durations: {
    fast: 150,
    normal: 300,
    routeFlow: 1200,
    decisionRipple: 2500,
    ghostCandidateFade: 800,
  },

  // NX OCC 2.0 — Enhanced Motion Parameters
  occ2: {
    typewriterCharDelay: 25,       // ms per character for teleprinter animation
    inspectorSlideMs: 250,         // floating inspector panel slide duration
    rippleStaggerMs: 200,          // stagger between concentric ripple rings
    speedTrailDecay: 0.85,         // alpha decay factor for speed trail wake
    speedTrailMaxLength: 55,       // max SVG units for trailing wake
    blockPulseFrequency: 1.4,      // seconds per occupied block pulse cycle
    rosterCardHoverLift: -1,       // px translateY on hover
  }
} as const;

/**
 * Computes proximity attention weight between 0.0 (far) and 1.0 (dead center)
 */
export function calculateAttentionWeight(distance: number, maxRadius: number = 90): number {
  if (distance >= maxRadius) return 0.0;
  const normalized = 1.0 - (distance / maxRadius);
  return Math.pow(normalized, 1.8); // Non-linear falloff for natural focus feel
}
