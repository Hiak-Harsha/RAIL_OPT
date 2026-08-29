/**
 * PhysicsEngine — Predictive Railway Motion & Trajectory Interpolation.
 * 
 * Provides smooth 60fps continuous predictive positioning for trains
 * between discrete WebSocket / simulator physics ticks.
 */
import type { Train } from "../types/railway";

export interface TrainMotionState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lastUpdateSimTime: number;
}

export class PhysicsEngine {
  private motionStates = new Map<string, TrainMotionState>();

  public updateTrain(
    train: Train,
    targetX: number,
    targetY: number,
    simTimeSec: number
  ): { x: number; y: number } {
    const trainId = train.train_id;
    let state = this.motionStates.get(trainId);

    if (!state) {
      state = {
        x: targetX,
        y: targetY,
        vx: 0,
        vy: 0,
        lastUpdateSimTime: simTimeSec,
      };
      this.motionStates.set(trainId, state);
      return { x: targetX, y: targetY };
    }

    const dt = Math.max(0.016, simTimeSec - state.lastUpdateSimTime);
    const dx = targetX - state.x;
    const dy = targetY - state.y;

    // Exponential smoothing factor
    const alpha = 0.25;
    state.vx = (dx / dt) * alpha + state.vx * (1 - alpha);
    state.vy = (dy / dt) * alpha + state.vy * (1 - alpha);

    // Predict forward slightly to eliminate visual stutter
    state.x = state.x + dx * 0.35;
    state.y = targetY; // Track alignment stays pinned to track rail Y
    state.lastUpdateSimTime = simTimeSec;

    return { x: state.x, y: state.y };
  }

  public reset() {
    this.motionStates.clear();
  }
}

export const globalPhysicsEngine = new PhysicsEngine();
