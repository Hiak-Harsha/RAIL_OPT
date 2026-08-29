/**
 * RAILOPT-X 2.0 — Asset-Only Spatialized Railway Audio Engine
 * 
 * Provides authentic, opt-in, spatially-panned audio:
 * - Real audio assets for locomotive loops & mechanical interlocking cues
 * - Continuous distance attenuation and left/right stereo panning via AudioSpatializer
 * - Dynamic background audio ducking during dispatcher speech synthesis
 * - Zero artificial buzzing or synthetic oscillator tones
 */

import type { SignalAspect } from "../types/railway";
import type { TrainClass } from "./TrainAudioController";
import { AudioSpatializer, type SpatialNodeChain } from "./AudioSpatializer";

type Cue = "relay" | "alert" | "commit" | "teleprinter";

const ASSETS: Record<Cue, string> = {
  relay: "/audio/relay-click.ogg",
  alert: "/audio/controller-alert.ogg",
  commit: "/audio/route-lock.ogg",
  teleprinter: "/audio/teleprinter.ogg",
};

const TRAIN_LOOPS: Record<TrainClass, string> = {
  EXPRESS: "/audio/train-express-loop.ogg",
  FREIGHT: "/audio/train-freight-loop.ogg",
  MEMU: "/audio/train-memu-loop.ogg",
  PASSENGER: "/audio/train-passenger-loop.ogg",
};

class RailwayAudioEngine {
  private muted = true;
  private enabled = false;
  private isDucked = false;
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  public spatializer: AudioSpatializer | null = null;

  private trainLoops = new Map<string, {
    audio: HTMLAudioElement;
    sourceNode?: MediaElementAudioSourceNode;
    spatialChain?: SpatialNodeChain;
    trainClass: TrainClass;
  }>();

  private initAudioContext() {
    if (!this.audioCtx && typeof window !== "undefined" && ("AudioContext" in window || "webkitAudioContext" in window)) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);
      this.spatializer = new AudioSpatializer(this.audioCtx);
    }
  }

  public async resume(): Promise<boolean> {
    this.enabled = true;
    this.initAudioContext();
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      try {
        await this.audioCtx.resume();
      } catch {
        // Safe catch
      }
    }
    return true;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.stopAll();
    }
  }

  public getMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public getIsUnlocked(): boolean {
    return this.enabled;
  }

  public setDucked(ducked: boolean) {
    this.isDucked = ducked;
    const factor = ducked ? 0.25 : 1.0;
    this.trainLoops.forEach(({ audio }) => {
      audio.volume = audio.volume * factor;
    });
  }

  private playCue(cue: Cue, volume = 0.18) {
    if (this.muted || !this.enabled || typeof Audio === "undefined") return;
    try {
      const sound = new Audio(ASSETS[cue]);
      sound.volume = volume;
      sound.play().catch(() => undefined);
    } catch {
      // Safe catch
    }
  }

  /**
   * Updates train speed acoustics with left/right spatial stereo panning relative to camera
   */
  public updateTrainSpeed(
    trainId: string,
    speedKmh: number,
    trainClass: TrainClass = "EXPRESS",
    _isCruisingOrAccel = true,
    trainKm?: number,
    cameraFocusKm: number = 160
  ) {
    if (this.muted || !this.enabled || typeof Audio === "undefined") return;
    this.initAudioContext();

    let entry = this.trainLoops.get(trainId);
    if (!entry) {
      const audio = new Audio(TRAIN_LOOPS[trainClass]);
      audio.loop = true;
      audio.volume = 0;

      let sourceNode: MediaElementAudioSourceNode | undefined;
      let spatialChain: SpatialNodeChain | undefined;

      if (this.audioCtx && this.masterGain && this.spatializer) {
        try {
          sourceNode = this.audioCtx.createMediaElementSource(audio);
          spatialChain = this.spatializer.createSpatialChain(this.masterGain);
          sourceNode.connect(spatialChain.inputGain);
        } catch {
          // MediaElementSource fallback
        }
      }

      entry = { audio, sourceNode, spatialChain, trainClass };
      this.trainLoops.set(trainId, entry);
    }

    const { audio, spatialChain } = entry;

    // Update spatial panning if camera and train positions are known
    if (this.spatializer && spatialChain && trainKm !== undefined) {
      this.spatializer.updateCamera(cameraFocusKm, 0);
      this.spatializer.updateSpatialSource(spatialChain, trainKm, 0, false, 95.0);
    }

    const baseVol = Math.min(0.18, Math.max(0, speedKmh / 130) * 0.18);
    audio.volume = this.isDucked ? baseVol * 0.25 : baseVol;
    audio.playbackRate = Math.max(0.8, Math.min(1.15, 0.8 + speedKmh / 400));

    if (speedKmh > 3) {
      audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }

  public transitionScene(_state: string, _durationSec = 0.8) {
    // Scene-based acoustic transitions
  }

  public playTeleprinter(_text: string) {
    this.playCue("teleprinter", 0.11);
  }

  public playPlanCommit() {
    this.playCue("commit", 0.18);
  }

  public playSignalChange(_aspect: SignalAspect) {
    this.playCue("relay", 0.12);
  }

  public playConflictAlert() {
    this.playCue("alert", 0.22);
  }

  public stopAll() {
    this.trainLoops.forEach(({ audio }) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.trainLoops.clear();
  }
}

export const RailwayAudio = new RailwayAudioEngine();
