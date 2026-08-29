import type { EntityRef } from "./RailwayRenderModel";

/**
 * FocusCommand — discriminated union for all viewport interaction modes.
 *
 * SELECT  : select entity in inspector, no viewport change
 * LOCATE  : select + move viewport (pan + zoom) to entity location
 * FOLLOW  : continuous viewport tracking (per-frame lerp)
 * FRAME_CONFLICT : frame both involved trains + their conflict block
 */
export type FocusCommandType = "SELECT" | "LOCATE" | "FOLLOW" | "FRAME_CONFLICT";

export interface FocusCommand {
  type: FocusCommandType;
  entity: EntityRef | null;
  /** For LOCATE: target KM range centre. Viewport moves to train ± 50km. */
  targetKm?: number;
  /** For FRAME_CONFLICT: both involved entities */
  secondaryEntity?: EntityRef | null;
  /** Which conflict block to frame */
  conflictBlockId?: string;
}

export type FocusListener = (target: EntityRef | null) => void;
export type CommandListener = (command: FocusCommand) => void;

class FocusManagerService {
  private currentFocus: EntityRef | null = null;
  private listeners: Set<FocusListener> = new Set();
  private commandListeners: Set<CommandListener> = new Set();

  public getFocus(): EntityRef | null {
    return this.currentFocus;
  }

  /** Legacy: SELECT-only (no viewport movement) */
  public focus(entity: EntityRef | null) {
    this.currentFocus = entity;
    this.notify();
  }

  /** SELECT only — no viewport movement */
  public select(entity: EntityRef | null) {
    this.currentFocus = entity;
    this.notify();
    this.dispatchCommand({ type: "SELECT", entity });
  }

  /**
   * LOCATE — select + move viewport (pan + zoom 60–100km window) to entity.
   * This is the correct implementation of the "LOCATE ON NX" button.
   */
  public locateTrain(trainId: string, targetKm?: number) {
    const entity: EntityRef = { id: trainId, type: "TRAIN" };
    this.currentFocus = entity;
    this.notify();
    this.dispatchCommand({ type: "LOCATE", entity, targetKm });
  }

  public locateBlock(blockId: string, targetKm?: number) {
    const entity: EntityRef = { id: blockId, type: "BLOCK" };
    this.currentFocus = entity;
    this.notify();
    this.dispatchCommand({ type: "LOCATE", entity, targetKm });
  }

  public locateSignal(signalId: string, targetKm?: number) {
    const entity: EntityRef = { id: signalId, type: "SIGNAL" };
    this.currentFocus = entity;
    this.notify();
    this.dispatchCommand({ type: "LOCATE", entity, targetKm });
  }

  /**
   * FOLLOW — continuous viewport tracking. The canvas will lerp the viewport
   * every frame to keep the train visible at 40% from the left edge.
   */
  public followTrain(trainId: string) {
    const entity: EntityRef = { id: trainId, type: "TRAIN" };
    this.currentFocus = entity;
    this.notify();
    this.dispatchCommand({ type: "FOLLOW", entity });
  }

  public stopFollowing() {
    this.dispatchCommand({ type: "SELECT", entity: null });
  }

  /**
   * FRAME_CONFLICT — frame both trains + the conflict block in the viewport.
   * Uses actual conflict.location_block_id geometry — NOT hardcoded ALJN km.
   */
  public frameConflict(
    conflictBlockId: string,
    train1Id: string,
    train2Id: string,
    conflictKm?: number
  ) {
    const primary: EntityRef = { id: train1Id, type: "TRAIN" };
    const secondary: EntityRef = { id: train2Id, type: "TRAIN" };
    this.currentFocus = primary;
    this.notify();
    this.dispatchCommand({
      type: "FRAME_CONFLICT",
      entity: primary,
      secondaryEntity: secondary,
      conflictBlockId,
      targetKm: conflictKm,
    });
  }

  // ─── Legacy compatibility ────────────────────────────────────────────────

  public focusTrain(trainId: string) {
    this.select({ id: trainId, type: "TRAIN" });
  }

  public focusConflict(conflictId: string) {
    this.select({ id: conflictId, type: "CONFLICT" });
  }

  public focusBlock(blockId: string) {
    this.select({ id: blockId, type: "BLOCK" });
  }

  public focusSignal(signalId: string) {
    this.select({ id: signalId, type: "SIGNAL" });
  }

  public focusStation(stationId: string) {
    this.select({ id: stationId, type: "STATION" });
  }

  public clearFocus() {
    this.currentFocus = null;
    this.notify();
    this.dispatchCommand({ type: "SELECT", entity: null });
  }

  // ─── Subscriber management ───────────────────────────────────────────────

  public subscribe(listener: FocusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribe to FocusCommands — used by NXTrackCanvas to handle
   * LOCATE (viewport pan/zoom), FOLLOW (continuous tracking), and
   * FRAME_CONFLICT (dual-entity framing).
   */
  public subscribeCommands(listener: CommandListener): () => void {
    this.commandListeners.add(listener);
    return () => {
      this.commandListeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentFocus);
      } catch (err) {
        console.error("Error in FocusManager listener:", err);
      }
    });
  }

  private dispatchCommand(command: FocusCommand) {
    this.commandListeners.forEach((listener) => {
      try {
        listener(command);
      } catch (err) {
        console.error("Error in FocusManager command listener:", err);
      }
    });
  }
}

export const FocusManager = new FocusManagerService();
