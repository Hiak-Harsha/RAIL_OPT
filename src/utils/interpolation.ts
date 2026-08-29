/**
 * RAILOPT-X 2.0 — Math & Linear Interpolation Utilities
 */

export function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function slerpHeading(currentRad: number, targetRad: number, alpha: number): number {
  let diff = targetRad - currentRad;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return currentRad + diff * alpha;
}
