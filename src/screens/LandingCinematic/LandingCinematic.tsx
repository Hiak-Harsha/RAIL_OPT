/**
 * RAILOPT-X 2.0 — Cinematic Landing Experience: Problem & Solution Story
 * 
 * Demonstrates the full 75-second journey:
 * 1. Normal Flow (130 km/h express traffic)
 * 2. Bottleneck Contention (Freight deceleration on single-line section)
 * 3. Conflict Radar Trigger (T22436 Vande Bharat converging on single line)
 * 4. Unmanaged Crisis (Emergency brake trip, 41-minute cascade delay, 3 stalled trains)
 * 5. Future Worlds Engine (OR-Tools CP-SAT generating 4 Pareto schedules in 42ms)
 * 6. Optimal AI Resolution (+3.2m hold on T04403, 0 conflicts, 41m delay saved)
 * 
 * Features:
 * - Dynamic Voice-Over speech synthesis with phonetic callsigns
 * - Split-Flap mechanical KPI flips
 * - Live Traffic Teleprinter stream
 * - Interactive Beat Jump Navigation
 * - Explicit Before vs After Proof comparison
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { GRIDLOCK_KEYFRAMES, resolveFrameAt, type SequenceFrame } from "../../data/gridlockSequence";
import { NXTrackCanvas } from "../../components/NXPanel/NXTrackCanvas";
import { SplitFlapRail } from "../../components/SplitFlap/SplitFlapRail";
import { TrafficTeleprinter, type TeleprinterLog } from "../../components/Teleprinter/TrafficTeleprinter";
import { CinematicCaption } from "./CinematicCaption";
import { FutureWorldsOverlay } from "./FutureWorldsOverlay";
import { RailwayAudio } from "../../audio/RailwayAudioEngine";
import { VoiceOverEngine, type VoiceCaption } from "../../audio/VoiceOverEngine";
import { Magnetic } from "../../components/interaction/Magnetic";
import { 
  Volume2, VolumeX, Play, ShieldCheck, ArrowRight, Radio, RotateCcw, 
  AlertTriangle, GitCompare 
} from "lucide-react";

interface LandingCinematicProps {
  onComplete: () => void;
}

const TOTAL_DURATION_MS = 75000;

const BEATS = [
  { id: "CALM", label: "1. Normal Flow", timeMs: 0, desc: "130 km/h Green Corridor" },
  { id: "ESCALATING", label: "2. Bottleneck", timeMs: 14000, desc: "Freight Deceleration" },
  { id: "GRIDLOCK_APPROACH", label: "3. Conflict Radar", timeMs: 26000, desc: "Convergence Detected" },
  { id: "GRIDLOCK", label: "4. Crisis / Problem", timeMs: 38000, desc: "+41m Unmanaged Delay" },
  { id: "FUTURE_WORLDS", label: "5. CP-SAT Solver", timeMs: 50000, desc: "4 Candidate Worlds" },
  { id: "OPTIMAL", label: "6. AI Solution", timeMs: 63000, desc: "0 Conflicts • 41m Saved" },
];

export const LandingCinematic: React.FC<LandingCinematicProps> = ({ onComplete }) => {
  const [frame, setFrame] = useState<SequenceFrame>(GRIDLOCK_KEYFRAMES[0]);
  const [teleprinterLogs, setTeleprinterLogs] = useState<TeleprinterLog[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasStartedWithVoice, setHasStartedWithVoice] = useState(false);
  const [voiceCaption, setVoiceCaption] = useState<VoiceCaption | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  
  const startTimeRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number>(0);
  const totalPausedDurationRef = useRef<number>(0);
  const lastSoundCueRef = useRef<string | null>(null);
  const loggedLinesRef = useRef<Set<string>>(new Set());

  // Subscribe to VoiceOver captions
  useEffect(() => {
    return VoiceOverEngine.subscribeCaptions(setVoiceCaption);
  }, []);

  // Stop all sounds when exiting the cinematic screen into OCC
  const handleSkip = useCallback(() => {
    RailwayAudio.stopAll();
    VoiceOverEngine.stopAll();
    onComplete();
  }, [onComplete]);

  // Teardown sound engine on unmount
  useEffect(() => {
    return () => {
      RailwayAudio.stopAll();
      VoiceOverEngine.stopAll();
    };
  }, []);

  // Initialize Web Audio and Speech Synthesis on user gesture
  const startStoryWithVoice = useCallback(() => {
    void RailwayAudio.resume();
    RailwayAudio.setMuted(false);
    VoiceOverEngine.setMuted(false);
    setIsMuted(false);
    setHasStartedWithVoice(true);
    startTimeRef.current = performance.now();
    totalPausedDurationRef.current = 0;
    pausedAtRef.current = 0;
    setIsPaused(false);

    // Initial voice narration hook
    VoiceOverEngine.speakNarration("Welcome to RAILOPT-X. High-density corridor digital twin online. Observe normal one-thirty kilometer per hour traffic flow.");
  }, []);

  // Jump to specific beat
  const jumpToBeat = (timeMs: number) => {
    void RailwayAudio.resume();
    setHasStartedWithVoice(true);
    startTimeRef.current = performance.now() - timeMs;
    totalPausedDurationRef.current = 0;
    pausedAtRef.current = 0;
    setElapsedMs(timeMs);
    setIsPaused(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setIsPaused((p) => !p);
      } else if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSkip]);

  // Master requestAnimationFrame replay loop
  useEffect(() => {
    let animId: number;

    const tick = (now: number) => {
      if (!startTimeRef.current) startTimeRef.current = now;

      if (isPaused) {
        RailwayAudio.stopAll();
        if (!pausedAtRef.current) pausedAtRef.current = now;
        animId = requestAnimationFrame(tick);
        return;
      }

      if (pausedAtRef.current) {
        totalPausedDurationRef.current += (now - pausedAtRef.current);
        pausedAtRef.current = 0;
      }

      const elapsed = Math.max(0, now - startTimeRef.current - totalPausedDurationRef.current);
      setElapsedMs(elapsed);

      const currentFrame = resolveFrameAt(GRIDLOCK_KEYFRAMES, elapsed);
      setFrame(currentFrame);

      // Continuous Physics-Driven Train Speed Audio Modulation
      if (!isMuted && hasStartedWithVoice) {
        currentFrame.trains.forEach((t) => {
          RailwayAudio.updateTrainSpeed(
            t.train_id,
            t.current_speed_kmh,
            t.train_id.includes("04403") ? "FREIGHT" : "EXPRESS",
            t.current_speed_kmh > 0
          );
        });

        // Scene-driven Acoustic Transition
        if (currentFrame.phase === "CALM") RailwayAudio.transitionScene("CALM");
        else if (currentFrame.phase === "ESCALATING") RailwayAudio.transitionScene("TRAFFIC_BUILD");
        else if (currentFrame.phase === "GRIDLOCK") RailwayAudio.transitionScene("CONFLICT");
        else if (currentFrame.phase === "FUTURE_WORLDS") RailwayAudio.transitionScene("OPTIMIZING");
        else if (currentFrame.phase === "RESOLVING" || currentFrame.phase === "OPTIMAL") RailwayAudio.transitionScene("RECOVERY");

        // Discrete Sound Cue Dispatcher
        if (currentFrame.soundCue && currentFrame.soundCue !== lastSoundCueRef.current) {
          lastSoundCueRef.current = currentFrame.soundCue;
          if (currentFrame.soundCue === "relay") RailwayAudio.playSignalChange("YELLOW");
          else if (currentFrame.soundCue === "warning") RailwayAudio.playConflictAlert();
          else if (currentFrame.soundCue === "teleprinter") {
            if (currentFrame.teleprinterLine) RailwayAudio.playTeleprinter(currentFrame.teleprinterLine);
          }
          else if (currentFrame.soundCue === "resolve") RailwayAudio.playPlanCommit();
        }

        // Teleprinter Line Streamer & Voice-Over Narration
        if (currentFrame.teleprinterLine && !loggedLinesRef.current.has(currentFrame.teleprinterLine)) {
          loggedLinesRef.current.add(currentFrame.teleprinterLine);
          RailwayAudio.playTeleprinter(currentFrame.teleprinterLine);
          
          if (currentFrame.phase === "GRIDLOCK") {
            VoiceOverEngine.speakAlert(currentFrame.teleprinterLine);
          } else {
            VoiceOverEngine.speakNarration(currentFrame.teleprinterLine);
          }

          setTeleprinterLogs((prev) => [
            ...prev.slice(-8),
            {
              id: `cinematic-log-${Date.now()}-${Math.random()}`,
              timestamp: new Date().toLocaleTimeString(),
              message: currentFrame.teleprinterLine!,
              type: currentFrame.phase === "GRIDLOCK" ? "REJECTED" : currentFrame.phase === "OPTIMAL" ? "OPTIMAL" : "INFO"
            }
          ]);
        }
      }

      // Loop or stop
      if (elapsed >= TOTAL_DURATION_MS) {
        // Complete
      } else {
        animId = requestAnimationFrame(tick);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, isMuted, hasStartedWithVoice]);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    void RailwayAudio.resume();
    const next = !isMuted;
    setIsMuted(next);
    RailwayAudio.setMuted(next);
    VoiceOverEngine.setMuted(next);
    if (!next) setHasStartedWithVoice(true);
  };

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTimeRef.current = performance.now();
    totalPausedDurationRef.current = 0;
    pausedAtRef.current = 0;
    setIsPaused(false);
    setFrame(GRIDLOCK_KEYFRAMES[0]);
  };

  const progressPct = Math.min(100, (elapsedMs / TOTAL_DURATION_MS) * 100);
  const elapsedSec = Math.floor(elapsedMs / 1000);

  return (
    <div className="relative w-full min-h-screen bg-[#03070B] text-[#EAF2F7] overflow-y-auto flex flex-col justify-between font-sans select-none antialiased">
      {/* Top Interactive Header */}
      <header className="relative z-30 px-6 py-3 flex flex-wrap items-center justify-between border-b border-[#162434] bg-[#071018]/95 backdrop-blur-md shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00D4FF] animate-pulse" />
            <span className="font-mono text-sm font-black tracking-wider text-[#00D4FF]">RAILOPT-X 2.0</span>
          </div>
          <span className="text-xs text-[#1F2E3D]">|</span>
          <span className="text-xs font-mono text-[#81909B] tracking-wide uppercase">
            75-SECOND CORRIDOR CRISIS & AI RESOLUTION STORY
          </span>
          <span className="text-xs text-[#1F2E3D]">|</span>
          <span className="text-xs font-mono font-bold text-[#FF8C1A]">
            {elapsedSec}s / 75s
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRestart}
            className="px-2.5 py-1 rounded bg-[#0B1520] hover:bg-[#101D2C] border border-[#162434] text-[#81909B] hover:text-[#EAF2F7] transition-all text-xs flex items-center gap-1.5 cursor-pointer"
            title="Restart Replay"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px] font-bold">RESTART</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsPaused((prev) => !prev);
            }}
            className="px-2.5 py-1 rounded bg-[#0B1520] hover:bg-[#101D2C] border border-[#162434] text-[#81909B] hover:text-[#EAF2F7] transition-all text-xs flex items-center gap-1.5 cursor-pointer"
            title={isPaused ? "Resume Replay" : "Pause Replay"}
          >
            <Play className={`w-3.5 h-3.5 ${isPaused ? "text-[#FF8C1A]" : "text-[#00D4FF]"}`} />
            <span className="font-mono text-[10px] font-bold">{isPaused ? "RESUME" : "PAUSE"}</span>
          </button>

          <button
            onClick={toggleSound}
            className="px-2.5 py-1 rounded bg-[#0B1520] hover:bg-[#101D2C] border border-[#162434] text-[#81909B] hover:text-[#EAF2F7] transition-all text-xs flex items-center gap-1.5 cursor-pointer"
            title={isMuted ? "Unmute Audio" : "Mute Audio"}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-[#EF4444]" /> : <Volume2 className="w-3.5 h-3.5 text-[#00E676]" />}
            <span className="font-mono text-[10px] font-bold">{isMuted ? "MUTED" : "LIVE VOICE & AUDIO"}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSkip();
            }}
            className="px-4 py-1.5 rounded-lg bg-[#FF8C1A] hover:bg-[#FFA33E] text-[#03070B] font-mono text-xs font-black flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
          >
            <span>ENTER OPERATIONS CONTROL ROOM</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Interactive Story Beat Navigation Bar */}
      <div className="bg-[#071018] border-b border-[#162434] px-6 py-2 flex items-center justify-between overflow-x-auto gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-[#81909B] uppercase shrink-0">STORY BEATS:</span>
          {BEATS.map((b) => {
            const isActive = frame.phase === b.id || (b.id === "GRIDLOCK_APPROACH" && frame.phase === "ESCALATING" && elapsedMs > 25000);
            return (
              <button
                key={b.id}
                onClick={() => jumpToBeat(b.timeMs)}
                className={`px-3 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/50 font-bold shadow-[0_0_12px_rgba(0,212,255,0.3)]"
                    : "bg-[#0B1520] text-[#81909B] hover:text-[#EAF2F7] border border-[#162434]"
                }`}
              >
                <span>{b.label}</span>
                <span className="text-[10px] opacity-60">({b.desc})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress Timeline Strip */}
      <div className="w-full h-1 bg-[#0B1520] relative overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-[#00D4FF] via-[#FF8C1A] to-[#00E676] transition-all duration-100"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Hero Central Stage */}
      <main className="relative flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-6 flex flex-col justify-center items-center overflow-hidden">
        {/* Call-to-action Overlay for Unblocking Voice Narration on First Interaction */}
        {!hasStartedWithVoice && (
          <div className="w-full max-w-2xl mb-4 bg-gradient-to-r from-[#00D4FF]/20 via-[#071018] to-[#FF8C1A]/20 border border-[#00D4FF]/50 rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4 z-40 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#00D4FF]/20 text-[#00D4FF] animate-pulse">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-mono font-bold text-[#EAF2F7]">
                  EXPERIENCE WITH DYNAMIC RADIO VOICE NARRATION
                </h3>
                <p className="text-xs text-[#81909B] font-sans">
                  Listen to authentic synthesized railway radio dispatch commentary during corridor crisis and AI resolution.
                </p>
              </div>
            </div>
            <button
              onClick={startStoryWithVoice}
              className="px-5 py-2.5 rounded-xl bg-[#00D4FF] hover:bg-[#38BDF8] text-[#03070B] font-mono text-xs font-black uppercase tracking-wider shadow-xl transition-all hover:scale-105 shrink-0 flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>PLAY WITH VOICE</span>
            </button>
          </div>
        )}

        {/* Narrative Subtitle Banner */}
        <div className="w-full max-w-4xl mb-3 flex justify-center z-20 shrink-0">
          <CinematicCaption
            title={frame.caption || ""}
            subtitle={frame.subCaption}
            phase={frame.phase}
          />
        </div>

        {/* Live Digital Twin Track Canvas */}
        <div className="relative w-full h-[400px] lg:h-[450px] rounded-2xl border border-[#162434] bg-[#071018]/95 backdrop-blur-xl shadow-2xl overflow-hidden shrink-0">
          {/* Beat 4: Unmanaged Emergency Braking Trip Callout */}
          {frame.phase === "GRIDLOCK" && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#EF4444]/95 text-white border border-[#FF5252] px-5 py-2 rounded-xl font-mono text-xs font-black shadow-2xl flex items-center gap-2.5 animate-bounce">
              <AlertTriangle className="w-5 h-5" />
              <span>WITHOUT AI INTERVENTION: EMERGENCY BRAKE TRIP • +41 MIN CASCADE DELAY</span>
            </div>
          )}

          {/* Beat 6: Explicit Before vs After Proof Comparison Card */}
          {(frame.phase === "RESOLVING" || frame.phase === "OPTIMAL") && (
            <div className="absolute top-4 right-4 z-40 bg-[#071018]/95 border border-[#00E676]/60 p-4 rounded-xl shadow-2xl backdrop-blur-md font-mono text-xs space-y-2 animate-in fade-in duration-300">
              <div className="text-[10px] font-bold text-[#81909B] uppercase border-b border-[#162434] pb-1.5 flex items-center gap-1.5">
                <GitCompare className="w-4 h-4 text-[#00E676]" />
                <span>DISPATCH OUTCOME PROOF</span>
              </div>
              <div className="flex items-center justify-between gap-6 text-[#FF4D4D]">
                <span>STATUS QUO (NO AI):</span>
                <strong>+45.0m Delay (3 Stalled)</strong>
              </div>
              <div className="flex items-center justify-between gap-6 text-[#00E676] font-bold">
                <span>RAILOPT-X CP-SAT:</span>
                <strong>+3.2m Hold (0 Conflicts)</strong>
              </div>
              <div className="text-[10px] text-[#00D4FF] pt-1 border-t border-[#162434]">
                SAVED: 41.8 MINUTES • 0 INVARIANT VIOLATIONS
              </div>
            </div>
          )}

          {/* Dynamic Voice-Over Subtitle Stream */}
          {voiceCaption && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#071018]/95 border border-[#00D4FF]/50 text-[#EAF2F7] px-5 py-2 rounded-full font-mono text-xs shadow-2xl backdrop-blur-md flex items-center gap-2.5 animate-in fade-in duration-150">
              <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-ping" />
              <Radio className="w-3.5 h-3.5 text-[#00D4FF] animate-pulse" />
              <span className="font-bold text-[#CAD6E2]">{voiceCaption.text}</span>
            </div>
          )}

          <NXTrackCanvas
            trains={frame.trains}
            blocks={frame.blocks}
            predictedConflicts={frame.predictedConflicts}
            onSelectTrain={() => {}}
            onSelectConflict={() => {}}
          />

          {/* Future Worlds Counterfactual Overlay */}
          {(frame.phase === "FUTURE_WORLDS" || frame.phase === "RESOLVING") && (
            <FutureWorldsOverlay plans={frame.candidatePlans} />
          )}
        </div>
      </main>

      {/* Bottom KPI Rail & Traffic Teleprinter */}
      <footer className="relative z-30 border-t border-[#162434] bg-[#071018]/95 backdrop-blur-md px-6 py-3 space-y-3 shrink-0">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
          {/* Real Split-Flap Mechanical KPI Rail (3 Cols) */}
          <div className="lg:col-span-3">
            <SplitFlapRail
              kpis={frame.kpis}
              simTimeFormatted={new Date(frame.t).toISOString().substr(14, 5)}
              isRunning={!isPaused}
              timeScale={1}
              onTogglePlay={() => setIsPaused((p) => !p)}
              onScaleChange={() => {}}
              onReset={() => {}}
            />
          </div>

          {/* Enter OCC CTA Button */}
          <div className="text-right">
            <Magnetic tier="safety-ack">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSkip();
                }}
                className="w-full lg:w-auto px-6 py-3 rounded-xl font-mono text-xs font-black uppercase tracking-wider transition-all shadow-2xl flex items-center justify-center gap-2 bg-[#00D4FF] hover:bg-[#38BDF8] text-[#03070B] hover:shadow-[0_0_24px_rgba(0,212,255,0.4)] cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>ENTER OPERATIONS CONTROL</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </Magnetic>
          </div>
        </div>

        {/* Real Traffic Teleprinter System Event Stream */}
        <div className="w-full">
          <TrafficTeleprinter
            logs={teleprinterLogs}
            solverStatus={frame.phase === "OPTIMAL" ? "OPTIMAL" : frame.phase === "FUTURE_WORLDS" ? "RUNNING" : "READY"}
            className="h-28 lg:h-32"
          />
        </div>
      </footer>
    </div>
  );
};

export default LandingCinematic;
