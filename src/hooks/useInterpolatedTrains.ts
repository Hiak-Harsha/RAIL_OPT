/**
 * RAILOPT-X 2.0 — Real-Time Train Interpolation Hook
 * 
 * Takes raw discrete WebSocket simulation snapshots and produces continuous,
 * fluid 60fps movement across all zoom levels, scales, and time multipliers.
 * Ensures zero desync between 2D schematic, 3D micro view, and corridor radar.
 */

import { useState, useEffect, useRef } from "react";
import type { Train } from "../types/railway";
import { lerp, clamp } from "../utils/interpolation";

export function useInterpolatedTrains(
  rawTrains: Train[],
  isRunning: boolean = true,
  timeScale: number = 1
): Train[] {
  const [interpolatedTrains, setInterpolatedTrains] = useState<Train[]>(rawTrains);
  
  const prevTrainsRef = useRef<Map<string, { posKm: number; speedKmh: number }>>(new Map());
  const nextTrainsRef = useRef<Map<string, { posKm: number; speedKmh: number; isStopped: boolean }>>(new Map());
  const lastSnapshotTimeRef = useRef<number>(performance.now());
  const snapshotIntervalRef = useRef<number>(1000); // estimated ms between WS ticks

  // Update target snapshots when new rawTrains arrive from WebSocket
  useEffect(() => {
    const now = performance.now();
    const elapsedSinceLast = now - lastSnapshotTimeRef.current;
    if (elapsedSinceLast > 50 && elapsedSinceLast < 4000) {
      snapshotIntervalRef.current = elapsedSinceLast;
    }
    lastSnapshotTimeRef.current = now;

    // Current interpolated positions become previous positions
    rawTrains.forEach((t) => {
      const trainKm = t.corridor_position_km ?? t.current_position_km ?? 0;
      const prev = nextTrainsRef.current.get(t.train_id);
      prevTrainsRef.current.set(t.train_id, {
        posKm: prev ? prev.posKm : trainKm,
        speedKmh: prev ? prev.speedKmh : t.current_speed_kmh,
      });

      nextTrainsRef.current.set(t.train_id, {
        posKm: trainKm,
        speedKmh: t.current_speed_kmh,
        isStopped: t.current_speed_kmh < 1 || t.status === "STOPPED" || t.status === "WAITING",
      });
    });
  }, [rawTrains]);

  // RequestAnimationFrame 60fps interpolation loop
  useEffect(() => {
    let animId: number;

    const tick = (now: number) => {
      if (!isRunning) {
        // Paused: hold exact current positions
        animId = requestAnimationFrame(tick);
        return;
      }

      const elapsed = now - lastSnapshotTimeRef.current;
      const expectedInterval = Math.max(100, snapshotIntervalRef.current / Math.max(0.5, timeScale));
      const rawAlpha = elapsed / expectedInterval;
      const alpha = clamp(rawAlpha, 0, 1.25);

      const smoothed = rawTrains.map((train) => {
        const prev = prevTrainsRef.current.get(train.train_id);
        const next = nextTrainsRef.current.get(train.train_id);

        if (!prev || !next) return train;

        // If train is stopped, clamp to target position to prevent signal overshoots
        let currentPosKm: number;
        if (next.isStopped) {
          currentPosKm = next.posKm;
        } else {
          currentPosKm = lerp(prev.posKm, next.posKm, Math.min(1.0, alpha));
        }

        const currentSpeedKmh = lerp(prev.speedKmh, next.speedKmh, Math.min(1.0, alpha));

        return {
          ...train,
          corridor_position_km: currentPosKm,
          current_position_km: currentPosKm,
          current_speed_kmh: currentSpeedKmh,
        };
      });

      setInterpolatedTrains(smoothed);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [rawTrains, isRunning, timeScale]);

  return interpolatedTrains;
}
