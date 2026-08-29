/**
 * VisualMode — Unified Global Visual State for RAILOPT-X Digital Twin 2.0.
 * 
 * Regulates visual prominence across all rendering views:
 *   - NORMAL: standard railway overview
 *   - INSPECT: single entity focused, telemetry highlighted
 *   - CONFLICT: conflict hotspot illuminated, opposing trains flagged
 *   - OPTIMIZE: candidate route branches visible, background dimmed
 *   - FUTURE: simulated future branch previewing
 *   - EXECUTION: approved controller action in progress
 *   - REPLAY: historical audit playback active
 */

export type VisualMode =
  | "NORMAL"
  | "INSPECT"
  | "CONFLICT"
  | "OPTIMIZE"
  | "FUTURE"
  | "EXECUTION"
  | "REPLAY";

export interface VisualStateContext {
  mode: VisualMode;
  focusedEntityId?: string;
  focusedConflictId?: string;
  activeBranchId?: string;
  replayTimeSec?: number;
}
