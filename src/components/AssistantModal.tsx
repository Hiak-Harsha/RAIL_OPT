import React, { useState } from "react";
import { queryAssistant } from "../services/api";
import { Bot, Send, X, Sparkles, Navigation, ArrowRight, ShieldCheck, Cpu } from "lucide-react";

interface AssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToReview?: () => void;
  onLocateTrain?: (trainId: string) => void;
  initialQuery?: string;
}

export const AssistantModal: React.FC<AssistantModalProps> = ({ 
  isOpen, 
  onClose,
  onNavigateToReview,
  onLocateTrain,
  initialQuery
}) => {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Array<{ sender: "user" | "ai"; text: string; data?: any }>>([
    {
      sender: "ai",
      text: "Hello Section Controller. I am the RAILOPT-X operational co-pilot. Ask me to review the latest AI recommendation, query active delays, or scan upcoming crossing conflicts."
    }
  ]);
  const [loading, setLoading] = useState(false);

  const submitQuery = React.useCallback(async (textToSend: string) => {
    if (!textToSend.trim()) return;
    setQuery("");
    setMessages((prev) => [...prev, { sender: "user", text: textToSend }]);
    setLoading(true);

    try {
      const res = await queryAssistant(textToSend);
      setMessages((prev) => [...prev, { sender: "ai", text: res.answer, data: res.data }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "Unable to query backend state at this time." }
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen && initialQuery) {
      const timer = setTimeout(() => {
        submitQuery(initialQuery);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialQuery, submitQuery]);

  if (!isOpen) return null;

  const handleSend = () => {
    submitQuery(query);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0D1720] border border-[#1F2E3D] rounded-xl max-w-2xl w-full h-[560px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#1F2E3D] flex justify-between items-center bg-[#071018]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-[#00D4FF]/20 text-[#00D4FF]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EAF2F7]">RAILOPT-X OPERATIONAL AI ASSISTANT</h3>
              <p className="text-[10px] text-[#81909B]">Closed-loop decision explanation & digital twin telemetry query</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-[#81909B] hover:text-[#EAF2F7]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[90%] p-3.5 rounded-xl text-xs ${
                  m.sender === "user"
                    ? "bg-[#00D4FF] text-[#071018] font-semibold"
                    : "bg-[#13202E] text-[#EAF2F7] border border-[#1F2E3D]"
                }`}
              >
                <div className="leading-relaxed">{m.text}</div>

                {/* Structured Decision Review Card in Assistant */}
                {m.data && m.data.review_type === "ACTIVE_RECOMMENDATION" && (
                  <div className="mt-3 p-3 rounded-lg bg-[#050B11] border border-[#162434] space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono border-b border-[#162434] pb-1.5">
                      <span className="text-[#00D4FF] font-bold flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5" />
                        {m.data.solver_name} • {m.data.solver_status}
                      </span>
                      <span className="text-[#00E676] font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {m.data.safety_valid ? "SAFETY VERIFIED" : "WARNING"}
                      </span>
                    </div>

                    {m.data.reasons && (
                      <ul className="text-[10px] text-[#CAD6E2] space-y-1 pl-1">
                        {m.data.reasons.slice(0, 2).map((r: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-[#00D4FF]">›</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#162434]">
                      {onLocateTrain && m.data.recommendation?.primary_train_id && (
                        <button
                          onClick={() => {
                            onClose();
                            onLocateTrain(m.data.recommendation.primary_train_id);
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold text-[#00D4FF] bg-[#13202E] hover:bg-[#1F2E3D] rounded border border-[#00D4FF]/30 flex items-center gap-1"
                        >
                          <Navigation className="w-3 h-3" />
                          Locate Train on NX
                        </button>
                      )}
                      {onNavigateToReview && (
                        <button
                          onClick={() => {
                            onClose();
                            onNavigateToReview();
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold text-[#071018] bg-[#00D4FF] hover:bg-[#00D4FF]/90 rounded flex items-center gap-1 font-mono"
                        >
                          Open Full Review
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#81909B]">
              <Sparkles className="w-4 h-4 animate-spin text-[#00D4FF]" />
              <span>Querying live section optimization state...</span>
            </div>
          )}
        </div>

        {/* Suggested Quick Queries */}
        <div className="px-4 py-2 bg-[#071018] border-t border-[#1F2E3D] flex gap-2 overflow-x-auto">
          {[
            "Review the latest AI recommendation",
            "Why is the train being held?",
            "Show all delayed trains",
            "Scan upcoming conflicts"
          ].map((q, idx) => (
            <button
              key={idx}
              onClick={() => submitQuery(q)}
              className="text-[10px] px-2.5 py-1 rounded bg-[#13202E] text-[#81909B] hover:text-[#00D4FF] hover:border-[#00D4FF]/50 border border-[#1F2E3D] whitespace-nowrap transition-all flex items-center gap-1"
            >
              <span>⚡</span>
              <span>{q}</span>
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-[#1F2E3D] bg-[#071018] flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask to review latest recommendation, explain solver decisions, or check delays..."
            className="flex-1 bg-[#13202E] border border-[#1F2E3D] text-xs text-[#EAF2F7] rounded-lg px-3 py-2 focus:outline-none focus:border-[#00D4FF]"
          />
          <button
            onClick={handleSend}
            disabled={loading || !query.trim()}
            className="p-2 bg-[#00D4FF] text-[#071018] font-bold rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
