import { useState, useEffect, useRef } from "react";
import type { Train, TrackBlock, Station, Signal, Platform, PredictedConflict, OperationalKPIs, Recommendation } from "../types/railway";
import { API_BASE, WS_BASE } from "../services/api";

export function useRealtimeState() {
  const [trains, setTrains] = useState<Train[]>([]);
  const [blocks, setBlocks] = useState<TrackBlock[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [kpis, setKpis] = useState<OperationalKPIs | null>(null);
  const [predictedConflicts, setPredictedConflicts] = useState<PredictedConflict[]>([]);
  const [activeRecommendations, setActiveRecommendations] = useState<Recommendation[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [simTimeSec, setSimTimeSec] = useState<number>(0);
  const [simTimeFormatted, setSimTimeFormatted] = useState<string>("00:00:00");
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [timeScale, setTimeScale] = useState<number>(1.0);
  const [connected, setConnected] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  // 1. Initial Topology Fetch
  useEffect(() => {
    fetch(`${API_BASE}/topology`)
      .then((res) => res.json())
      .then((data) => {
        if (data.stations) setStations(data.stations);
        if (data.blocks) setBlocks(data.blocks);
        if (data.signals) setSignals(data.signals);
        if (data.platforms) setPlatforms(data.platforms);
      })
      .catch(() => {});
  }, []);

  // 2. WebSocket Telemetry Stream with Automatic Reconnect
  useEffect(() => {
    let unmounted = false;

    const connectWs = () => {
      if (unmounted) return;
      try {
        const ws = new WebSocket(WS_BASE);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!unmounted) setConnected(true);
        };

        ws.onmessage = (event) => {
          if (unmounted) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === "STATE_UPDATE" && msg.data) {
              const d = msg.data;
              if (d.trains) setTrains(Object.values(d.trains));
              if (d.blocks) setBlocks(Object.values(d.blocks));
              if (d.kpis) setKpis(d.kpis);
              if (d.predicted_conflicts) setPredictedConflicts(d.predicted_conflicts);
              if (d.active_recommendations) setActiveRecommendations(Object.values(d.active_recommendations));
              if (d.sim_time_sec !== undefined) setSimTimeSec(d.sim_time_sec);
              if (d.sim_time_formatted) setSimTimeFormatted(d.sim_time_formatted);
              if (d.is_running !== undefined) setIsRunning(d.is_running);
              if (d.time_scale !== undefined) setTimeScale(d.time_scale);
            } else if (msg.event === "SIM_EVENT" && msg.data) {
              setEvents((prev) => [msg.data, ...prev.slice(0, 49)]);
            }
          } catch {}
        };

        ws.onclose = () => {
          if (!unmounted) {
            setConnected(false);
            reconnectTimeoutRef.current = setTimeout(connectWs, 2000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        if (!unmounted) reconnectTimeoutRef.current = setTimeout(connectWs, 2000);
      }
    };

    connectWs();

    // 3. Fallback polling for REST state if WS disconnected
    const pollInterval = setInterval(() => {
      if (!connected && !unmounted) {
        fetch(`${API_BASE}/api/state`)
          .then((res) => res.json())
          .then((d) => {
            if (d.trains) setTrains(Object.values(d.trains));
            if (d.blocks) setBlocks(Object.values(d.blocks));
            if (d.kpis) setKpis(d.kpis);
            if (d.predicted_conflicts) setPredictedConflicts(d.predicted_conflicts);
            if (d.active_recommendations) setActiveRecommendations(Object.values(d.active_recommendations));
            if (d.sim_time_sec !== undefined) setSimTimeSec(d.sim_time_sec);
            if (d.sim_time_formatted) setSimTimeFormatted(d.sim_time_formatted);
          })
          .catch(() => {});
      }
    }, 1000);

    return () => {
      unmounted = true;
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      clearInterval(pollInterval);
    };
  }, [connected]);

  return {
    trains,
    blocks,
    stations,
    signals,
    platforms,
    kpis,
    predictedConflicts,
    activeRecommendations,
    events,
    simTimeSec,
    simTimeFormatted,
    isRunning,
    timeScale,
    connected,
    setTrains,
    setBlocks,
    setKpis
  };
}
