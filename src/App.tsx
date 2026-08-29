import React, { useEffect, useState, useRef, useCallback } from "react";
import type { 
  Train, TrackBlock, Station, OperationalKPIs, PredictedConflict, 
  Recommendation, Disruption, Signal 
} from "./types/railway";
import { 
  fetchState, fetchTopology, fetchBenchmarks, controlSimulation, injectDisruption, submitControllerDecision,
  setOperatorRole, WS_BASE 
} from "./services/api";
import { canPerform } from "./services/permissions";
import type { OperatorRole } from "./services/permissions";
import type { SelectedRailwayEntity } from "./components/NXPanel/NXTrackCanvas";
import type { TeleprinterLog } from "./components/Teleprinter/TrafficTeleprinter";
import { CounterfactualModal } from "./components/Teleprinter/CounterfactualModal";
import { AIDecisionReviewCenter } from "./components/AIDecisionReviewCenter";
import { WhatIfLab } from "./components/WhatIfLab";
import { AnalyticsView } from "./components/AnalyticsView";
import { AuditLogView } from "./components/AuditLogView";
import { AssistantModal } from "./components/AssistantModal";
import { CommandPaletteModal } from "./components/CommandPaletteModal";
import { OCCShell } from "./components/OCC/OCCShell";
import { InteractionProvider } from "./interaction/InteractionProvider";
import { LandingCinematic } from "./screens/LandingCinematic/LandingCinematic";
import { ColdOpen } from "./screens/ColdOpen/ColdOpen";
import { TrafficTheaterScreen } from "./screens/TrafficTheater/TrafficTheaterScreen";
import { FocusManager } from "./interaction/FocusManager";
import { WelcomeChoiceModal } from "./components/Landing/WelcomeChoiceModal";

export const App: React.FC = () => {
  const [appPhase, setAppPhase] = useState<"choice" | "cinematic" | "coldOpen" | "occ">("choice");
  const [activeTab, setActiveTab] = useState<"theater" | "control" | "review" | "what-if" | "analytics" | "audit">("control");

  useEffect(() => {
    try {
      const completed = localStorage.getItem("railopt_first_run_completed");
      const preferred = localStorage.getItem("railopt_preferred_landing");
      if (completed === "true" && (preferred === "cinematic" || preferred === "occ")) {
        setAppPhase(preferred);
      }
    } catch {
      // Safe catch for environments with restricted localStorage
    }
  }, []);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [trains, setTrains] = useState<Train[]>([]);
  const [blocks, setBlocks] = useState<TrackBlock[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [kpis, setKpis] = useState<OperationalKPIs | null>(null);
  const [safetyInvariants, setSafetyInvariants] = useState<{ checked: number; passed: number; failed: number; percentage: number } | null>(null);
  const [predictedConflicts, setPredictedConflicts] = useState<PredictedConflict[]>([]);
  const [activeRecommendations, setActiveRecommendations] = useState<Recommendation[]>([]);
  const [, setDisruptions] = useState<Disruption[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [teleprinterLogs, setTeleprinterLogs] = useState<TeleprinterLog[]>([]);
  const [simTimeFormatted, setSimTimeFormatted] = useState("00:00:00");
  const [, setSimTimeSec] = useState(0);
  const [controlStatus, setControlStatus] = useState<string | null>(null);
  const [controlPending, setControlPending] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [timeScale, setTimeScale] = useState(1);
  const [connectionStatus, setConnectionStatus] = useState<"CONNECTING" | "LIVE" | "RECONNECTING" | "OFFLINE">("CONNECTING");
  const [currentRoleState, setCurrentRoleState] = useState<OperatorRole>("Controller");
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantInitialQuery, setAssistantInitialQuery] = useState<string | undefined>(undefined);
  const [isCounterfactualOpen, setIsCounterfactualOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [demoStep, setDemoStep] = useState(1);
  const [decisionRippleActive, setDecisionRippleActive] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<SelectedRailwayEntity | null>(null);

  // Authoritative simulation clock references to eliminate frontend local timer drift
  const authoritativeSimTimeRef = useRef(0);
  const authoritativeReceivedAtRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const hasStartedLiveWorldRef = useRef(false);

  const handleRoleChange = (role: OperatorRole) => {
    setOperatorRole(role);
    setCurrentRoleState(role);
  };

  // Derived permission booleans
  const canControlSim = canPerform(currentRoleState, "controlSimulation");
  const canApprove = canPerform(currentRoleState, "approveDecision");
  const canInjectDisruption = canPerform(currentRoleState, "injectDisruption");

  // Centralized authoritative simulation control pipeline
  const runControlAction = useCallback(async (
    action: "START" | "PAUSE" | "RESET" | "SET_SCALE" | "JUMP_TO_TIME" | "JUMP_TO_DEMO" | "JUMP_TO_NEXT_CONFLICT" | "JUMP_TO_NEXT_EVENT",
    scale?: number,
    targetTimeSec?: number,
    eventType?: string
  ) => {
    setControlPending(true);
    setControlStatus("SYNCING WITH SIMULATION ENGINE...");
    try {
      const res = await controlSimulation(action, scale ?? timeScale, targetTimeSec, eventType);
      if (res && res.status === "SUCCESS") {
        setIsRunning(res.is_running);
        if (res.time_scale) setTimeScale(res.time_scale);

        // Immediate authoritative state refresh
        const refreshed = await fetchState();
        if (refreshed) {
          setTrains(refreshed.trains || []);
          setBlocks(refreshed.blocks || []);
          if (refreshed.kpis) setKpis(refreshed.kpis);
          if (refreshed.sim_time_sec !== undefined) {
            authoritativeSimTimeRef.current = refreshed.sim_time_sec;
            authoritativeReceivedAtRef.current = performance.now();
            setSimTimeSec(refreshed.sim_time_sec);
          }
          if (refreshed.sim_time_formatted) setSimTimeFormatted(refreshed.sim_time_formatted);
          if (refreshed.active_recommendations) setActiveRecommendations(refreshed.active_recommendations);
          if (action === "RESET") setTeleprinterLogs([]);
        }

        const msg = action === "START"
          ? "Simulation running"
          : action === "PAUSE"
          ? "Simulation paused"
          : action === "RESET"
          ? "Simulation reset to T+0s"
          : action === "JUMP_TO_DEMO"
          ? `Jumped to demo operational window at T+${Math.round(refreshed?.sim_time_sec || 600)}s`
          : action === "JUMP_TO_NEXT_CONFLICT"
          ? `Jumped to active predicted conflict at T+${Math.round(refreshed?.sim_time_sec || 0)}s`
          : action === "JUMP_TO_NEXT_EVENT"
          ? `Jumped to next ${eventType || 'event'} at T+${Math.round(refreshed?.sim_time_sec || 0)}s`
          : `Simulation speed set to ${scale}x`;
        setControlStatus(msg);
        setTimeout(() => setControlStatus(null), 2500);
      }
    } catch (err) {
      setControlStatus(`Control Error: ${(err as Error).message}`);
      setTimeout(() => setControlStatus(null), 4000);
    } finally {
      setControlPending(false);
    }
  }, [timeScale]);

  const handleTogglePlay = useCallback(() => runControlAction(isRunning ? "PAUSE" : "START"), [runControlAction, isRunning]);
  const handleScaleChange = useCallback((scale: number) => {
    setTimeScale(scale);
    runControlAction("SET_SCALE", scale);
  }, [runControlAction]);
  const handleReset = useCallback(() => runControlAction("RESET", 1), [runControlAction]);

  // First visit enters an already-moving, deterministic operational window.
  // This deliberately replaces the old static dashboard arrival state.
  useEffect(() => {
    if (appPhase !== "occ" || hasStartedLiveWorldRef.current || !canControlSim || connectionStatus !== "LIVE") return;
    hasStartedLiveWorldRef.current = true;
    void (async () => {
      await runControlAction("JUMP_TO_DEMO", 1, 600);
      await runControlAction("START", 1);
      setActiveTab("control");
    })();
  }, [appPhase, canControlSim, connectionStatus, runControlAction]);

  const handleExplainEntity = (entity: SelectedRailwayEntity) => {
    let q = "Review current operational status";
    if (entity.type === "TRAIN") {
      q = `Explain operational status, current speed, and delay risk for train ${entity.data.train_number} (${entity.data.train_name})`;
    } else if (entity.type === "BLOCK") {
      q = `Explain occupancy, speed limits, and signal protection on track block ${entity.data.name || entity.data.id}`;
    } else if (entity.type === "SIGNAL") {
      q = `Explain signal ${entity.data.signalId} aspect (${entity.data.aspect}) and interlocking protection on block ${entity.data.blockId}`;
    } else if (entity.type === "CONFLICT") {
      q = `Explain root cause, headway impact, and solver recommendations for crossing conflict ${entity.data.conflict_id}`;
    } else if (entity.type === "STATION") {
      q = `Explain loop track availability and platform operations at station ${entity.data.name} (${entity.data.code})`;
    }
    setAssistantInitialQuery(q);
    setIsAssistantOpen(true);
  };

  const handleSimulateEntityInWhatIf = (_entity: SelectedRailwayEntity) => {
    setActiveTab("what-if");
  };

  const handleOpenAssistant = (queryText?: string) => {
    setAssistantInitialQuery(queryText);
    setIsAssistantOpen(true);
  };

  // Authoritative clock frame interpolation (no independent clock drift)
  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      const elapsedWallSec = (performance.now() - authoritativeReceivedAtRef.current) / 1000;
      const estimated = authoritativeSimTimeRef.current + elapsedWallSec * timeScale;
      setSimTimeSec(estimated);
      const hours = Math.floor(estimated / 3600);
      const minutes = Math.floor((estimated % 3600) / 60);
      const seconds = Math.floor(estimated % 60);
      setSimTimeFormatted(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    }, 50);
    return () => clearInterval(timer);
  }, [isRunning, timeScale]);

  // Global Operational Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";

      // Ctrl/Cmd + K: Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Ctrl/Cmd + Shift + D: Presentation Mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setIsPresentationMode((prev) => !prev);
        return;
      }

      if (isInput) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (canControlSim && !controlPending) handleTogglePlay();
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        if (canControlSim && !controlPending) handleReset();
      } else if (e.key.toLowerCase() === "o") {
        e.preventDefault();
        setActiveTab("review");
      } else if (e.key.toLowerCase() === "w") {
        e.preventDefault();
        setActiveTab("what-if");
      } else if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        setActiveTab("review");
      } else if (e.key === "Escape") {
        setSelectedEntity(null);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isRunning, controlPending, canControlSim, handleTogglePlay, handleReset]);

  // Fetch initial topology and state
  useEffect(() => {
    fetchTopology()
      .then((top) => {
        if (top && top.stations) setStations(top.stations);
        if (top && top.blocks) setBlocks(top.blocks);
        if (top && top.signals) setSignals(top.signals);
      })
      .catch(console.error);

    fetchBenchmarks()
      .then((b) => {
        if (b && b.safety_invariants) setSafetyInvariants(b.safety_invariants);
      })
      .catch(console.error);

    fetchState()
      .then((data) => {
        if (data) {
          setTrains(data.trains || []);
          if (data.blocks) setBlocks(data.blocks);
          if ((data as any).signals) setSignals((data as any).signals);
          if (data.kpis) setKpis(data.kpis);
          setPredictedConflicts(data.predicted_conflicts || []);
          setActiveRecommendations(data.active_recommendations || []);
          setDisruptions(data.disruptions || []);
          if (data.sim_time_sec !== undefined) {
            authoritativeSimTimeRef.current = data.sim_time_sec;
            authoritativeReceivedAtRef.current = performance.now();
            setSimTimeSec(data.sim_time_sec);
          }
          setSimTimeFormatted(data.sim_time_formatted || "00:00:00");
          setIsRunning(data.is_running || false);
        }
      })
      .catch(console.error);

    let retryDelay = 1000;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    const connectWS = () => {
      try {
        const ws = new WebSocket(WS_BASE);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnectionStatus("LIVE");
          retryDelay = 1000;
          heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send("PING");
            }
          }, 15000);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "INITIAL_STATE" || msg.type === "STATE_UPDATE") {
              const d = msg.data;
              if (d.trains) setTrains(d.trains);
              if (d.blocks) setBlocks(d.blocks);
              if (d.signals) setSignals(d.signals);
              if (d.kpis) setKpis(d.kpis);
              if (d.predicted_conflicts) setPredictedConflicts(d.predicted_conflicts);
              if (d.active_recommendations) setActiveRecommendations(d.active_recommendations);
              if (d.disruptions) setDisruptions(d.disruptions);
              if (d.sim_time_sec !== undefined) {
                authoritativeSimTimeRef.current = d.sim_time_sec;
                authoritativeReceivedAtRef.current = performance.now();
                setSimTimeSec(d.sim_time_sec);
              }
              if (d.sim_time_formatted) setSimTimeFormatted(d.sim_time_formatted);
              if (d.is_running !== undefined) setIsRunning(d.is_running);
            } else if (msg.type === "SIM_EVENT") {
              const ev = msg.data;
              setEvents((prev) => [ev, ...prev.slice(0, 19)]);
              
              // Forward real solver and dispatch events to teleprinter
              if (ev.event_type === "RECOMMENDATION_CREATED") {
                const rec = ev.payload;
                const solverName = rec?.solver_name || "CP-SAT";
                const solverStatus = rec?.solver_status || "STATUS_AVAILABLE";
                const objectiveStr = rec?.optimization_objective_score !== undefined
                  ? ` (J=${rec.optimization_objective_score})`
                  : "";
                setTeleprinterLogs((prev) => [
                  ...prev,
                  {
                    id: `TEL_${Date.now()}_1`,
                    timestamp: new Date().toTimeString().slice(0, 8),
                    type: "CANDIDATE",
                    message: `CONFLICT DETECTED • INITIATING ${solverName.toUpperCase()} RE-OPTIMIZATION`
                  },
                  {
                    id: `TEL_${Date.now()}_2`,
                    timestamp: new Date().toTimeString().slice(0, 8),
                    type: solverStatus === "OPTIMAL" ? "OPTIMAL" : "FEASIBLE",
                    message: `${solverName} SOLUTION CONVERGED [${solverStatus}]${objectiveStr} • ACTION: ${rec?.action || "HOLD"} ${rec?.primary_train_id || ""}`
                  },
                  {
                    id: `TEL_${Date.now()}_3`,
                    timestamp: new Date().toTimeString().slice(0, 8),
                    type: "SAFETY_PASS",
                    message: `SAFETY INVARIANTS CHECKED • ${rec?.safety_valid ? "PASSED (0 VIOLATIONS)" : "FAILED"}`
                  }
                ]);
              } else if (ev.event_type === "OPTIMIZER_TRACE") {
                const trace = ev.payload?.trace;
                if (trace && trace.candidate_logs) {
                  const bestId = trace.best_candidate_id;
                  const candidateLogs: TeleprinterLog[] = trace.candidate_logs.map((c: any, i: number) => {
                    const isBest = c.candidate_id === bestId;
                    const logType: TeleprinterLog["type"] = isBest ? "BEST" : (c.is_valid ? "FEASIBLE" : "REJECTED");
                    return {
                      id: `TEL_TRACE_${Date.now()}_${i}`,
                      timestamp: new Date().toTimeString().slice(0, 8),
                      type: logType,
                      message: `CANDIDATE ${c.candidate_id}: ${c.description} • J=${Number(c.objective_score).toFixed(1)} • ${isBest ? "SELECTED OPTIMUM" : (c.is_valid ? "FEASIBLE" : `REJECTED (${c.rejection_reason || "SAFETY VIOLATION"})`)}`
                    };
                  });
                  setTeleprinterLogs((prev) => [...prev, ...candidateLogs]);
                }
              } else if (ev.event_type === "DECISION_APPROVED") {
                setTeleprinterLogs((prev) => [
                  ...prev,
                  {
                    id: `TEL_${Date.now()}`,
                    timestamp: new Date().toTimeString().slice(0, 8),
                    type: "DECISION",
                    message: `CONTROLLER APPROVED DISPATCH ACTION • AUDIT LOGGED & STATE UPDATED`
                  }
                ]);
              }
            }
          } catch (err) {
            console.error("WS Parse error:", err);
          }
        };

        ws.onclose = () => {
          setConnectionStatus("RECONNECTING");
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          reconnectTimeout = setTimeout(connectWS, retryDelay);
          retryDelay = Math.min(10000, retryDelay * 1.5);
        };

        ws.onerror = () => {
          setConnectionStatus("OFFLINE");
        };
      } catch {
        setConnectionStatus("OFFLINE");
      }
    };

    connectWS();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, []);

  // Lightweight REST state polling fallback when WebSocket is not LIVE
  useEffect(() => {
    if (connectionStatus === "LIVE") return;
    const pollInterval = setInterval(() => {
      fetchState()
        .then((data) => {
          if (data) {
            if (data.trains) setTrains(data.trains);
            if (data.blocks) setBlocks(data.blocks);
            if (data.kpis) setKpis(data.kpis);
            if (data.predicted_conflicts) setPredictedConflicts(data.predicted_conflicts);
            if (data.active_recommendations) setActiveRecommendations(data.active_recommendations);
            if (data.sim_time_sec !== undefined) {
              authoritativeSimTimeRef.current = data.sim_time_sec;
              authoritativeReceivedAtRef.current = performance.now();
              setSimTimeSec(data.sim_time_sec);
            }
            if (data.sim_time_formatted) setSimTimeFormatted(data.sim_time_formatted);
            if (data.is_running !== undefined) setIsRunning(data.is_running);
          }
        })
        .catch(() => {});
    }, 1500);
    return () => clearInterval(pollInterval);
  }, [connectionStatus]);

  const handleDecision = async (
    action: "APPROVE" | "REJECT" | "OVERRIDE",
    overrideReason?: string,
    selectedCandidateId?: string
  ) => {
    const currentRec = activeRecommendations[0];
    if (!currentRec) return;
    try {
      setDecisionError(null);
      if (action === "APPROVE") {
        setDecisionRippleActive(true);
        setTimeout(() => setDecisionRippleActive(false), 3000);
      }
      const res = await submitControllerDecision(currentRec.recommendation_id, action, overrideReason, selectedCandidateId);
      if (res && res.status === "SUCCESS") {
        setActiveRecommendations((prev) => prev.filter((r) => r.recommendation_id !== currentRec.recommendation_id));
        const data = await fetchState();
        if (data) {
          setTrains(data.trains || []);
          if (data.kpis) setKpis(data.kpis);
        }
      }
    } catch (e: any) {
      const errorMsg = e?.detail || e?.message || "Decision rejected by safety interlocking.";
      console.error("Decision action error:", e);
      setDecisionError(errorMsg);
    }
  };

  const executeDemoStep = async (step: number) => {
    setDemoStep(step);
    // Ensure demo runs with Supervisor privileges
    handleRoleChange("Supervisor");

    if (step === 1) {
      await handleReset();
      await runControlAction("JUMP_TO_DEMO", 2, 600);
      await runControlAction("START", 2);
      setActiveTab("control");
    } else if (step === 2) {
      const activeTrain = trains.find((t) => t.status === "RUNNING") || trains[0];
      const targetTrain = activeTrain ? activeTrain.train_id : "T22436";
      await injectDisruption({
        disruption_type: "TRAIN_DELAY",
        target_id: targetTrain,
        duration_sec: 900,
        description: `OHE Overhead Line Fluctuation on ${targetTrain}`
      });
      setActiveTab("control");
    } else if (step === 3) {
      await runControlAction("JUMP_TO_NEXT_CONFLICT", 2);
      setActiveTab("control");
    } else if (step === 4) {
      if (activeRecommendations.length > 0) {
        await handleDecision("APPROVE");
      }
      setActiveTab("control");
    } else if (step === 5) {
      setActiveTab("what-if");
    } else if (step === 6) {
      setActiveTab("analytics");
    }
  };

  const handleLocateTrain = (trainId: string) => {
    setActiveTab("control");
    const t = trains.find((tr) => tr.train_id === trainId);
    if (t) {
      setSelectedEntity({ type: "TRAIN", id: t.train_id, data: t });
    }
    FocusManager.locateTrain(trainId, t?.current_position_km);
  };

  const handleInjectDisruption = async (type: string, targetId: string) => {
    if (!canInjectDisruption) return;
    try {
      await injectDisruption({
        disruption_type: type,
        target_id: targetId,
        duration_sec: 300,
        description: `Section Controller manual disruption on ${targetId}`
      });
      const data = await fetchState();
      if (data) {
        setTrains(data.trains || []);
        setBlocks(data.blocks || []);
        if (data.kpis) setKpis(data.kpis);
      }
    } catch (e) {
      console.error("Disruption injection error:", e);
    }
  };

  const handleEventClick = (ev: any) => {
    setActiveTab("control");
    const p = ev.payload;
    if (p?.primary_train_id || p?.train_id) {
      const tId = p.primary_train_id || p.train_id;
      const t = trains.find((tr) => tr.train_id === tId);
      if (t) {
        setSelectedEntity({ type: "TRAIN", id: t.train_id, data: t });
      }
    } else if (p?.location_block_id || p?.block_id) {
      const bId = p.location_block_id || p.block_id;
      const b = blocks.find((blk) => blk.id === bId);
      if (b) {
        setSelectedEntity({ type: "BLOCK", id: b.id, data: b });
      }
    }
  };

  const handleExecutePaletteAction = (actionId: string) => {
    if (actionId === "action_toggle_sim") {
      if (canControlSim && !controlPending) handleTogglePlay();
    } else if (actionId === "action_reset_sim") {
      if (canControlSim && !controlPending) handleReset();
    } else if (actionId === "action_jump_demo") {
      if (canControlSim && !controlPending) runControlAction("JUMP_TO_DEMO", 2, 600);
    } else if (actionId === "action_jump_conflict") {
      if (canControlSim && !controlPending) runControlAction("JUMP_TO_NEXT_CONFLICT", 2);
    } else if (actionId === "action_optimize") {
      setActiveTab("review");
    } else if (actionId === "action_review") {
      setActiveTab("review");
    } else if (actionId === "action_whatif") {
      setActiveTab("what-if");
    } else if (actionId === "action_analytics") {
      setActiveTab("analytics");
    } else if (actionId === "action_cinematic_replay") {
      setAppPhase("cinematic");
    } else if (actionId === "action_presentation") {
      setIsPresentationMode((prev) => !prev);
    }
  };

  return (
    <InteractionProvider>
      {appPhase === "choice" ? (
        <WelcomeChoiceModal
          isOpen={true}
          onSelectCinematic={() => setAppPhase("cinematic")}
          onSelectOCC={() => setAppPhase("occ")}
        />
      ) : appPhase === "cinematic" ? (
        <LandingCinematic onComplete={() => setAppPhase("coldOpen")} />
      ) : appPhase === "coldOpen" ? (
        <ColdOpen onComplete={() => setAppPhase("occ")} />
      ) : (
        <div className={isPresentationMode ? "presentation-mode-active select-none" : "select-none"}>
          <OCCShell
            activeMode={activeTab}
            onSelectMode={setActiveTab}
            trains={trains}
            blocks={blocks}
            stations={stations}
            signals={signals}
            kpis={kpis}
            safetyInvariants={safetyInvariants}
            predictedConflicts={predictedConflicts}
            activeRecommendations={activeRecommendations}
            teleprinterLogs={teleprinterLogs}
            events={events}
            simTimeFormatted={simTimeFormatted}
            isRunning={isRunning}
            timeScale={timeScale}
            connectionStatus={connectionStatus}
            currentRole={currentRoleState}
            onRoleChange={handleRoleChange}
            demoStep={demoStep}
            onExecuteDemoStep={executeDemoStep}
            onOpenCopilot={() => handleOpenAssistant()}
            selectedEntity={selectedEntity}
            onSelectEntity={setSelectedEntity}
            onTogglePlay={handleTogglePlay}
            onScaleChange={handleScaleChange}
            onReset={handleReset}
            canControlSimulation={canControlSim && !controlPending}
            canApproveDecision={canApprove}
            canInjectDisruption={canInjectDisruption}
            controlStatus={controlPending ? "SYNCING WITH SIMULATION ENGINE..." : controlStatus}
            decisionRippleActive={decisionRippleActive}
            onDecision={handleDecision}
            onTriggerDisruption={handleInjectDisruption}
            onExplainEntity={handleExplainEntity}
            onSimulateInWhatIf={handleSimulateEntityInWhatIf}
            onOpenCounterfactual={() => setIsCounterfactualOpen(true)}
            onEventClick={handleEventClick}
            onReplayStory={() => setAppPhase("cinematic")}
          >
            {activeTab === "theater" && (
              <TrafficTheaterScreen
                trains={trains}
                blocks={blocks}
                stations={stations}
                kpis={kpis}
                predictedConflicts={predictedConflicts}
                selectedEntity={selectedEntity}
                isRunning={isRunning}
                timeScale={timeScale}
                simTimeFormatted={simTimeFormatted}
                events={events}
                onTogglePlay={handleTogglePlay}
                onReset={handleReset}
                onScaleChange={handleScaleChange}
                onSelectEntity={setSelectedEntity}
                onSelectTrain={(t) => setSelectedEntity({ type: "TRAIN", id: t.train_id, data: t })}
                onTriggerDisruption={handleInjectDisruption}
                onFastForwardDemo={() => runControlAction("JUMP_TO_DEMO", 2, 600)}
                onJumpNextConflict={() => runControlAction("JUMP_TO_NEXT_CONFLICT", 2)}
                onSeekSimTime={(targetSec) => runControlAction("JUMP_TO_TIME", 2, targetSec)}
                onJumpToEvent={(eventType) => runControlAction("JUMP_TO_NEXT_EVENT", 2, undefined, eventType)}
              />
            )}

            {activeTab === "review" && (
              <AIDecisionReviewCenter
                recommendation={activeRecommendations[0] || null}
                trains={trains}
                blocks={blocks}
                onDecision={handleDecision}
                onLocateTrain={handleLocateTrain}
                canApproveDecision={canApprove}
                decisionError={decisionError}
              />
            )}

            {activeTab === "what-if" && (
              <WhatIfLab trains={trains} blocks={blocks} />
            )}

            {activeTab === "analytics" && (
              <AnalyticsView onSimulateInWhatIf={() => setActiveTab("what-if")} />
            )}

            {activeTab === "audit" && (
              <AuditLogView onLocateTrain={handleLocateTrain} />
            )}
          </OCCShell>

          {/* Command Palette Modal (Ctrl+K) */}
          <CommandPaletteModal
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            trains={trains}
            blocks={blocks}
            predictedConflicts={predictedConflicts}
            onSelectTrain={(train) => {
              setSelectedEntity({ type: "TRAIN", id: train.train_id, data: train });
              setActiveTab("control");
            }}
            onSelectBlock={(block) => {
              setSelectedEntity({ type: "BLOCK", id: block.id, data: block });
              setActiveTab("control");
            }}
            onSelectConflict={(conflict) => {
              setSelectedEntity({ type: "CONFLICT", id: conflict.conflict_id, data: conflict });
              setActiveTab("control");
            }}
            onExecuteAction={handleExecutePaletteAction}
          />

          {/* Counterfactual Explanation Modal */}
          <CounterfactualModal
            isOpen={isCounterfactualOpen}
            onClose={() => setIsCounterfactualOpen(false)}
            recommendation={activeRecommendations[0] || null}
          />

          {/* AI Copilot Natural Language Assistant Modal */}
          <AssistantModal
            isOpen={isAssistantOpen}
            onClose={() => {
              setIsAssistantOpen(false);
              setAssistantInitialQuery(undefined);
            }}
            onNavigateToReview={() => setActiveTab("review")}
            onLocateTrain={handleLocateTrain}
            initialQuery={assistantInitialQuery}
          />
        </div>
      )}
    </InteractionProvider>
  );
};

export default App;
