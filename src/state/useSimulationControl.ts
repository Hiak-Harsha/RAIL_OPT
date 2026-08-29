import { useState, useCallback } from "react";

const REST_API_BASE = "http://127.0.0.1:8000";

export type SeekingStatus = "IDLE" | "SEEKING" | "COMPLETE";

export function useSimulationControl(userRole: string = "Controller") {
  const [seekingStatus, setSeekingStatus] = useState<SeekingStatus>("IDLE");

  const runControlAction = useCallback(async (
    action: string,
    timeScale?: number,
    targetTimeSec?: number,
    eventType?: string
  ) => {
    setSeekingStatus("SEEKING");
    try {
      const body: Record<string, any> = { action };
      if (timeScale !== undefined) body.time_scale = timeScale;
      if (targetTimeSec !== undefined) body.target_time_sec = targetTimeSec;
      if (eventType !== undefined) body.event_type = eventType;

      const res = await fetch(`${REST_API_BASE}/api/simulation/control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": userRole
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setSeekingStatus("COMPLETE");
        setTimeout(() => setSeekingStatus("IDLE"), 1500);
      } else {
        setSeekingStatus("IDLE");
      }
    } catch {
      setSeekingStatus("IDLE");
    }
  }, [userRole]);

  const handleTogglePlay = useCallback((isRunning: boolean) => {
    runControlAction(isRunning ? "PAUSE" : "START");
  }, [runControlAction]);

  const handleReset = useCallback(() => {
    runControlAction("RESET");
  }, [runControlAction]);

  const handleScaleChange = useCallback((scale: number) => {
    runControlAction("SET_SCALE", scale);
  }, [runControlAction]);

  const handleSeekSimTime = useCallback((targetSec: number) => {
    runControlAction("JUMP_TO_TIME", undefined, targetSec);
  }, [runControlAction]);

  const handleJumpToEvent = useCallback((eventType: string) => {
    runControlAction("JUMP_TO_NEXT_EVENT", undefined, undefined, eventType);
  }, [runControlAction]);

  return {
    seekingStatus,
    runControlAction,
    handleTogglePlay,
    handleReset,
    handleScaleChange,
    handleSeekSimTime,
    handleJumpToEvent
  };
}
