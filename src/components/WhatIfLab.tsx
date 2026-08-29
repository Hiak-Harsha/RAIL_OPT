import React, { useState } from "react";
import type { Train, TrackBlock, WhatIfReport } from "../types/railway";
import { runWhatIfAnalysis } from "../services/api";
import { FlaskConical, Play, AlertOctagon, Plus, Trash2 } from "lucide-react";

interface DisruptionItem {
  id: string;
  type: string;
  targetId: string;
  durationMinutes: number;
  description: string;
}

interface WhatIfLabProps {
  trains: Train[];
  blocks: TrackBlock[];
}

export const WhatIfLab: React.FC<WhatIfLabProps> = ({ trains, blocks }) => {
  const [disruptions, setDisruptions] = useState<DisruptionItem[]>([
    {
      id: "DISR_1",
      type: "TRAIN_DELAY",
      targetId: trains[0]?.train_id || "T22436",
      durationMinutes: 12,
      description: "Signal aspect intermittent failure / loco power drop",
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<WhatIfReport | null>(null);

  const addDisruption = () => {
    const newId = `DISR_${disruptions.length + 1}`;
    setDisruptions([
      ...disruptions,
      {
        id: newId,
        type: "SPEED_RESTRICTION",
        targetId: blocks[0]?.id || "B04",
        durationMinutes: 20,
        description: "Temporary Speed Restriction (TSR 30 km/h) due to engineering work",
      }
    ]);
  };

  const removeDisruption = (id: string) => {
    if (disruptions.length <= 1) return;
    setDisruptions(disruptions.filter((d) => d.id !== id));
  };

  const updateDisruption = (id: string, field: keyof DisruptionItem, value: any) => {
    setDisruptions(
      disruptions.map((d) => {
        if (d.id === id) {
          const updated = { ...d, [field]: value };
          if (field === "type") {
            if (value === "BLOCK_CLOSURE" || value === "SPEED_RESTRICTION" || value === "WEATHER_RESTRICTION") {
              updated.targetId = blocks[0]?.id || "";
            } else if (value === "SIGNAL_FAILURE") {
              updated.targetId = `SIG_${blocks[0]?.id || "B04"}`;
            } else if (value === "PLATFORM_UNAVAILABLE") {
              updated.targetId = blocks.find((b) => b.id.includes("LOOP") || b.block_type.includes("PLATFORM"))?.id || blocks[0]?.id || "";
            } else {
              updated.targetId = trains[0]?.train_id || "";
            }
          }
          return updated;
        }
        return d;
      })
    );
  };

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const payload = disruptions.map((d) => ({
        disruption_type: d.type,
        target_id: d.targetId,
        duration_sec: d.durationMinutes * 60,
        description: d.description,
      }));
      const res = await runWhatIfAnalysis(payload);
      setReport(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 relative p-2 rounded-xl whatif-sandbox-active">
      <div className="whatif-watermark">
        SIMULATION SANDBOX • NON-LIVE ISOLATED TWIN
      </div>

      {/* Header */}
      <div className="bg-[#121513] border border-[#232A25] rounded-xl p-5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-[#FF8C1A]/10 text-[#FF8C1A] border border-[#FF8C1A]/30">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#E2E8E4] tracking-wide font-mono">
              SIMULATION LAB — WHAT-IF SCENARIO COMPOSER
            </h2>
            <p className="text-xs text-[#8C9A8E]">
              Compose single or multi-factor operational disruptions in an isolated sandbox to compare unmitigated baseline vs CP-SAT re-optimization.
            </p>
          </div>
        </div>
      </div>

      {/* Disruption Scenario Composer */}
      <div className="bg-[#121513] border border-[#232A25] rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#E2E8E4] flex items-center gap-2 font-mono">
            <AlertOctagon className="w-4 h-4 text-[#FF8C1A]" />
            SCENARIO COMPOSER ({disruptions.length} ACTIVE DISRUPTIONS)
          </h3>
          <button
            onClick={addDisruption}
            className="px-3 py-1.5 rounded-lg bg-[#18221B] hover:bg-[#233127] text-[#3E9142] border border-[#3E9142]/40 text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ADD DISRUPTION FACTOR</span>
          </button>
        </div>

        <div className="space-y-3">
          {disruptions.map((disr, idx) => (
            <div key={disr.id} className="p-3.5 rounded-lg bg-[#181C19] border border-[#232A25] space-y-3">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-[#8C9A8E]">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FF8C1A]" />
                  <span>DISRUPTION FACTOR #{idx + 1}</span>
                </span>
                {disruptions.length > 1 && (
                  <button
                    onClick={() => removeDisruption(disr.id)}
                    className="text-[#EF4444] hover:text-[#FF6B6B] p-1 rounded hover:bg-[#2D1B22] transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] text-[#8C9A8E] block mb-1 font-semibold font-mono">Disruption Type</label>
                  <select
                    value={disr.type}
                    onChange={(e) => updateDisruption(disr.id, "type", e.target.value)}
                    className="w-full bg-[#121513] border border-[#232A25] text-xs text-[#E2E8E4] rounded-lg p-2 focus:border-[#FF8C1A] focus:outline-none font-mono"
                  >
                    <option value="TRAIN_DELAY">Train Delay (Loco/Signal)</option>
                    <option value="TRAIN_BREAKDOWN">Train Breakdown (Complete Halt)</option>
                    <option value="BLOCK_CLOSURE">Track Block Closure / Maintenance</option>
                    <option value="SPEED_RESTRICTION">Temporary Speed Restriction (TSR)</option>
                    <option value="SIGNAL_FAILURE">Signal Aspect Failure (Red Aspect)</option>
                    <option value="PLATFORM_UNAVAILABLE">Platform Line Unavailable</option>
                    <option value="WEATHER_RESTRICTION">Weather / Dense Fog Speed Cap</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#8C9A8E] block mb-1 font-semibold font-mono">Target Entity</label>
                  {disr.type === "BLOCK_CLOSURE" || disr.type === "SPEED_RESTRICTION" || disr.type === "WEATHER_RESTRICTION" ? (
                    <select
                      value={disr.targetId}
                      onChange={(e) => updateDisruption(disr.id, "targetId", e.target.value)}
                      className="w-full bg-[#121513] border border-[#232A25] text-xs text-[#E2E8E4] rounded-lg p-2 focus:border-[#FF8C1A] focus:outline-none font-mono"
                    >
                      {blocks.map((b) => (
                        <option key={b.id} value={b.id}>{b.name} ({b.id})</option>
                      ))}
                    </select>
                  ) : disr.type === "SIGNAL_FAILURE" ? (
                    <select
                      value={disr.targetId}
                      onChange={(e) => updateDisruption(disr.id, "targetId", e.target.value)}
                      className="w-full bg-[#121513] border border-[#232A25] text-xs text-[#E2E8E4] rounded-lg p-2 focus:border-[#FF8C1A] focus:outline-none font-mono"
                    >
                      {blocks.map((b) => (
                        <option key={`SIG_${b.id}`} value={`SIG_${b.id}`}>Signal SIG_{b.id} ({b.name})</option>
                      ))}
                    </select>
                  ) : disr.type === "PLATFORM_UNAVAILABLE" ? (
                    <select
                      value={disr.targetId}
                      onChange={(e) => updateDisruption(disr.id, "targetId", e.target.value)}
                      className="w-full bg-[#121513] border border-[#232A25] text-xs text-[#E2E8E4] rounded-lg p-2 focus:border-[#FF8C1A] focus:outline-none font-mono"
                    >
                      {blocks.map((b) => (
                        <option key={b.id} value={b.id}>Platform Line ({b.name})</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={disr.targetId}
                      onChange={(e) => updateDisruption(disr.id, "targetId", e.target.value)}
                      className="w-full bg-[#121513] border border-[#232A25] text-xs text-[#E2E8E4] rounded-lg p-2 focus:border-[#FF8C1A] focus:outline-none font-mono"
                    >
                      {trains.map((t) => (
                        <option key={t.train_id} value={t.train_id}>{t.train_name} ({t.train_id}) - P{t.priority}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-[10px] text-[#8C9A8E] block mb-1 font-semibold font-mono">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={disr.durationMinutes}
                    onChange={(e) => updateDisruption(disr.id, "durationMinutes", Number(e.target.value))}
                    className="w-full bg-[#121513] border border-[#232A25] text-xs text-[#E2E8E4] rounded-lg p-2 focus:border-[#FF8C1A] focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#8C9A8E] block mb-1 font-semibold font-mono">Operational Reason</label>
                  <input
                    type="text"
                    value={disr.description}
                    onChange={(e) => updateDisruption(disr.id, "description", e.target.value)}
                    className="w-full bg-[#121513] border border-[#232A25] text-xs text-[#E2E8E4] rounded-lg p-2 focus:border-[#FF8C1A] focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="px-5 py-2.5 bg-[#FF8C1A] hover:bg-[#E07A10] text-[#0A0D0B] font-bold text-xs rounded-lg flex items-center gap-2 transition duration-150 font-mono shadow-md cursor-pointer disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            {loading ? "SIMULATING FUTURE BRANCHES..." : "RUN MULTI-BRANCH SIMULATION"}
          </button>
        </div>
      </div>

      {/* Branch Comparison Results */}
      {report && (
        <div className="space-y-6">
          {/* Executive KPI Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#121513] border border-[#232A25] rounded-xl p-4">
              <span className="text-xs text-[#8C9A8E] font-mono">DELAY REDUCTION</span>
              <div className="text-2xl font-black text-[#3E9142] font-mono mt-1">
                {report.delay_reduction_pct > 0 ? `-${report.delay_reduction_pct}%` : "0%"}
              </div>
              <span className="text-[10px] text-[#8C9A8E]">vs. Unmitigated Status Quo</span>
            </div>

            <div className="bg-[#121513] border border-[#232A25] rounded-xl p-4">
              <span className="text-xs text-[#8C9A8E] font-mono">THROUGHPUT GAIN</span>
              <div className="text-2xl font-black text-[#3E9142] font-mono mt-1">
                {report.throughput_gain_pct > 0 ? `+${report.throughput_gain_pct}%` : "0%"}
              </div>
              <span className="text-[10px] text-[#8C9A8E]">Corridor Capacity Protected</span>
            </div>

            <div className="bg-[#121513] border border-[#232A25] rounded-xl p-4">
              <span className="text-xs text-[#8C9A8E] font-mono">CONFLICTS ELIMINATED</span>
              <div className="text-2xl font-black text-[#FF8C1A] font-mono mt-1">
                {report.conflicts_eliminated}
              </div>
              <span className="text-[10px] text-[#8C9A8E]">Block Collisions & Deadlocks Prevented</span>
            </div>
          </div>

          {/* Three-Branch Side-by-Side Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Branch A: Baseline FCFS */}
            <div className="bg-[#121513] border border-[#232A25] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#232A25]">
                <div>
                  <div className="text-[10px] text-[#8C9A8E] font-mono font-bold">BRANCH A (BASELINE)</div>
                  <h4 className="text-xs font-bold text-[#E2E8E4] font-mono">{report.baseline_scenario.scenario_name}</h4>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 text-[10px] font-mono font-bold">
                  UNMITIGATED
                </span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#8C9A8E]">Network Delay:</span>
                  <span className="text-[#EF4444] font-bold">+{report.baseline_scenario.total_network_delay_min.toFixed(1)} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C9A8E]">Max Single Delay:</span>
                  <span className="text-[#EF4444] font-bold">+{report.baseline_scenario.max_delay_min.toFixed(1)} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C9A8E]">Throughput:</span>
                  <span className="text-[#E2E8E4]">{report.baseline_scenario.throughput_trains_per_hr.toFixed(1)} trains/hr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C9A8E]">Track Utilization:</span>
                  <span className="text-[#E2E8E4]">{report.baseline_scenario.track_utilization_pct.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C9A8E]">Safety Conflicts:</span>
                  <span className="text-[#EF4444] font-bold">{report.baseline_scenario.conflicts_count}</span>
                </div>
              </div>
            </div>

            {/* Branch B: Priority Heuristic */}
            {report.alternative_scenarios && report.alternative_scenarios.length > 0 && (
              <div className="bg-[#121513] border border-[#232A25] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#232A25]">
                  <div>
                    <div className="text-[10px] text-[#8C9A8E] font-mono font-bold">BRANCH B (HEURISTIC)</div>
                    <h4 className="text-xs font-bold text-[#E2E8E4] font-mono">{report.alternative_scenarios[0].scenario_name}</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#EAB308]/15 text-[#EAB308] border border-[#EAB308]/30 text-[10px] font-mono font-bold">
                    PRIORITY RULES
                  </span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-[#8C9A8E]">Network Delay:</span>
                    <span className="text-[#EAB308] font-bold">+{report.alternative_scenarios[0].total_network_delay_min.toFixed(1)} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8C9A8E]">Max Single Delay:</span>
                    <span className="text-[#EAB308] font-bold">+{report.alternative_scenarios[0].max_delay_min.toFixed(1)} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8C9A8E]">Throughput:</span>
                    <span className="text-[#E2E8E4]">{report.alternative_scenarios[0].throughput_trains_per_hr.toFixed(1)} trains/hr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8C9A8E]">Track Utilization:</span>
                    <span className="text-[#E2E8E4]">{report.alternative_scenarios[0].track_utilization_pct.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8C9A8E]">Safety Conflicts:</span>
                    <span className="text-[#EAB308] font-bold">{report.alternative_scenarios[0].conflicts_count}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Branch C: RAILOPT-X CP-SAT Optimal */}
            <div className="bg-[#121513] border border-[#3E9142]/40 rounded-xl p-5 space-y-4 shadow-lg shadow-[#3E9142]/5">
              <div className="flex items-center justify-between pb-2 border-b border-[#232A25]">
                <div>
                  <div className="text-[10px] text-[#3E9142] font-mono font-bold">BRANCH C (AI / CP-SAT)</div>
                  <h4 className="text-xs font-bold text-[#E2E8E4] font-mono">{report.optimized_scenario.scenario_name}</h4>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#3E9142]/15 text-[#3E9142] border border-[#3E9142]/30 text-[10px] font-mono font-bold">
                  RECOMMENDED
                </span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#8C9A8E]">Network Delay:</span>
                  <span className="text-[#3E9142] font-bold">+{report.optimized_scenario.total_network_delay_min.toFixed(1)} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C9A8E]">Max Single Delay:</span>
                  <span className="text-[#3E9142] font-bold">+{report.optimized_scenario.max_delay_min.toFixed(1)} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C9A8E]">Throughput:</span>
                  <span className="text-[#3E9142] font-bold">{report.optimized_scenario.throughput_trains_per_hr.toFixed(1)} trains/hr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C9A8E]">Track Utilization:</span>
                  <span className="text-[#E2E8E4]">{report.optimized_scenario.track_utilization_pct.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C9A8E]">Safety Conflicts:</span>
                  <span className="text-[#3E9142] font-bold">{report.optimized_scenario.conflicts_count} (Safe)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
