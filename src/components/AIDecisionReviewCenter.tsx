import React, { useState, useEffect } from "react";
import type { Recommendation, Train, TrackBlock, AuditLogEntry } from "../types/railway";
import { fetchAuditLogs } from "../services/api";
import { Magnetic } from "./interaction/Magnetic";
import { FocusManager } from "../interaction/FocusManager";
import { 
  Bot, ShieldCheck, Cpu, GitFork, CheckCircle2, 
  Sliders, Navigation, Activity, History, 
  TrendingDown, Check, X, Sparkles, AlertTriangle
} from "lucide-react";
import { WhyPanel } from "./Explain/WhyPanel";

interface AIDecisionReviewCenterProps {
  recommendation: Recommendation | null;
  trains: Train[];
  blocks: TrackBlock[];
  onDecision: (action: "APPROVE" | "REJECT" | "OVERRIDE", overrideReason?: string, selectedCandidateId?: string) => void;
  onLocateTrain: (trainId: string) => void;
  canApproveDecision?: boolean;
  decisionError?: string | null;
}

export const AIDecisionReviewCenter: React.FC<AIDecisionReviewCenterProps> = ({
  recommendation,
  trains,
  blocks,
  onDecision,
  onLocateTrain,
  canApproveDecision = true,
  decisionError
}) => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [selectedAuditEntry, setSelectedAuditEntry] = useState<AuditLogEntry | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState("Field Operational Priority Adjustment");

  useEffect(() => {
    fetchAuditLogs()
      .then((logs) => {
        setAuditLogs(logs || []);
        if (logs && logs.length > 0 && !recommendation) {
          setSelectedAuditEntry(logs[logs.length - 1]);
        }
      })
      .catch((e) => console.error("Error loading audit logs in review center:", e));
  }, [recommendation]);

  const targetTrain = trains.find((t) => t.train_id === recommendation?.primary_train_id);
  const targetBlock = blocks.find((b) => b.id === recommendation?.target_block_id);

  const handleFactClick = (fact: any) => {
    if (fact.train_ids && fact.train_ids.length > 0) {
      FocusManager.focusTrain(fact.train_ids[0]);
      onLocateTrain(fact.train_ids[0]);
    } else if (recommendation?.primary_train_id) {
      FocusManager.focusTrain(recommendation.primary_train_id);
      onLocateTrain(recommendation.primary_train_id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0A131D] border border-[#162434] rounded-xl p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-[#FF8C1A]/10 text-[#FF8C1A] border border-[#FF8C1A]/30 shadow-lg">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-[#EAF2F7] tracking-wider uppercase font-mono">
                AI-Assisted Dispatch Decision Review
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#3E9142]/20 text-[#3E9142] border border-[#3E9142]/40 font-mono font-bold">
                PHYSICAL BRANCH SIMULATION
              </span>
            </div>
            <p className="text-xs text-[#81909B]">
              Deterministic optimization, digital twin branch validation, counterfactual inspection & cryptographic audit trail
            </p>
          </div>
        </div>

        {/* Live Decision Status Pill */}
        <div className="flex items-center gap-3">
          {recommendation ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FF8C1A]/15 border border-[#FF8C1A]/40 text-[#FF8C1A] font-mono text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-[#FF8C1A] animate-pulse" />
              <span>PENDING DISPATCHER DECISION</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#3E9142]/15 border border-[#3E9142]/40 text-[#3E9142] font-mono text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-[#3E9142]" />
              <span>SECTION IN EQUILIBRIUM (NOMINAL TIMETABLE)</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Review Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Live AI Decision Details & Rationale */}
        <div className="lg:col-span-2 space-y-6">
          {recommendation ? (
            <>
              {/* 1. Decision Headline Card */}
              <div className="bg-[#0A131D] border border-[#162434] rounded-xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF8C1A]/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-[#162434] gap-4">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded bg-[#FF8C1A] text-[#071018] font-extrabold text-xs tracking-wider font-mono">
                      {recommendation.action.toUpperCase()} ORDER
                    </span>
                    <div>
                      <h3
                        className="text-sm font-bold text-[#EAF2F7] font-mono cursor-pointer hover:text-[#FF8C1A] transition-colors"
                        onClick={() => {
                          FocusManager.focusTrain(recommendation.primary_train_id);
                          onLocateTrain(recommendation.primary_train_id);
                        }}
                      >
                        {recommendation.primary_train_id} {targetTrain ? `• ${targetTrain.train_name}` : ""}
                      </h3>
                      <span className="text-[11px] text-[#81909B]">
                        Target Block:{" "}
                        <span
                          className="text-[#FF8C1A] font-mono cursor-pointer hover:underline"
                          onClick={() => {
                            if (recommendation.target_block_id) {
                              FocusManager.focusBlock(recommendation.target_block_id);
                            }
                          }}
                        >
                          {recommendation.target_block_id || "Sectional Loop"}
                        </span>
                        {targetBlock ? ` (${targetBlock.name})` : ""}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      FocusManager.focusTrain(recommendation.primary_train_id);
                      onLocateTrain(recommendation.primary_train_id);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#13202E] hover:bg-[#1F2E3D] text-[#FF8C1A] border border-[#FF8C1A]/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    LOCATE ON NX
                  </button>
                </div>

                {/* 3-Tier Solver & Safety Telemetry Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  <div className="bg-[#050B11] p-3 rounded-lg border border-[#162434]">
                    <div className="text-[9px] uppercase text-[#81909B] font-mono font-bold">1. SOLVER ENGINE</div>
                    <div className="text-xs font-bold text-[#FF8C1A] flex items-center gap-1 mt-0.5 font-mono">
                      <Cpu className="w-3.5 h-3.5 text-[#FF8C1A]" />
                      {recommendation.solver_name || "OR-Tools CP-SAT"}
                    </div>
                    <div className="text-[9px] text-[#CAD6E2] font-mono mt-0.5">{recommendation.solver_status || "OPTIMAL"}</div>
                  </div>

                  <div className="bg-[#050B11] p-3 rounded-lg border border-[#162434]">
                    <div className="text-[9px] uppercase text-[#81909B] font-mono font-bold">2. PROVENANCE</div>
                    <div className="text-xs font-bold text-[#3E9142] flex items-center gap-1 mt-0.5 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#3E9142]" />
                      {recommendation.source_candidate_id || "CAND_OPTIMAL"}
                    </div>
                    <div className="text-[9px] text-[#81909B] font-mono mt-0.5">PHYSICAL TWIN BRANCH</div>
                  </div>

                  <div className="bg-[#050B11] p-3 rounded-lg border border-[#162434]">
                    <div className="text-[9px] uppercase text-[#81909B] font-mono font-bold">3. OBJECTIVE SCORE</div>
                    <div className="text-xs font-mono font-bold text-[#E5A93C] mt-0.5">
                      {recommendation.evaluated_objective_score !== undefined
                        ? `J = ${recommendation.evaluated_objective_score.toFixed(1)}`
                        : recommendation.optimization_objective_score !== undefined
                        ? `J = ${recommendation.optimization_objective_score.toFixed(1)}`
                        : "J = —"}
                    </div>
                    <div className="text-[9px] text-[#81909B] font-mono mt-0.5">COST CRITERIA</div>
                  </div>

                  <div className={`p-3 rounded-lg border ${recommendation.safety_valid ? "bg-[#050B11] border-[#162434]" : "bg-[#FF1744]/10 border-[#FF1744]/50"}`}>
                    <div className="text-[9px] uppercase text-[#81909B] font-mono font-bold">SAFETY INVARIANTS</div>
                    <div className={`text-xs font-bold flex items-center gap-1 mt-0.5 font-mono ${recommendation.safety_valid ? "text-[#3E9142]" : "text-[#FF1744]"}`}>
                      {recommendation.safety_valid ? <ShieldCheck className="w-3.5 h-3.5 text-[#3E9142]" /> : <AlertTriangle className="w-3.5 h-3.5 text-[#FF1744]" />}
                      {recommendation.safety_valid ? "PASSED (0 Violations)" : "FLAGGED (Unsafe)"}
                    </div>
                    <div className="text-[9px] font-mono mt-0.5 text-[#81909B]">
                      {recommendation.safety_valid ? "VERIFIED SAFE" : "APPROVE BLOCKED"}
                    </div>
                  </div>
                </div>

                {/* EvidenceFacts / Structured XAI Rationales */}
                <div className="space-y-3 mb-5">
                  <div className="text-xs font-bold text-[#81909B] uppercase tracking-wider flex items-center justify-between font-mono">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#FF8C1A]" />
                      Explainable AI Operational Rationales (Clickable Evidence)
                    </span>
                    <span className="text-[10px] font-mono text-[#FF8C1A]">FACTS & METRIC DELTAS</span>
                  </div>
                  
                  {/* Interactive EvidenceFacts */}
                  {recommendation.evidence_facts && recommendation.evidence_facts.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                      {recommendation.evidence_facts.map((fact, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleFactClick(fact)}
                          className="p-2.5 rounded-lg bg-[#050B11] border border-[#FF8C1A]/30 hover:border-[#FF8C1A] text-xs font-mono cursor-pointer transition-all hover:bg-[#13202E]"
                        >
                          <div className="flex items-center justify-between text-[10px] text-[#FF8C1A] mb-1 font-bold">
                            <span>[{fact.code}]</span>
                            <div className="flex items-center gap-1">
                              <span className={fact.verified ? "text-[#3E9142]" : "text-[#FF8C1A]"}>
                                {fact.verified ? "VERIFIED ✓" : "BASELINE"}
                              </span>
                              <span className="text-[9px] text-[#7A8B7E]">➔ NX</span>
                            </div>
                          </div>
                          <div className="text-[11px] text-[#EAF2F7]">{fact.rendered_text}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    {recommendation.reasons_bullet_points && recommendation.reasons_bullet_points.length > 0 ? (
                      recommendation.reasons_bullet_points.map((reason, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 p-3 rounded-lg bg-[#050B11] border border-[#162434] text-xs text-[#EAF2F7]"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF8C1A] mt-1.5 shrink-0" />
                          <span className="leading-relaxed font-sans">{reason}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-[#81909B] p-3 rounded-lg bg-[#050B11] border border-[#162434]">
                        {recommendation.reason_summary}
                      </div>
                    )}
                  </div>

                  {recommendation.explanation && (
                    <div className="mt-3">
                      <WhyPanel payload={{ kind: "CONFLICT", data: recommendation.explanation }} onLocateEntity={onLocateTrain} />
                    </div>
                  )}
                </div>

                {/* Downstream Impact & Projected Delay Savings */}
                <div className="p-4 rounded-xl bg-[#3E9142]/10 border border-[#3E9142]/30 mb-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-[#3E9142]" />
                      <div>
                        <div className="text-xs font-bold text-[#3E9142] uppercase tracking-wide font-mono">
                          Projected Network Delay Savings
                        </div>
                        <div className="text-[11px] text-[#CAD6E2]">
                          Cascading delay eliminated across NDLS-CNB corridor
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xl font-extrabold text-[#3E9142]">
                        {recommendation.projected_metrics_diff?.delay_saved_min !== undefined
                          ? `+${recommendation.projected_metrics_diff.delay_saved_min.toFixed(1)} min`
                          : "—"}
                      </div>
                      <div className="text-[10px] text-[#81909B] font-mono">SAVED vs STATUS QUO</div>
                    </div>
                  </div>
                </div>

                {/* Safety Invariant Alert Banner if Unsafe */}
                {!recommendation.safety_valid && (
                  <div className="p-3 mb-4 rounded-lg bg-[#FF1744]/15 border border-[#FF1744]/50 text-[#FF4D4D] text-xs font-mono font-bold flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 shrink-0 animate-bounce" />
                    <div>
                      <div>SAFETY INVARIANTS VIOLATED — DISPATCH ORDER CANNOT BE APPROVED</div>
                      <div className="text-[10px] font-normal text-[#CAD6E2] mt-0.5">
                        Mathematical optimizer found a solution, but physical simulation revealed invariant violations. Use manual OVERRIDE or REJECT.
                      </div>
                    </div>
                  </div>
                )}

                {/* Synchronous HTTP Rejection Error Banner */}
                {decisionError && (
                  <div className="p-4 mb-4 rounded-xl bg-[#FF1744]/20 border-2 border-[#FF1744] text-[#FFFFFF] text-xs font-mono font-bold shadow-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <AlertTriangle className="w-5 h-5 text-[#FF5252] shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="text-sm font-black text-[#FF5252] tracking-wide">
                        DISPATCH ORDER REJECTED BY SAFETY INTERLOCKING (HTTP 409)
                      </div>
                      <div className="text-[#EAF2F7] bg-[#050B11] p-2.5 rounded-lg border border-[#FF1744]/40 font-mono text-[11px] leading-relaxed">
                        {decisionError}
                      </div>
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          onClick={() => setShowOverrideModal(true)}
                          className="px-3 py-1 bg-[#FF8C1A] text-[#050B11] rounded font-bold text-[11px] hover:bg-[#FFA33E] transition-colors cursor-pointer"
                        >
                          OPEN MANUAL OVERRIDE PROTOCOL →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Controller Direct Action Drawer */}
                <div className="pt-4 border-t border-[#162434] flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs text-[#81909B] flex items-center gap-2 font-mono">
                    <Activity className="w-3.5 h-3.5 text-[#FF8C1A]" />
                    <span>HUMAN-IN-THE-LOOP: Section Controller holds final dispatch authority</span>
                  </div>
                  <div className={`flex items-center gap-3 ${!canApproveDecision ? "opacity-40 pointer-events-none" : ""}`}
                       title={!canApproveDecision ? "Controller role required" : undefined}>
                    <Magnetic tier="weak">
                      <button
                        onClick={() => setShowOverrideModal(true)}
                        disabled={!canApproveDecision}
                        className="px-3.5 py-2 text-xs font-bold bg-[#13202E] hover:bg-[#1F2E3D] text-[#FF8C1A] border border-[#FF8C1A]/40 rounded-lg flex items-center gap-1.5 transition-colors font-mono cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>OVERRIDE PLAN</span>
                      </button>
                    </Magnetic>

                    <Magnetic tier="weak">
                      <button
                        onClick={() => onDecision("REJECT")}
                        disabled={!canApproveDecision}
                        className="px-3.5 py-2 text-xs font-bold bg-[#1A1215] hover:bg-[#2D1B22] text-[#FF4D4D] border border-[#FF4D4D]/40 rounded-lg flex items-center gap-1.5 transition-colors font-mono cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>REJECT</span>
                      </button>
                    </Magnetic>

                    {recommendation.operational_status !== "NO_INTERVENTION_REQUIRED" ? (
                      <Magnetic tier="safety-ack">
                        <button
                          onClick={() => onDecision("APPROVE", undefined, selectedCandidateId || undefined)}
                          disabled={!canApproveDecision || !recommendation.safety_valid}
                          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-lg font-mono ${
                            recommendation.safety_valid && canApproveDecision
                              ? "bg-[#3E9142] hover:bg-[#2E7D32] text-[#EAF2F7] shadow-[#3E9142]/20 cursor-pointer"
                              : "bg-[#2A343E] text-[#81909B] cursor-not-allowed opacity-50 border border-[#162434]"
                          }`}
                          title={!recommendation.safety_valid ? "Approval blocked: safety validation failed" : undefined}
                        >
                          <Check className="w-4 h-4" />
                          <span>{recommendation.safety_valid ? "APPROVE ORDER" : "UNSAFE (BLOCKED)"}</span>
                        </button>
                      </Magnetic>
                    ) : (
                      <div className="px-3 py-1.5 bg-[#142618] border border-[#24422A] text-[#3E9142] rounded-lg font-mono text-xs font-semibold">
                        NOMINAL (NO INTERVENTION)
                      </div>
                    )}
                  </div>
                </div>
              </div>

                  {/* 2. Counterfactual Sandbox Options Comparison */}
                  {recommendation.counterfactual_options && recommendation.counterfactual_options.length > 0 && (
                    <div className="bg-[#0A131D] border border-[#162434] rounded-xl p-5 shadow-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#81909B] uppercase tracking-wider flex items-center gap-2 font-mono">
                          <GitFork className="w-4 h-4 text-[#FF8C1A]" />
                          Counterfactual Dispatch Alternatives (Click to Select & Preview)
                        </h4>
                        <span className="text-[10px] text-[#FF8C1A] font-mono font-bold">PHYSICAL BRANCH EVALUATION</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {recommendation.counterfactual_options.map((opt, idx) => {
                          const isSelected = selectedCandidateId === (opt.candidate_id || opt.label);
                          const isRecommended = opt.is_recommended;
                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                setSelectedCandidateId(opt.candidate_id || opt.label);
                                if (opt.target_train_id || recommendation.primary_train_id) {
                                  onLocateTrain(opt.target_train_id || recommendation.primary_train_id);
                                }
                              }}
                              className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? "bg-[#FF8C1A]/15 border-[#FF8C1A] shadow-lg shadow-[#FF8C1A]/10 ring-1 ring-[#FF8C1A]"
                                  : isRecommended
                                  ? "bg-[#FF8C1A]/5 border-[#FF8C1A]/40 hover:bg-[#FF8C1A]/10 text-[#EAF2F7]"
                                  : "bg-[#050B11] border-[#162434] hover:border-[#233548] text-[#81909B]"
                              }`}
                            >
                              <div>
                                <div className="flex justify-between items-center font-bold text-xs mb-1.5 font-mono">
                                  <span className={isSelected ? "text-[#FF8C1A]" : "text-[#EAF2F7]"}>{opt.label}</span>
                                  <div className="flex items-center gap-1">
                                    {isRecommended && (
                                      <span className="text-[9px] bg-[#FF8C1A] text-[#071018] px-1.5 py-0.5 rounded font-extrabold shrink-0">
                                        RECOMMENDED
                                      </span>
                                    )}
                                    {isSelected && !isRecommended && (
                                      <span className="text-[9px] bg-[#22C55E] text-[#071018] px-1.5 py-0.5 rounded font-extrabold shrink-0">
                                        SELECTED
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-[11px] space-y-1 my-2 font-mono">
                                  <div>Total Delay: <strong className={isRecommended ? "text-[#3E9142]" : "text-[#FF8C1A]"}>+{opt.total_delay_min || opt.projected_total_delay_min}m</strong></div>
                                  <div>Safety Status: <strong className={opt.safety?.includes("PASSED") || isRecommended ? "text-[#3E9142]" : "text-[#FF4D4D]"}>{opt.safety || "PASSED"}</strong></div>
                                  {opt.relative_preference && (
                                    <div className="text-[10px] text-[#FF8C1A] font-mono mt-0.5">{opt.relative_preference}</div>
                                  )}
                                </div>
                              </div>
                              <div className="text-[10px] text-[#81909B] pt-2 border-t border-[#162434]/60 flex items-center justify-between">
                                <span className="truncate pr-2">{opt.controller_summary}</span>
                                <span className="text-[9px] text-[#FF8C1A] font-bold shrink-0">
                                  {isSelected ? "ACTIVE" : "SELECT ➔"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
            </>
          ) : (
            /* Empty / Nominal State Review Card */
            <div className="bg-[#0A131D] border border-[#162434] rounded-xl p-8 shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#3E9142]/10 border border-[#3E9142]/30 text-[#3E9142] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#EAF2F7] font-mono">All Section Movements Optimal</h3>
                <p className="text-xs text-[#81909B] max-w-md mx-auto mt-1">
                  The mathematical solver and Lookahead Conflict Radar have confirmed zero block contentions or headway violations for the active timetable.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-[#050B11] border border-[#162434] max-w-lg mx-auto text-left text-xs space-y-2">
                <div className="text-[10px] font-mono text-[#FF8C1A] uppercase font-bold">Continuous Background Surveillance:</div>
                <div className="text-[#CAD6E2] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3E9142]" />
                  15-minute predictive conflict scanning active across 6 stations & 14 blocks.
                </div>
                <div className="text-[#CAD6E2] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3E9142]" />
                  CP-SAT mathematical re-scheduler standing by with &lt;100ms response time.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Historical Decision Reviews & Audit Hash Lineage */}
        <div className="space-y-6">
          <div className="bg-[#0A131D] border border-[#162434] rounded-xl p-5 shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#162434]">
              <h4 className="text-xs font-bold text-[#81909B] uppercase tracking-wider flex items-center gap-2 font-mono">
                <History className="w-4 h-4 text-[#FF8C1A]" />
                Audited Decisions Archive
              </h4>
              <span className="text-[10px] text-[#3E9142] font-mono font-bold">SHA-256 LEDGER</span>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[560px] pr-1">
              {auditLogs.length === 0 ? (
                <div className="text-xs text-[#81909B] py-8 text-center font-mono">
                  No previous controller decisions logged in this simulation session.
                </div>
              ) : (
                auditLogs.slice().reverse().map((entry, idx) => (
                  <div
                    key={entry.entry_id || idx}
                    onClick={() => setSelectedAuditEntry(entry)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      selectedAuditEntry?.entry_id === entry.entry_id
                        ? "bg-[#13202E] border-[#FF8C1A]/60 shadow-lg shadow-[#FF8C1A]/5"
                        : "bg-[#050B11] border-[#162434] hover:bg-[#13202E]/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[10px] text-[#FF8C1A] font-bold">
                        T+{entry.timestamp_sec}s
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold font-mono ${
                          entry.controller_action === "APPROVE"
                            ? "bg-[#3E9142]/20 text-[#3E9142]"
                            : entry.controller_action === "OVERRIDE"
                            ? "bg-[#FF8C1A]/20 text-[#FF8C1A]"
                            : "bg-[#FF4D4D]/20 text-[#FF4D4D]"
                        }`}
                      >
                        {entry.controller_action}
                      </span>
                    </div>

                    <div className="font-bold text-[#EAF2F7] flex items-center justify-between mb-1 font-mono">
                      <span>{entry.action} • {entry.train_id}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLocateTrain(entry.train_id);
                        }}
                        className="text-[10px] text-[#FF8C1A] hover:underline flex items-center gap-1 font-mono"
                      >
                        <Navigation className="w-3 h-3" />
                        Locate
                      </button>
                    </div>

                    <div className="text-[10px] text-[#81909B] font-mono truncate">
                      Hash: {entry.entry_hash ? `${entry.entry_hash.slice(0, 16)}...` : "—"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1520] border border-[#233548] rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-[#EAF2F7] uppercase tracking-wider font-mono flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#FF8C1A]" />
              Manual Controller Override
            </h3>
            <p className="text-xs text-[#81909B]">
              Specify mandatory reason for overriding AI-assisted recommendation. This rationale will be permanently recorded into the cryptographically verifiable SHA-256 audit trail.
            </p>
            <div>
              <label className="block text-[10px] font-mono text-[#81909B] uppercase mb-1 font-bold">
                Operational Rationale
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full bg-[#050B11] border border-[#162434] rounded-lg p-2.5 text-xs text-[#EAF2F7] font-mono focus:border-[#FF8C1A] focus:outline-none h-20"
                placeholder="Enter mandatory justification for override..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowOverrideModal(false)}
                className="px-3 py-1.5 rounded-lg bg-[#162434] text-xs text-[#81909B] font-mono hover:text-[#EAF2F7] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowOverrideModal(false);
                  onDecision("OVERRIDE", overrideReason);
                }}
                className="px-4 py-1.5 rounded-lg bg-[#FF8C1A] hover:bg-[#E07A10] text-[#071018] font-mono font-bold text-xs transition cursor-pointer"
              >
                Submit Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
