import React, { useState } from "react";
import { Radio, Bot, UserCheck, PlayCircle, Volume2, VolumeX, MonitorPlay } from "lucide-react";
import type { OperatorRole } from "../../services/permissions";
import { AudioDirector } from "../../audio/AudioDirector";
import { RailwayAudio } from "../../audio/RailwayAudioEngine";
import { VoiceOverEngine } from "../../audio/VoiceOverEngine";

interface OCCHeaderProps {
  simTimeFormatted: string;
  isRunning: boolean;
  connectionStatus: "CONNECTING" | "LIVE" | "RECONNECTING" | "OFFLINE";
  currentRole: OperatorRole;
  onRoleChange: (role: OperatorRole) => void;
  demoStep: number;
  onExecuteDemoStep: (step: number) => void;
  onOpenCopilot: () => void;
  onReplayStory?: () => void;
}

export const OCCHeader: React.FC<OCCHeaderProps> = ({
  simTimeFormatted,
  isRunning,
  connectionStatus,
  currentRole,
  onRoleChange,
  demoStep,
  onExecuteDemoStep,
  onOpenCopilot,
  onReplayStory
}) => {
  const [audioMuted, setAudioMuted] = useState(true);
  return (
    <header className="bg-[#071018] border-b border-[#162434] px-5 py-2.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 shadow-xl">
      {/* Brand & Section Identity */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30">
          <Radio className="w-4 h-4 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-widest text-[#EAF2F7] font-mono">
              RAILOPT-X
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00D4FF]/20 text-[#00D4FF] font-bold font-mono border border-[#00D4FF]/40">
              OCC 2.0
            </span>
          </div>
          <p className="text-[10px] text-[#81909B] font-mono tracking-tight">
            NDLS–CNB CORRIDOR DIGITAL TWIN & AI DISPATCH
          </p>
        </div>
      </div>

      {/* Evaluator 6-Step Guided Workflow Orchestrator */}
      <div className="hidden xl:flex items-center gap-1.5 bg-[#0A131D] px-3 py-1 rounded-lg border border-[#162434]">
        <div className="flex items-center gap-1.5 mr-2">
          <PlayCircle className="w-3.5 h-3.5 text-[#00D4FF]" />
          <span className="text-[10px] font-mono font-bold text-[#81909B] uppercase">DEMO:</span>
        </div>
        {[
          { step: 1, label: "1. Normal" },
          { step: 2, label: "2. Disrupt" },
          { step: 3, label: "3. Radar" },
          { step: 4, label: "4. CP-SAT" },
          { step: 5, label: "5. What-If" },
          { step: 6, label: "6. Benchmark" }
        ].map((s) => (
          <button
            key={s.step}
            onClick={() => onExecuteDemoStep(s.step)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
              demoStep === s.step
                ? "bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/60 font-bold"
                : "bg-[#071018] text-[#81909B] hover:text-[#EAF2F7] border border-[#162434]"
            }`}
          >
            {s.label}
          </button>
        ))}

        {/* Replay Cinematic Story Button */}
        {onReplayStory && (
          <button
            onClick={onReplayStory}
            className="ml-2 px-2.5 py-0.5 rounded bg-[#FF8C1A]/10 text-[#FF8C1A] hover:bg-[#FF8C1A]/20 border border-[#FF8C1A]/40 text-[10px] font-mono font-bold flex items-center gap-1 transition-all"
            title="Replay 75-second Problem Story Cinematic"
          >
            <MonitorPlay className="w-3 h-3" />
            <span>REPLAY STORY</span>
          </button>
        )}
      </div>

      {/* Right Controls: Role, Clock, Heartbeat, AI Copilot */}
      <div className="flex items-center gap-3">
        {/* Role Selector */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0A131D] border border-[#162434] text-xs font-mono">
          <UserCheck className="w-3.5 h-3.5 text-[#00E676]" />
          <select
            value={currentRole}
            onChange={(e) => onRoleChange(e.target.value as OperatorRole)}
            className="bg-transparent text-[11px] font-bold text-[#00E676] focus:outline-none cursor-pointer"
          >
            <option value="Supervisor" className="bg-[#071018] text-[#EAF2F7]">Role: Supervisor</option>
            <option value="Controller" className="bg-[#071018] text-[#EAF2F7]">Role: Section Controller</option>
            <option value="Admin" className="bg-[#071018] text-[#EAF2F7]">Role: Safety Admin</option>
            <option value="Analyst" className="bg-[#071018] text-[#EAF2F7]">Role: Performance Analyst</option>
          </select>
        </div>

        {/* Master Clock */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#0A131D] border border-[#162434]">
          <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-[#00E676] animate-pulse" : "bg-[#FFB300]"}`} />
          <span className="font-mono text-xs font-bold text-[#00D4FF] tracking-wider">
            {simTimeFormatted}
          </span>
        </div>

        {/* Audio Spatializer & Radio Voice Toggle */}
        <button
          onClick={() => {
            RailwayAudio.resume();
            const isMuted = RailwayAudio.toggleMute();
            AudioDirector.getInstance().toggleMute();
            VoiceOverEngine.setMuted(isMuted);
            setAudioMuted(isMuted);
          }}
          className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            audioMuted
              ? "bg-[#0A131D] text-[#81909B] border-[#162434] hover:text-[#EAF2F7]"
              : "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/40 shadow-[0_0_12px_rgba(0,230,118,0.25)]"
          }`}
          title={audioMuted ? "Unmute Spatial Railway Audio & Voice" : "Mute Spatial Railway Audio & Voice"}
        >
          {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{audioMuted ? "MUTED" : "LIVE AUDIO & VOICE"}</span>
        </button>

        {/* Live Voice Synthesis Radio Test Button */}
        <button
          onClick={() => {
            VoiceOverEngine.testVoice();
            setAudioMuted(false);
          }}
          className="px-2.5 py-1 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/40 hover:bg-[#00D4FF]/20 transition-all cursor-pointer"
          title="Test Live Radio Voice Synthesis"
        >
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span className="hidden sm:inline">RADIO TEST</span>
        </button>

        {/* AI Copilot Trigger */}
        <button
          onClick={onOpenCopilot}
          className="px-3 py-1 rounded-lg bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/40 text-xs font-bold font-mono flex items-center gap-1.5 hover:bg-[#00D4FF]/20 transition-all"
        >
          <Bot className="w-3.5 h-3.5" />
          AI CO-PILOT
        </button>

        {/* Subsystem Multi-Health Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A131D] border border-[#162434] text-[10px] font-mono">
          <span className="flex items-center gap-1 text-[#00E676]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />
            SIM
          </span>
          <span className="text-[#1F2E3D]">|</span>
          <span className={`flex items-center gap-1 ${connectionStatus === "LIVE" ? "text-[#00E676]" : "text-[#FFB300]"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === "LIVE" ? "bg-[#00E676]" : "bg-[#FFB300]"}`} />
            WS
          </span>
          <span className="text-[#1F2E3D]">|</span>
          <span className="flex items-center gap-1 text-[#00D4FF]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D4FF]" />
            CP-SAT
          </span>
          <span className="text-[#1F2E3D]">|</span>
          <span className="flex items-center gap-1 text-[#00E676]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />
            SAFETY
          </span>
          <span className="text-[#1F2E3D]">|</span>
          <span className="flex items-center gap-1 text-[#B388FF]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B388FF]" />
            AUDIT
          </span>
        </div>

        {/* Connection State */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0A131D] border border-[#162434] text-[11px] font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              connectionStatus === "LIVE"
                ? "bg-[#00E676] glow-signal-green"
                : connectionStatus === "CONNECTING" || connectionStatus === "RECONNECTING"
                ? "bg-[#FFB300] glow-signal-amber animate-ping"
                : "bg-[#FF1744] glow-signal-red"
            }`}
          />
          <span className="font-bold text-[#CAD6E2]">{connectionStatus}</span>
        </div>
      </div>
    </header>
  );
};
