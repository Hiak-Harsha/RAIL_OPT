import type { 
  Train, TrackBlock, OperationalKPIs, PredictedConflict, Recommendation, 
  Disruption, AuditLogEntry, BenchmarkResult, WhatIfReport 
} from "../types/railway";

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
export const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/live";

let currentRole: "Controller" | "Supervisor" | "Admin" | "Analyst" = "Controller";

export function setOperatorRole(role: "Controller" | "Supervisor" | "Admin" | "Analyst") {
  currentRole = role;
}

export function getOperatorRole() {
  return currentRole;
}

export class ApiError extends Error {
  public status: number;
  public detail: string;
  constructor(status: number, detail: string, endpoint: string) {
    super(`API Error [${status}] on ${endpoint}: ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.method && options.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }
  headers.set("X-User-Role", currentRole);

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errorJson = await res.json();
      detail = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
    } catch {
      detail = await res.text();
    }
    throw new ApiError(res.status, detail, endpoint);
  }

  return res.json() as Promise<T>;
}

export async function fetchState(): Promise<{
  sim_time_sec: number;
  sim_time_formatted: string;
  is_running: boolean;
  time_scale: number;
  trains: Train[];
  blocks: TrackBlock[];
  kpis: OperationalKPIs;
  predicted_conflicts: PredictedConflict[];
  active_recommendations: Recommendation[];
  disruptions: Disruption[];
  recent_events: any[];
}> {
  return apiFetch("/state");
}

export async function fetchTopology(): Promise<{
  stations: any[];
  blocks: TrackBlock[];
  signals: any[];
  platforms: any[];
}> {
  return apiFetch("/topology");
}

export async function controlSimulation(
  action: "START" | "PAUSE" | "RESET" | "SET_SCALE" | "JUMP_TO_TIME" | "JUMP_TO_DEMO" | "JUMP_TO_NEXT_CONFLICT" | "JUMP_TO_NEXT_EVENT",
  time_scale?: number,
  target_time_sec?: number,
  event_type?: string
) {
  return apiFetch<{ status: string; is_running: boolean; time_scale: number; sim_time_sec?: number }>("/simulation/control", {
    method: "POST",
    body: JSON.stringify({ action, time_scale, target_time_sec, event_type })
  });
}

export async function injectDisruption(disruption: {
  disruption_type: string;
  target_id: string;
  duration_sec: number;
  description: string;
}) {
  return apiFetch<{ status: string; disruption_id: string; affected_train_ids: string[] }>("/disruptions", {
    method: "POST",
    body: JSON.stringify(disruption)
  });
}

export async function submitControllerDecision(
  recommendation_id: string,
  action: "APPROVE" | "REJECT" | "OVERRIDE",
  override_reason?: string,
  selected_candidate_id?: string
) {
  return apiFetch<{ status: string; recommendation_id: string; decision: string }>("/recommendations/action", {
    method: "POST",
    body: JSON.stringify({ recommendation_id, action, override_reason, selected_candidate_id })
  });
}

export interface CandidatePreview {
  status: string;
  horizon_sec: number;
  applied_actions: Array<{ action_type: string; train_id: string; target_block_id?: string; duration_sec?: number }>;
  frames: Array<{ offset_sec: number; trains: Array<{ train_id: string; block_id?: string; position_km: number; speed_kmh: number; status: string }> }>;
}

export async function fetchCandidatePreview(recommendationId: string, candidateId: string): Promise<CandidatePreview> {
  return apiFetch<CandidatePreview>(`/recommendations/${encodeURIComponent(recommendationId)}/preview?candidate_id=${encodeURIComponent(candidateId)}`);
}

export async function runOptimization(solver_type: string = "OR-Tools_CP-SAT") {
  return apiFetch<any>(`/optimize?solver_type=${encodeURIComponent(solver_type)}`, {
    method: "POST"
  });
}

export async function runWhatIfAnalysis(disruptions: any[]): Promise<WhatIfReport> {
  return apiFetch<WhatIfReport>("/what-if", {
    method: "POST",
    body: JSON.stringify(disruptions)
  });
}

export async function runCandidateWhatIfAnalysis(disruptions: any[], candidateActions: any[]): Promise<WhatIfReport> {
  return apiFetch<WhatIfReport>("/what-if/candidate", {
    method: "POST",
    body: JSON.stringify({ disruptions, candidate_actions: candidateActions })
  });
}

export async function fetchBenchmarks(): Promise<BenchmarkResult> {
  return apiFetch<BenchmarkResult>("/benchmarks");
}

export async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  return apiFetch<AuditLogEntry[]>("/audit");
}

export async function verifyAuditTrail(): Promise<{ is_tamper_free: boolean; entries_verified: number; latest_root_hash?: string; status?: string; reason?: string }> {
  return apiFetch("/audit/verify");
}

export async function queryAssistant(query: string): Promise<{ answer: string; data: any }> {
  return apiFetch<{ answer: string; data: any }>("/assistant/query", {
    method: "POST",
    body: JSON.stringify({ query })
  });
}

export async function fetchScenarios(): Promise<{ status: string; scenarios: any[] }> {
  return apiFetch<{ status: string; scenarios: any[] }>("/scenarios");
}

export async function loadScenario(scenarioId: string): Promise<any> {
  return apiFetch<any>(`/scenarios/${encodeURIComponent(scenarioId)}/load`, {
    method: "POST"
  });
}
