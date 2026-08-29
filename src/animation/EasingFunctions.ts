/**
 * EasingFunctions — Cubic & S-Curve Kinematic Motion Curves for Railway Operations.
 */

export const EasingFunctions = {
  // Speed ramp for acceleration and deceleration
  speedRamp: (t: number): number => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },

  // Cubic ease-in-out for smooth camera panning & focus zooming
  easeInOutCubic: (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 + (t - 1) * Math.pow(2 * t - 2, 2) / 2;
  },

  // Sine pulse for conflict hotspots & safety alerts
  conflictPulse: (t: number): number => {
    return Math.sin(t * Math.PI * 2) * 0.5 + 0.5;
  },
};
