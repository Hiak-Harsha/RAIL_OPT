import { createContext } from "react";
import type React from "react";

export interface PointerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  isActive: boolean;
}

export interface InteractionContextType {
  pointerRef: React.MutableRefObject<PointerState>;
  reducedMotion: boolean;
  subscribeToPointerMove: (callback: (state: PointerState) => void) => () => void;
  getPointer: () => PointerState;
}

export const InteractionContext = createContext<InteractionContextType | null>(null);
