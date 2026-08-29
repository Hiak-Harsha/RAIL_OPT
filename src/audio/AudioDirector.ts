/**
 * RAILOPT-X 2.0 — Central Audio Director Subsystem
 * 
 * Features:
 * - Strictly muted by default (user opt-in via UI toggle or unmute action)
 * - Dynamic spatial acoustic positioning based on train distance from active camera
 * - Speed and acceleration pitch modulation
 * - Switch throw, relay click, and alert synthesized cues
 */

import { AudioBusManager } from "./AudioBus";
import { TrainAudioVoice, TRAIN_PROFILES } from "./TrainAudioController";
import { TeleprinterAudioController } from "./TeleprinterAudioController";
import type { Train } from "../types/railway";

export class AudioDirector {
  private static instance: AudioDirector | null = null;
  private ctx: AudioContext | null = null;
  private busManager: AudioBusManager | null = null;
  private trainVoices: Map<string, TrainAudioVoice> = new Map();
  private teleprinterAudio: TeleprinterAudioController | null = null;
  private isMuted: boolean = true;
  private masterVolume: number = 0.75;

  private constructor() {}

  public static getInstance(): AudioDirector {
    if (!AudioDirector.instance) {
      AudioDirector.instance = new AudioDirector();
    }
    return AudioDirector.instance;
  }

  public init(): void {
    if (this.ctx) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      this.ctx = new AudioCtxClass();
      this.busManager = new AudioBusManager(this.ctx);
      this.teleprinterAudio = new TeleprinterAudioController(this.ctx, this.busManager.getBus("controlGain"));

      // Strictly muted initially until operator clicks toggle
      if (this.isMuted) {
        this.busManager.muteAll();
      }
    } catch (e) {
      console.warn("AudioDirector: Web Audio API initialization deferred", e);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    if (this.busManager) {
      if (this.isMuted) {
        this.busManager.muteAll();
      } else {
        this.busManager.unmuteAll(this.masterVolume);
      }
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (!this.isMuted && this.busManager) {
      this.busManager.unmuteAll(this.masterVolume);
    }
  }

  public updateSpatialScene(
    trains: Train[],
    listenerKm: number,
    listenerLod: "MACRO" | "MESO" | "MICRO"
  ): void {
    if (this.isMuted || !this.ctx || !this.busManager) return;

    // In Macro mode (>150km span), silence individual traction engines to prevent noise wall
    if (listenerLod === "MACRO") {
      for (const voice of this.trainVoices.values()) {
        voice.updateSpeed(0, false);
      }
      return;
    }

    const activeTrainIds = new Set(trains.map((t) => t.train_id));

    // Remove defunct trains
    for (const [id, voice] of this.trainVoices.entries()) {
      if (!activeTrainIds.has(id)) {
        voice.stop();
        this.trainVoices.delete(id);
      }
    }

    // Update active trains with inverse-distance spatialization
    for (const train of trains) {
      let voice = this.trainVoices.get(train.train_id);
      if (!voice) {
        const profile = train.train_id.includes("04403") ? TRAIN_PROFILES.FREIGHT : TRAIN_PROFILES.EXPRESS;
        voice = new TrainAudioVoice(this.ctx, this.busManager.getBus("trainsGain"), profile);
        voice.start();
        this.trainVoices.set(train.train_id, voice);
      }

      const trainKm = train.corridor_position_km ?? train.current_position_km ?? 0.0;
      const distanceKm = Math.abs(trainKm - listenerKm);
      
      if (distanceKm < 15.0) {
        voice.updateSpeed(train.current_speed_kmh, (train.current_accel_ms2 ?? 0) >= 0);
      } else {
        voice.updateSpeed(0, false);
      }
    }
  }

  public playSwitchThrowCue(): void {
    if (this.isMuted || !this.ctx || !this.busManager) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.busManager.getBus("infraGain"));

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Ignore audio synthesis errors
    }
  }

  public playRelayClickCue(): void {
    if (this.isMuted || !this.ctx || !this.busManager) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.03);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(this.busManager.getBus("infraGain"));

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {
      // Ignore audio synthesis errors
    }
  }

  public playAlertChime(): void {
    if (this.isMuted || !this.ctx || !this.busManager) return;
    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(440, now);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.1);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.busManager.getBus("alertsGain"));

      osc1.start(now);
      osc1.stop(now + 0.45);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.45);
    } catch {
      // Ignore audio synthesis errors
    }
  }

  public playTeleprinterKeystroke(): void {
    if (this.isMuted || !this.teleprinterAudio) return;
    this.teleprinterAudio.playSingleKeyStrike();
  }
}
