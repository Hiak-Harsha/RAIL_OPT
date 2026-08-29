/**
 * RAILOPT-X 2.0 — Dynamic Voice-Over & Spoken Alert Engine (Web Speech API)
 * 
 * STRICT VOICE GATING POLICY:
 * Voice speech synthesis is strictly restricted to exactly two triggers:
 * 1. Once, when the simulation/cinematic starts (announceSimulationStart)
 * 2. When a real or scripted conflict occurs (announceConflict / speakAlert)
 * 
 * Features:
 * - Phonetic train ID conversion (e.g. "22436" -> "train two two four three six")
 * - Background train audio ducking during speech
 * - Real-time captions / subtitle broadcasting for all phases
 * - Chromium garbage-collection protection & auto-resume watchdog
 */

import { RailwayAudio } from "./RailwayAudioEngine";

export interface VoiceCaption {
  text: string;
  type: "ALERT" | "DECISION" | "NARRATION";
  timestamp: number;
}

type CaptionListener = (caption: VoiceCaption | null) => void;

class VoiceOverEngineService {
  private synth: SpeechSynthesis | null = null;
  private isMuted: boolean = false;
  private captionListeners: Set<CaptionListener> = new Set();
  private queue: Array<{ text: string; type: "ALERT" | "DECISION" | "NARRATION"; isUrgent: boolean }> = [];
  private isSpeaking: boolean = false;
  public currentUtterance: SpeechSynthesisUtterance | null = null;
  private availableVoices: SpeechSynthesisVoice[] = [];
  private watchdogTimer: any = null;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    try {
      this.availableVoices = this.synth.getVoices();
    } catch {
      this.availableVoices = [];
    }
  }

  public subscribeCaptions(listener: CaptionListener): () => void {
    this.captionListeners.add(listener);
    return () => this.captionListeners.delete(listener);
  }

  private notifyCaption(caption: VoiceCaption | null) {
    this.captionListeners.forEach((fn) => fn(caption));
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.synth) {
      try {
        this.synth.cancel();
      } catch {
        // Safe catch
      }
      this.queue = [];
      this.isSpeaking = false;
      this.currentUtterance = null;
      RailwayAudio.setDucked(false);
      this.notifyCaption(null);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Converts train numbers into phonetic radio procedure words (e.g. "T22436" -> "train two two four three six")
   */
  public phonetize(text: string): string {
    const digitMap: Record<string, string> = {
      "0": "zero ",
      "1": "one ",
      "2": "two ",
      "3": "three ",
      "4": "four ",
      "5": "five ",
      "6": "six ",
      "7": "seven ",
      "8": "eight ",
      "9": "nine ",
    };

    return text.replace(/(?:train\s+)?\bT?(\d{4,5})\b/gi, (_, digits) => {
      const spelled = digits
        .split("")
        .map((d: string) => digitMap[d] || d)
        .join("");
      return `train ${spelled.trim()}`;
    });
  }

  /**
   * TRIGGER 1: Spoken introduction when simulation or cinematic starts.
   * Fires exactly once per session/run.
   */
  public announceSimulationStart(text: string) {
    this.speak(text, "NARRATION", false);
  }

  /**
   * TRIGGER 2: Spoken conflict alert on predicted crossing or headway hazard.
   */
  public announceConflict(text: string) {
    this.speak(text, "ALERT", true);
  }

  /**
   * Alias for backwards compatibility with useSimulationAudio.ts
   */
  public speakAlert(text: string) {
    this.announceConflict(text);
  }

  /**
   * Gated: Decisions display captions/logs but produce NO synthesized speech.
   */
  public speakDecision(text: string) {
    // Caption-only broadcast per voice-gating requirements
    this.notifyCaption({
      text: this.phonetize(text),
      type: "DECISION",
      timestamp: Date.now(),
    });
  }

  /**
   * Gated: General narrations display captions but produce NO synthesized speech
   * unless explicitly triggered through announceSimulationStart.
   */
  public speakNarration(text: string) {
    // Caption-only broadcast per voice-gating requirements
    this.notifyCaption({
      text: this.phonetize(text),
      type: "NARRATION",
      timestamp: Date.now(),
    });
  }

  /**
   * Manual user-initiated radio test button (OCCHeader.tsx)
   */
  public testVoice() {
    this.setMuted(false);
    this.speak("Radio check. All corridor sectors reporting green. Section control AI online.", "ALERT", true);
  }

  private speak(text: string, type: "ALERT" | "DECISION" | "NARRATION", isUrgent: boolean) {
    if (this.isMuted || !this.synth || !text.trim()) return;

    if (isUrgent) {
      try {
        this.synth.cancel();
      } catch {
        // Safe catch
      }
      this.queue = [];
      this.isSpeaking = false;
      this.currentUtterance = null;
    }

    this.queue.push({ text: this.phonetize(text), type, isUrgent });
    this.processQueue();
  }

  private getBestVoice(): SpeechSynthesisVoice | null {
    if (this.availableVoices.length === 0) {
      this.loadVoices();
    }
    
    // Priority: English natural/google/david/zira
    const enVoices = this.availableVoices.filter((v) => v.lang.startsWith("en"));
    if (enVoices.length === 0) return this.availableVoices[0] || null;

    const preferred = enVoices.find((v) => 
      v.name.includes("Natural") || 
      v.name.includes("Google") || 
      v.name.includes("David") || 
      v.name.includes("George") ||
      v.name.includes("Zira") ||
      v.name.includes("Samantha")
    );

    return preferred || enVoices[0];
  }

  private processQueue() {
    if (this.isSpeaking || this.queue.length === 0 || !this.synth) return;

    const item = this.queue.shift();
    if (!item) return;

    this.isSpeaking = true;
    RailwayAudio.setDucked(true);

    try {
      if (this.synth.paused) {
        this.synth.resume();
      }
    } catch {
      // Ignore
    }

    const utterance = new SpeechSynthesisUtterance(item.text);
    this.currentUtterance = utterance; // Prevent garbage collection in Chromium

    // Radio dispatcher speech acoustics
    utterance.rate = 1.02;
    utterance.pitch = 0.96;
    utterance.volume = 1.0;

    const voice = this.getBestVoice();
    if (voice) utterance.voice = voice;

    this.notifyCaption({
      text: item.text,
      type: item.type,
      timestamp: Date.now(),
    });

    const cleanup = () => {
      if (this.watchdogTimer) {
        clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
      }
      this.isSpeaking = false;
      this.currentUtterance = null;
      RailwayAudio.setDucked(false);
      this.notifyCaption(null);
      this.processQueue();
    };

    utterance.onend = cleanup;
    utterance.onerror = cleanup;

    // Watchdog timer in case browser fails to fire onend
    const maxDurationMs = Math.max(3000, item.text.length * 120);
    this.watchdogTimer = setTimeout(() => {
      if (this.isSpeaking) {
        cleanup();
      }
    }, maxDurationMs);

    try {
      this.synth.speak(utterance);
    } catch {
      cleanup();
    }
  }

  public stopAll() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {
        // Safe catch
      }
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.queue = [];
    this.isSpeaking = false;
    this.currentUtterance = null;
    RailwayAudio.setDucked(false);
    this.notifyCaption(null);
  }
}

export const VoiceOverEngine = new VoiceOverEngineService();
