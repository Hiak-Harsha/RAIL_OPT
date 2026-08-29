import { useContext } from "react";
import { InteractionContext, type InteractionContextType, type PointerState } from "./InteractionContext";

export function usePointerPosition(): InteractionContextType {
  const context = useContext(InteractionContext);
  if (!context) {
    throw new Error("usePointerPosition must be used within an InteractionProvider");
  }
  return context;
}

export type { InteractionContextType, PointerState };
