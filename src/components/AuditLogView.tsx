import React, { useEffect, useState } from "react";
import type { AuditLogEntry } from "../types/railway";
import { fetchAuditLogs, verifyAuditTrail } from "../services/api";
import { History, Check, X, Sliders, ShieldCheck, Navigation, Hash, Key, ExternalLink, AlertTriangle } from "lucide-react";

interface AuditLogViewProps {
  onLocateTrain?: (trainId: string) => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ onLocateTrain }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<{ is_tamper_free: boolean; entries_verified: number; status?: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetchAuditLogs(),
      verifyAuditTrail()
    ])
      .then(([auditData, verifyData]) => {
        setLogs(auditData || []);
        setVerification(verifyData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-[#0D1720] border border-[#1F2E3D] rounded-xl p-5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-[#B388FF]/10 text-[#B388FF] border border-[#B388FF]/30">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#EAF2F7]">IMMUTABLE REGULATORY AUDIT TRAIL</h2>
            <p className="text-xs text-[#81909B]">
              Cryptographic decision ledger capturing AI recommendations, solver metadata, controller actions, override justifications, and delay savings.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {verification?.is_tamper_free ? (
            <span className="px-3 py-1 rounded bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30 text-xs font-mono font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              SHA-256 HASH CHAIN: VERIFIED ({verification.entries_verified} RECORDS)
            </span>
          ) : verification?.status === "EMPTY" || (logs.length === 0) ? (
            <span className="px-3 py-1 rounded bg-[#81909B]/10 text-[#81909B] border border-[#81909B]/30 text-xs font-mono font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              GENESIS ROOT INITIALIZED
            </span>
          ) : (
            <span className="px-3 py-1 rounded bg-[#FF1744]/10 text-[#FF1744] border border-[#FF1744]/30 text-xs font-mono font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              CHAIN INTEGRITY FAULT DETECTED
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Audit Table */}
        <div className={`bg-[#0D1720] border border-[#1F2E3D] rounded-xl p-5 shadow-lg ${selectedEntry ? "lg:col-span-2" : "lg:col-span-3"}`}>
          {loading ? (
            <div className="text-xs text-[#81909B] py-8 text-center">Loading Audit Records...</div>
          ) : logs.length === 0 ? (
            <div className="text-xs text-[#81909B] py-8 text-center">
              No decisions logged yet. Actions taken on AI recommendations will appear here automatically.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1F2E3D] text-[#81909B]">
                    <th className="py-2.5 px-3">Audit ID</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Train</th>
                    <th className="py-2.5 px-3">Recommended Action</th>
                    <th className="py-2.5 px-3">Controller Action</th>
                    <th className="py-2.5 px-3">Delay Saved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2E3D]/50 font-mono">
                  {logs.map((entry) => {
                    const isSelected = selectedEntry?.entry_id === entry.entry_id;
                    return (
                      <tr
                        key={entry.entry_id}
                        onClick={() => setSelectedEntry(entry)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-[#00D4FF]/15 border-l-4 border-[#00D4FF]" : "hover:bg-[#13202E]/60"
                        }`}
                      >
                        <td className="py-2.5 px-3 text-[#00D4FF] font-bold">{entry.entry_id}</td>
                        <td className="py-2.5 px-3 text-[#81909B]">
                          {new Date(entry.timestamp_sec * 1000).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3 text-[#EAF2F7] font-bold">{entry.train_id}</td>
                        <td className="py-2.5 px-3 text-[#FFB300]">{entry.action}</td>
                        <td className="py-2.5 px-3">
                          {entry.controller_action === "APPROVE" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#00E676]/20 text-[#00E676] font-bold text-[10px]">
                              <Check className="w-3 h-3" /> APPROVED
                            </span>
                          )}
                          {entry.controller_action === "REJECT" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FF4D4D]/20 text-[#FF4D4D] font-bold text-[10px]">
                              <X className="w-3 h-3" /> REJECTED
                            </span>
                          )}
                          {entry.controller_action === "OVERRIDE" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FFB300]/20 text-[#FFB300] font-bold text-[10px]">
                              <Sliders className="w-3 h-3" /> OVERRIDDEN
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[#00E676] font-bold">
                          +{Math.round(entry.projected_delay_saved_sec / 60)} min
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Audit Entry Detail & Verification Drawer */}
        {selectedEntry && (
          <div className="bg-[#0A131D] border border-[#00D4FF]/40 rounded-xl p-5 shadow-2xl flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#162434]">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#00D4FF]" />
                  <h3 className="text-xs font-bold font-mono text-[#EAF2F7]">DECISION DETAIL: {selectedEntry.entry_id}</h3>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="p-1 text-[#81909B] hover:text-[#EAF2F7]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-[#81909B] block text-[10px] uppercase">Primary Train</span>
                  <span className="text-[#00D4FF] font-bold text-sm">{selectedEntry.train_id}</span>
                </div>

                <div>
                  <span className="text-[#81909B] block text-[10px] uppercase">Controller Dispatch Action</span>
                  <span className="text-[#00E676] font-bold">{selectedEntry.controller_action} ({selectedEntry.action})</span>
                </div>

                <div>
                  <span className="text-[#81909B] block text-[10px] uppercase">AI Explainer Rationale</span>
                  <p className="text-[#CAD6E2] text-xs font-sans mt-0.5 bg-[#050B11] p-2.5 rounded border border-[#162434]">
                    {selectedEntry.ai_reason}
                  </p>
                </div>

                {selectedEntry.override_reason && (
                  <div>
                    <span className="text-[#81909B] block text-[10px] uppercase">Override Justification</span>
                    <p className="text-[#FFB300] text-xs font-sans mt-0.5 bg-[#FFB300]/10 p-2.5 rounded border border-[#FFB300]/30">
                      {selectedEntry.override_reason}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-[#81909B] block text-[10px] uppercase">Projected Delay Saved</span>
                  <span className="text-[#00E676] font-bold">+{Math.round(selectedEntry.projected_delay_saved_sec / 60)} minutes</span>
                </div>

                <div className="pt-2 border-t border-[#162434] space-y-2">
                  <div>
                    <span className="text-[#81909B] block text-[10px] uppercase flex items-center gap-1">
                      <Hash className="w-3 h-3 text-[#00D4FF]" /> Entry SHA-256 Hash
                    </span>
                    <div className="text-[9px] text-[#00D4FF] bg-[#050B11] p-2 rounded border border-[#162434] break-all font-mono select-all mt-0.5">
                      {selectedEntry.entry_hash || "SHA256:GENESIS_LINK"}
                    </div>
                  </div>

                  {selectedEntry.prev_hash && (
                    <div>
                      <span className="text-[#81909B] block text-[10px] uppercase flex items-center gap-1">
                        <Key className="w-3 h-3 text-[#81909B]" /> Previous Block Hash Chain
                      </span>
                      <div className="text-[9px] text-[#81909B] bg-[#050B11] p-2 rounded border border-[#162434] break-all font-mono select-all mt-0.5">
                        {selectedEntry.prev_hash}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {onLocateTrain && (
              <button
                onClick={() => onLocateTrain(selectedEntry.train_id)}
                className="w-full py-2 px-3 rounded bg-[#00D4FF]/20 hover:bg-[#00D4FF]/30 text-[#00D4FF] border border-[#00D4FF]/50 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Navigation className="w-3.5 h-3.5" />
                LOCATE {selectedEntry.train_id} ON NX PANEL
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
