/**
 * AudioScene — State-Driven Multi-Track Acoustic Scene Manager for RAILOPT-X 2.0.
 * 
 * Manages atmospheric balance and smooth crossfades between:
 *  - CALM: Subtle open-corridor ambient wind, distant rails
 *  - TRAFFIC_BUILD: Approaching rakes, station activity
 *  - CONGESTION / CONFLICT: Compressed tension, mechanical brake hiss, subtle alert
 *  - OPTIMIZING: OCC control-room hum, teleprinter key chatter, solver relay
 *  - RECOVERY / DECISION: Route locking, signal green clearing, accelerating rake
 *  - OCC: Balanced live control-room background
 */
import { AudioBusManager } from "./AudioBus";

export type AudioSceneState =
  | "CALM"
  | "TRAFFIC_BUILD"
  | "CONGESTION"
  | "CONFLICT"
  | "OPTIMIZING"
  | "DECISION"
  | "RECOVERY"
  | "OCC";

export interface SceneMixProfile {
  ambience: number;
  trains: number;
  infra: number;
  control: number;
  alerts: number;
}

export const SCENE_MIX_PROFILES: Record<AudioSceneState, SceneMixProfile> = {
  CALM: {
    ambience: 0.6,
    trains: 0.35,
    infra: 0.2,
    control: 0.05,
    alerts: 0.0,
  },
  TRAFFIC_BUILD: {
    ambience: 0.5,
    trains: 0.55,
    infra: 0.35,
    control: 0.15,
    alerts: 0.0,
  },
  CONGESTION: {
    ambience: 0.4,
    trains: 0.45,
    infra: 0.5,
    control: 0.3,
    alerts: 0.1,
  },
  CONFLICT: {
    ambience: 0.35,
    trains: 0.4,
    infra: 0.55,
    control: 0.35,
    alerts: 0.25,
  },
  OPTIMIZING: {
    ambience: 0.3,
    trains: 0.25,
    infra: 0.45,
    control: 0.65, // Teleprinter & solver prominent
    alerts: 0.05,
  },
  DECISION: {
    ambience: 0.4,
    trains: 0.4,
    infra: 0.6, // Heavy relay latch
    control: 0.45,
    alerts: 0.0,
  },
  RECOVERY: {
    ambience: 0.55,
    trains: 0.65, // Train accelerating away
    infra: 0.35,
    control: 0.2,
    alerts: 0.0,
  },
  OCC: {
    ambience: 0.45,
    trains: 0.5,
    infra: 0.4,
    control: 0.3,
    alerts: 0.05,
  },
};

export class AudioSceneManager {
  private busManager: AudioBusManager;
  private currentState: AudioSceneState = "CALM";

  constructor(busManager: AudioBusManager) {
    this.busManager = busManager;
  }

  public transitionTo(state: AudioSceneState, crossfadeDurationSec = 0.8) {
    this.currentState = state;
    const profile = SCENE_MIX_PROFILES[state] || SCENE_MIX_PROFILES.CALM;

    this.busManager.setChannelVolume("ambienceGain", profile.ambience, crossfadeDurationSec);
    this.busManager.setChannelVolume("trainsGain", profile.trains, crossfadeDurationSec);
    this.busManager.setChannelVolume("infraGain", profile.infra, crossfadeDurationSec);
    this.busManager.setChannelVolume("controlGain", profile.control, crossfadeDurationSec);
    this.busManager.setChannelVolume("alertsGain", profile.alerts, crossfadeDurationSec);
  }

  public getCurrentState(): AudioSceneState {
    return this.currentState;
  }
}
