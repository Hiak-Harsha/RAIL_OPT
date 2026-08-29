import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from "react";
import type { Train, TrackBlock, Station, PredictedConflict, Recommendation, OperationalKPIs, AuditLogEntry } from "../types/railway";
import type { SelectedRailwayEntity } from "../components/NXPanel/NXTrackCanvas";
import { fetchState, fetchTopology, controlSimulation, submitControllerDecision, injectDisruption, fetchAuditLogs, setOperatorRole as setApiOperatorRole } from "../services/api";
import { BUILD_ID, SYSTEM_VERSION } from "../buildInfo";
import type { OperatorRole } from "../services/permissions";

export type TabType = "TRAFFIC_WORLD" | "FUTURE_WORLDS" | "AI_COMMAND" | "PERFORMANCE" | "REPLAY";
export type VisualizationMode = "SCHEMATIC" | "HYBRID" | "SPATIAL";
export type ConnectionStatus = "CONNECTED" | "CONNECTING" | "DISCONNECTED" | "POLLING_FALLBACK";

export interface OperationalState {
  // Telemetry & Infrastructure
  trains: Train[];
  blocks: TrackBlock[];
  stations: Station[];
  predictedConflicts: PredictedConflict[];
  activeRecommendations: Recommendation[];
  kpis: OperationalKPIs | null;
  auditLogs: AuditLogEntry[];

  // Simulation Status
  isRunning: boolean;
  timeScale: number;
  simTimeSec: number;
  connectionStatus: ConnectionStatus;

  // Viewport & Navigation
  viewportStartKm: number;
  viewportEndKm: number;
  selectedEntity: SelectedRailwayEntity | null;
  focusedTrainId?: string;
  focusedConflictId?: string;

  // Global App Modes
  activeTab: TabType;
  visualizationMode: VisualizationMode;
  userRole: OperatorRole;
  
  // Future Worlds Active Branch Preview
  activeFutureBranchId?: string;
  isFutureWorldActive: boolean;

  // Metadata
  buildId: string;
  systemVersion: string;
}

type OperationalAction =
  | { type: "SET_FULL_STATE"; payload: Partial<OperationalState> }
  | { type: "UPDATE_TELEMETRY"; payload: { trains: Train[]; blocks: TrackBlock[]; simTimeSec: number; isRunning: boolean; kpis?: any; conflicts?: PredictedConflict[]; recommendations?: Recommendation[] } }
  | { type: "SET_VIEWPORT"; payload: { startKm: number; endKm: number } }
  | { type: "SELECT_ENTITY"; payload: SelectedRailwayEntity | null }
  | { type: "SET_TAB"; payload: TabType }
  | { type: "SET_VISUALIZATION_MODE"; payload: VisualizationMode }
  | { type: "SET_ROLE"; payload: OperatorRole }
  | { type: "SET_CONNECTION_STATUS"; payload: ConnectionStatus }
  | { type: "SET_FUTURE_BRANCH"; payload: { branchId?: string; active: boolean } }
  | { type: "SET_AUDIT_LOGS"; payload: AuditLogEntry[] };

const initialState: OperationalState = {
  trains: [],
  blocks: [],
  stations: [],
  predictedConflicts: [],
  activeRecommendations: [],
  kpis: null,
  auditLogs: [],
  isRunning: false,
  timeScale: 1.0,
  simTimeSec: 0.0,
  connectionStatus: "CONNECTING",
  viewportStartKm: 0.0,
  viewportEndKm: 80.0,
  selectedEntity: null,
  activeTab: "TRAFFIC_WORLD",
  visualizationMode: "SCHEMATIC",
  userRole: "Controller",
  isFutureWorldActive: false,
  buildId: BUILD_ID,
  systemVersion: SYSTEM_VERSION,
};

function operationalReducer(state: OperationalState, action: OperationalAction): OperationalState {
  switch (action.type) {
    case "SET_FULL_STATE":
      return { ...state, ...action.payload };
    case "UPDATE_TELEMETRY":
      return {
        ...state,
        trains: action.payload.trains,
        blocks: action.payload.blocks,
        simTimeSec: action.payload.simTimeSec,
        isRunning: action.payload.isRunning,
        kpis: action.payload.kpis !== undefined ? action.payload.kpis : state.kpis,
        predictedConflicts: action.payload.conflicts !== undefined ? action.payload.conflicts : state.predictedConflicts,
        activeRecommendations: action.payload.recommendations !== undefined ? action.payload.recommendations : state.activeRecommendations,
      };
    case "SET_VIEWPORT":
      return {
        ...state,
        viewportStartKm: action.payload.startKm,
        viewportEndKm: action.payload.endKm,
      };
    case "SELECT_ENTITY":
      return {
        ...state,
        selectedEntity: action.payload,
        focusedTrainId: action.payload?.type === "TRAIN" ? action.payload.id : state.focusedTrainId,
        focusedConflictId: action.payload?.type === "CONFLICT" ? action.payload.id : state.focusedConflictId,
      };
    case "SET_TAB":
      return { ...state, activeTab: action.payload };
    case "SET_VISUALIZATION_MODE":
      return { ...state, visualizationMode: action.payload };
    case "SET_ROLE":
      return { ...state, userRole: action.payload };
    case "SET_CONNECTION_STATUS":
      return { ...state, connectionStatus: action.payload };
    case "SET_FUTURE_BRANCH":
      return { ...state, activeFutureBranchId: action.payload.branchId, isFutureWorldActive: action.payload.active };
    case "SET_AUDIT_LOGS":
      return { ...state, auditLogs: action.payload };
    default:
      return state;
  }
}

interface OperationalContextValue {
  state: OperationalState;
  dispatch: React.Dispatch<OperationalAction>;
  
  // High-Level Function Contracts
  startSimulation: () => Promise<void>;
  pauseSimulation: () => Promise<void>;
  resetSimulation: () => Promise<void>;
  setTimeScale: (scale: number) => Promise<void>;
  jumpToConflict: () => void;
  locateEntity: (entityId: string, type: "TRAIN" | "BLOCK" | "CONFLICT" | "STATION") => void;
  selectEntity: (entity: SelectedRailwayEntity | null) => void;
  setViewportWindow: (startKm: number, endKm: number) => void;
  setActiveTab: (tab: TabType) => void;
  setVisualizationMode: (mode: VisualizationMode) => void;
  setUserRole: (role: OperatorRole) => void;
  triggerDisruption: (type: string, targetId: string, durationSec?: number) => Promise<void>;
  applyControllerDecision: (action: "APPROVE" | "REJECT" | "OVERRIDE", overrideReason?: string) => Promise<void>;
  previewCandidate: (candidateId: string) => void;
  clearPreview: () => void;
  applyCandidate: (candidateId: string) => Promise<void>;
  refreshAuditLogs: () => Promise<void>;
}

const OperationalContext = createContext<OperationalContextValue | null>(null);

export const OperationalStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(operationalReducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadInitialData = useCallback(async () => {
    try {
      const [topo, simState, logs] = await Promise.all([
        fetchTopology(),
        fetchState(),
        fetchAuditLogs().catch(() => []),
      ]);

      dispatch({
        type: "SET_FULL_STATE",
        payload: {
          stations: topo?.stations || [],
          blocks: topo?.blocks || simState?.blocks || [],
          trains: simState?.trains || [],
          simTimeSec: simState?.sim_time_sec || 0.0,
          isRunning: simState?.is_running || false,
          predictedConflicts: simState?.predicted_conflicts || [],
          activeRecommendations: simState?.active_recommendations || [],
          kpis: simState?.kpis || null,
          auditLogs: logs || [],
          connectionStatus: "CONNECTED",
        },
      });
    } catch (err) {
      console.error("OperationalStore: Initial load failed, falling back to polling", err);
      dispatch({ type: "SET_CONNECTION_STATUS", payload: "POLLING_FALLBACK" });
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/live`;

    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        dispatch({ type: "SET_CONNECTION_STATUS", payload: "CONNECTED" });
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "TELEMETRY_UPDATE" || msg.type === "STATE_UPDATE" || msg.trains) {
            dispatch({
              type: "UPDATE_TELEMETRY",
              payload: {
                trains: msg.trains || [],
                blocks: msg.blocks || [],
                simTimeSec: msg.sim_time_sec ?? msg.timestamp ?? state.simTimeSec,
                isRunning: msg.is_running ?? state.isRunning,
                kpis: msg.kpis,
                conflicts: msg.predicted_conflicts,
                recommendations: msg.active_recommendations,
              },
            });
          }
        } catch (e) {
          console.error("WS message parse error:", e);
        }
      };

      ws.onclose = () => {
        dispatch({ type: "SET_CONNECTION_STATUS", payload: "DISCONNECTED" });
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = () => {
        dispatch({ type: "SET_CONNECTION_STATUS", payload: "POLLING_FALLBACK" });
      };
    } catch (e) {
      dispatch({ type: "SET_CONNECTION_STATUS", payload: "POLLING_FALLBACK" });
    }
  }, [state.simTimeSec, state.isRunning]);

  useEffect(() => {
    loadInitialData();
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [loadInitialData, connectWebSocket]);

  useEffect(() => {
    if (state.connectionStatus === "POLLING_FALLBACK") {
      const interval = setInterval(async () => {
        try {
          const simState = await fetchState();
          if (simState) {
            dispatch({
              type: "UPDATE_TELEMETRY",
              payload: {
                trains: simState.trains || [],
                blocks: simState.blocks || [],
                simTimeSec: simState.sim_time_sec || 0,
                isRunning: simState.is_running || false,
                kpis: simState.kpis,
                conflicts: simState.predicted_conflicts,
                recommendations: simState.active_recommendations,
              },
            });
          }
        } catch (e) {
          console.error("Polling error:", e);
        }
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [state.connectionStatus]);

  const startSimulation = useCallback(async () => {
    await controlSimulation("START");
    dispatch({ type: "SET_FULL_STATE", payload: { isRunning: true } });
  }, []);

  const pauseSimulation = useCallback(async () => {
    await controlSimulation("PAUSE");
    dispatch({ type: "SET_FULL_STATE", payload: { isRunning: false } });
  }, []);

  const resetSimulation = useCallback(async () => {
    await controlSimulation("RESET");
    await loadInitialData();
  }, [loadInitialData]);

  const setTimeScale = useCallback(async (scale: number) => {
    await controlSimulation("SET_SCALE", scale);
    dispatch({ type: "SET_FULL_STATE", payload: { timeScale: scale } });
  }, []);

  const selectEntity = useCallback((entity: SelectedRailwayEntity | null) => {
    dispatch({ type: "SELECT_ENTITY", payload: entity });
  }, []);

  const setViewportWindow = useCallback((startKm: number, endKm: number) => {
    dispatch({ type: "SET_VIEWPORT", payload: { startKm, endKm } });
  }, []);

  const locateEntity = useCallback((entityId: string, type: "TRAIN" | "BLOCK" | "CONFLICT" | "STATION") => {
    if (type === "TRAIN") {
      const tr = state.trains.find((t) => t.train_id === entityId);
      if (tr) {
        const km = tr.current_position_km;
        const span = 80.0;
        const newStart = Math.max(0, km - span / 2);
        const newEnd = Math.min(435.0, newStart + span);
        dispatch({ type: "SET_VIEWPORT", payload: { startKm: newStart, endKm: newEnd } });
        dispatch({ type: "SELECT_ENTITY", payload: { type: "TRAIN", id: tr.train_id, data: tr } });
      }
    } else if (type === "BLOCK") {
      const blk = state.blocks.find((b) => b.id === entityId);
      if (blk) {
        const fStn = state.stations.find((s) => s.id === blk.from_node);
        const tStn = state.stations.find((s) => s.id === blk.to_node);
        const avgKm = fStn && tStn ? (fStn.position_km + tStn.position_km) / 2 : 150.0;
        const span = 80.0;
        const newStart = Math.max(0, avgKm - span / 2);
        const newEnd = Math.min(435.0, newStart + span);
        dispatch({ type: "SET_VIEWPORT", payload: { startKm: newStart, endKm: newEnd } });
        dispatch({ type: "SELECT_ENTITY", payload: { type: "BLOCK", id: blk.id, data: blk } });
      }
    } else if (type === "CONFLICT") {
      const conf = state.predictedConflicts.find((c) => c.conflict_id === entityId);
      if (conf) {
        const blk = state.blocks.find((b) => b.id === conf.location_block_id);
        const fStn = blk ? state.stations.find((s) => s.id === blk.from_node) : null;
        const tStn = blk ? state.stations.find((s) => s.id === blk.to_node) : null;
        const avgKm = fStn && tStn ? (fStn.position_km + tStn.position_km) / 2 : 160.0;
        const span = 70.0;
        const newStart = Math.max(0, avgKm - span / 2);
        const newEnd = Math.min(435.0, newStart + span);
        dispatch({ type: "SET_VIEWPORT", payload: { startKm: newStart, endKm: newEnd } });
        dispatch({ type: "SELECT_ENTITY", payload: { type: "CONFLICT", id: conf.conflict_id, data: conf } });
      }
    }
  }, [state.trains, state.blocks, state.stations, state.predictedConflicts]);

  const jumpToConflict = useCallback(() => {
    if (state.predictedConflicts.length > 0) {
      locateEntity(state.predictedConflicts[0].conflict_id, "CONFLICT");
    }
  }, [state.predictedConflicts, locateEntity]);

  const setActiveTab = useCallback((tab: TabType) => {
    dispatch({ type: "SET_TAB", payload: tab });
  }, []);

  const setVisualizationMode = useCallback((mode: VisualizationMode) => {
    dispatch({ type: "SET_VISUALIZATION_MODE", payload: mode });
  }, []);

  const setUserRole = useCallback((role: OperatorRole) => {
    setApiOperatorRole(role);
    dispatch({ type: "SET_ROLE", payload: role });
  }, []);

  const triggerDisruption = useCallback(async (type: string, targetId: string, durationSec = 300) => {
    await injectDisruption({
      disruption_type: type,
      target_id: targetId,
      duration_sec: durationSec,
      description: "Controller injected disruption",
    });
    await loadInitialData();
  }, [loadInitialData]);

  const refreshAuditLogs = useCallback(async () => {
    const logs = await fetchAuditLogs();
    dispatch({ type: "SET_AUDIT_LOGS", payload: logs || [] });
  }, []);

  const applyControllerDecision = useCallback(async (action: "APPROVE" | "REJECT" | "OVERRIDE", overrideReason?: string, selectedCandidateId?: string) => {
    const activeRec = state.activeRecommendations[0];
    if (!activeRec) return;

    await submitControllerDecision(activeRec.recommendation_id, action, overrideReason, selectedCandidateId);
    await refreshAuditLogs();
    await loadInitialData();
  }, [state.activeRecommendations, refreshAuditLogs, loadInitialData]);

  const previewCandidate = useCallback((candidateId: string) => {
    dispatch({
      type: "SET_FUTURE_BRANCH",
      payload: { branchId: candidateId, active: true },
    });
  }, []);

  const clearPreview = useCallback(() => {
    dispatch({
      type: "SET_FUTURE_BRANCH",
      payload: { branchId: undefined, active: false },
    });
  }, []);

  const applyCandidate = useCallback(async (candidateId: string) => {
    await applyControllerDecision("APPROVE", undefined, candidateId);
    clearPreview();
  }, [applyControllerDecision, clearPreview]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      startSimulation,
      pauseSimulation,
      resetSimulation,
      setTimeScale,
      jumpToConflict,
      locateEntity,
      selectEntity,
      setViewportWindow,
      setActiveTab,
      setVisualizationMode,
      setUserRole,
      triggerDisruption,
      applyControllerDecision,
      previewCandidate,
      clearPreview,
      applyCandidate,
      refreshAuditLogs,
    }),
    [
      state,
      startSimulation,
      pauseSimulation,
      resetSimulation,
      setTimeScale,
      jumpToConflict,
      locateEntity,
      selectEntity,
      setViewportWindow,
      setActiveTab,
      setVisualizationMode,
      setUserRole,
      triggerDisruption,
      applyControllerDecision,
      previewCandidate,
      clearPreview,
      applyCandidate,
      refreshAuditLogs,
    ]
  );

  return <OperationalContext.Provider value={value}>{children}</OperationalContext.Provider>;
};

export const useOperationalStore = () => {
  const ctx = useContext(OperationalContext);
  if (!ctx) {
    throw new Error("useOperationalStore must be used within OperationalStoreProvider");
  }
  return ctx;
};
