import React, { useEffect, useRef, useState, useCallback } from "react";
import type { Point } from "./coordinateTransform";
import { InteractionContext } from "./InteractionContext";
import type { PointerState, InteractionContextType } from "./InteractionContext";

export { InteractionContext };
export type { PointerState, InteractionContextType };

export const InteractionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pointerRef = useRef<PointerState>({
    x: -999,
    y: -999,
    vx: 0,
    vy: 0,
    speed: 0,
    isActive: false,
  });

  const subscribersRef = useRef<Set<(state: PointerState) => void>>(new Set());
  const lastTimeRef = useRef<number>(0);
  const lastPosRef = useRef<Point>({ x: -999, y: -999 });

  const [reducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    lastTimeRef.current = performance.now();
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const now = performance.now();
    const lastTime = lastTimeRef.current || now;
    const dt = Math.max(1, now - lastTime) / 1000.0;
    lastTimeRef.current = now;

    const x = e.clientX;
    const y = e.clientY;

    const dx = lastPosRef.current.x >= 0 ? x - lastPosRef.current.x : 0;
    const dy = lastPosRef.current.y >= 0 ? y - lastPosRef.current.y : 0;
    lastPosRef.current = { x, y };

    const vx = dx / dt;
    const vy = dy / dt;
    const speed = Math.hypot(vx, vy);

    pointerRef.current = {
      x,
      y,
      vx,
      vy,
      speed,
      isActive: true,
    };

    // Notify non-React reactive canvas / high-frequency listeners
    subscribersRef.current.forEach((cb) => {
      try {
        cb(pointerRef.current);
      } catch (err) {
        console.error("Pointer subscriber callback error:", err);
      }
    });
  }, []);

  const handlePointerLeave = useCallback(() => {
    pointerRef.current = {
      ...pointerRef.current,
      isActive: false,
    };
    lastPosRef.current = { x: -999, y: -999 };
    subscribersRef.current.forEach((cb) => {
      try {
        cb(pointerRef.current);
      } catch (err) {
        console.error("Pointer leave subscriber error:", err);
      }
    });
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [handlePointerMove, handlePointerLeave]);

  const subscribeToPointerMove = useCallback((callback: (state: PointerState) => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const getPointer = useCallback(() => pointerRef.current, []);

  return (
    <InteractionContext.Provider
      value={{
        pointerRef,
        reducedMotion,
        subscribeToPointerMove,
        getPointer,
      }}
    >
      {children}
    </InteractionContext.Provider>
  );
};

export function usePointerPosition(): InteractionContextType {
  const context = React.useContext(InteractionContext);
  if (!context) {
    throw new Error("usePointerPosition must be used within an InteractionProvider");
  }
  return context;
}
