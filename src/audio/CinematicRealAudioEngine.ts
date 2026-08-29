/**
 * RAILOPT-X 2.0 — Cinematic Real Audio Bed & Beatmap Sync Engine
 * 
 * Manages:
 * 1. Sample-accurate playback of real field-recorded train ambience (`train-ambience-real.mp3`)
 *    via Web Audio API AudioBufferSourceNode + GainNode.
 * 2. Phase-driven gain automation (CALM -> ESCALATING -> GRIDLOCK -> FUTURE_WORLDS -> OPTIMAL).
 * 3. 152 BPM beatmap lookup (onset micro-jolts and 10Hz intensity envelope).
 */

export interface OnsetEvent {
  t: number;
  strength: number;
}

export interface IntensityPoint {
  t: number;
  level: number;
}

export interface BeatmapData {
  source_file: string;
  duration_sec: number;
  estimated_tempo_bpm: number;
  onsets: OnsetEvent[];
  intensity_curve_10hz: IntensityPoint[];
}

export interface BeatSyncState {
  microPulse: number; // 0.0 - 1.0 momentary wheel/bogie pulse
  macroIntensity: number; // 0.0 - 1.0 loudness/energy level
  speedMultiplier: number; // 0.95 - 1.08 visual speed breathing multiplier
  bogieBobPx: number; // -1.5px to +1.5px vertical micro-bob
}

class CinematicRealAudioEngineService {
  private audioCtx: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private isMuted: boolean = false;
  private beatmap: BeatmapData | null = null;
  private isLoading: boolean = false;

  constructor() {
    // Lazy initialization on user gesture
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === "closed") {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate: 44100 });
    }
    return this.audioCtx;
  }

  public async preload(): Promise<void> {
    if (this.audioBuffer && this.beatmap) return;
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      // 1. Fetch and decode audio buffer
      const audioPromise = fetch("/audio/train-ambience-real.mp3")
        .then((res) => res.arrayBuffer())
        .then((buf) => {
          const ctx = this.getAudioContext();
          return ctx.decodeAudioData(buf);
        });

      // 2. Fetch beatmap JSON
      const beatmapPromise = fetch("/audio/train-ambience-real-beatmap.json")
        .then((res) => res.json());

      const [decodedAudio, loadedBeatmap] = await Promise.all([audioPromise, beatmapPromise]);
      this.audioBuffer = decodedAudio;
      this.beatmap = loadedBeatmap as BeatmapData;
    } catch (e) {
      console.warn("Could not load real train audio bed or beatmap:", e);
    } finally {
      this.isLoading = false;
    }
  }

  public async start(offsetSec: number = 0, initialPhase: string = "CALM"): Promise<void> {
    const ctx = this.getAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    await this.preload();
    if (!this.audioBuffer) return;

    this.stop();

    const source = ctx.createBufferSource();
    source.buffer = this.audioBuffer;
    source.loop = true;

    const gain = ctx.createGain();
    const targetGain = this.getPhaseGain(initialPhase);
    gain.gain.setValueAtTime(this.isMuted ? 0 : targetGain, ctx.currentTime);

    source.connect(gain);
    gain.connect(ctx.destination);

    const safeOffset = Math.max(0, offsetSec % this.audioBuffer.duration);
    source.start(0, safeOffset);

    this.sourceNode = source;
    this.gainNode = gain;
  }

  public stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Safe catch
      }
      this.sourceNode = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        // Safe catch
      }
      this.gainNode = null;
    }
  }

  public setPhase(phase: string): void {
    if (!this.gainNode || !this.audioCtx) return;
    const targetGain = this.isMuted ? 0 : this.getPhaseGain(phase);
    this.gainNode.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.2);
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setTargetAtTime(muted ? 0 : 0.4, this.audioCtx.currentTime, 0.05);
    }
  }

  private getPhaseGain(phase: string): number {
    switch (phase) {
      case "CALM":
        return 0.35;
      case "ESCALATING":
      case "GRIDLOCK_APPROACH":
        return 0.60;
      case "GRIDLOCK":
        return 0.85;
      case "FUTURE_WORLDS":
        return 0.50;
      case "RESOLVING":
      case "OPTIMAL":
        return 0.30;
      default:
        return 0.40;
    }
  }

  /**
   * Deterministic Beat Sync Lookup
   * Given elapsed time in seconds, returns micro and macro sync state
   */
  public getBeatSync(elapsedSec: number): BeatSyncState {
    if (!this.beatmap) {
      return { microPulse: 0, macroIntensity: 0.2, speedMultiplier: 1.0, bogieBobPx: 0 };
    }

    const t = Math.max(0, elapsedSec % (this.beatmap.duration_sec || 121.42));

    // 1. Micro-sync: Find nearest onset in range [t - 0.14, t]
    let microPulse = 0;
    const onsets = this.beatmap.onsets;
    for (let i = 0; i < onsets.length; i++) {
      const o = onsets[i];
      if (o.t > t) break;
      const delta = t - o.t;
      if (delta >= 0 && delta <= 0.14) {
        // Fast exponential decay pulse
        const decay = Math.exp(-delta / 0.04);
        const pulse = o.strength * decay;
        if (pulse > microPulse) microPulse = pulse;
      }
    }

    // 2. Macro-sync: Intensity envelope at 10Hz
    let macroIntensity = 0.15;
    const intensityCurve = this.beatmap.intensity_curve_10hz;
    if (intensityCurve && intensityCurve.length > 0) {
      const idx = Math.min(intensityCurve.length - 1, Math.max(0, Math.floor(t * 10)));
      macroIntensity = intensityCurve[idx]?.level ?? 0.15;
    }

    // 3. Compute speed breathing and bogie bobbing
    const speedMultiplier = 1.0 + (macroIntensity - 0.15) * 0.08;
    const bogieBobPx = (microPulse * 1.8) + (macroIntensity * 0.8);

    return {
      microPulse,
      macroIntensity,
      speedMultiplier,
      bogieBobPx,
    };
  }
}

export const CinematicRealAudio = new CinematicRealAudioEngineService();
