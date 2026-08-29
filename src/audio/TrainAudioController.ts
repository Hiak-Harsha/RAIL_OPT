/**
 * TrainAudioController — Physical Train Acoustic Synthesizer & Profile Manager.
 * 
 * Implements:
 *  - Train-class specific acoustic profiles (Express, Freight, MEMU, Passenger)
 *  - Continuous multi-harmonic bogie & traction friction beds
 *  - Physics-derived track-joint cadence (cadence = joint_spacing / speed_mps)
 *  - Realistic multi-stage pneumatic air braking & pipe release
 */

export type TrainClass = "EXPRESS" | "FREIGHT" | "MEMU" | "PASSENGER";

export interface TrainAudioProfile {
  name: TrainClass;
  baseRumbleFreq: number;
  tractionHarmonics: number[]; // e.g. [180, 360, 540]
  jointSpacingMeters: number;   // standard Indian rail joint spacing ~13.7m
  rumbleGainMax: number;
  tractionGainMax: number;
  brakeAirCutoffFreq: number;
}

export const TRAIN_PROFILES: Record<TrainClass, TrainAudioProfile> = {
  EXPRESS: {
    name: "EXPRESS",
    baseRumbleFreq: 75,
    tractionHarmonics: [180, 360, 540, 720],
    jointSpacingMeters: 13.7,
    rumbleGainMax: 0.45,
    tractionGainMax: 0.35,
    brakeAirCutoffFreq: 1800,
  },
  FREIGHT: {
    name: "FREIGHT",
    baseRumbleFreq: 45, // Deeper low rumble
    tractionHarmonics: [110, 220, 330],
    jointSpacingMeters: 13.7,
    rumbleGainMax: 0.7, // Heavy rolling weight
    tractionGainMax: 0.25,
    brakeAirCutoffFreq: 1200,
  },
  MEMU: {
    name: "MEMU",
    baseRumbleFreq: 65,
    tractionHarmonics: [220, 440, 660, 880], // High EMU whine
    jointSpacingMeters: 13.7,
    rumbleGainMax: 0.4,
    tractionGainMax: 0.5,
    brakeAirCutoffFreq: 2200,
  },
  PASSENGER: {
    name: "PASSENGER",
    baseRumbleFreq: 60,
    tractionHarmonics: [160, 320, 480],
    jointSpacingMeters: 13.7,
    rumbleGainMax: 0.5,
    tractionGainMax: 0.3,
    brakeAirCutoffFreq: 1600,
  },
};

export class TrainAudioVoice {
  private ctx: AudioContext;
  private outputNode: AudioNode;
  private profile: TrainAudioProfile;

  // Continuous nodes
  private rumbleGain: GainNode;
  private rumbleOsc: OscillatorNode | null = null;
  private tractionGain: GainNode;
  private tractionOscs: OscillatorNode[] = [];

  // Wheel joint cadence timer
  private jointTimer: ReturnType<typeof setTimeout> | null = null;
  private isBraking = false;
  private lastSpeedKmh = 0;

  constructor(ctx: AudioContext, outputNode: AudioNode, profile: TrainAudioProfile = TRAIN_PROFILES.EXPRESS) {
    this.ctx = ctx;
    this.outputNode = outputNode;
    this.profile = profile;

    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.setValueAtTime(0, ctx.currentTime);
    this.rumbleGain.connect(outputNode);

    this.tractionGain = ctx.createGain();
    this.tractionGain.gain.setValueAtTime(0, ctx.currentTime);
    this.tractionGain.connect(outputNode);
  }

  public start() {
    this.stop();

    // 1. Low frequency bogie rolling bed
    const rumbleOsc = this.ctx.createOscillator();
    rumbleOsc.type = "sine";
    rumbleOsc.frequency.setValueAtTime(this.profile.baseRumbleFreq, this.ctx.currentTime);
    rumbleOsc.connect(this.rumbleGain);
    rumbleOsc.start();
    this.rumbleOsc = rumbleOsc;

    // 2. Multi-harmonic traction motor whine
    this.tractionOscs = this.profile.tractionHarmonics.map((baseFreq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = idx % 2 === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

      const harmonicGain = this.ctx.createGain();
      harmonicGain.gain.setValueAtTime(1.0 / (idx + 1.2), this.ctx.currentTime);
      osc.connect(harmonicGain);
      harmonicGain.connect(this.tractionGain);

      osc.start();
      return osc;
    });
  }

  public updateSpeed(speedKmh: number, isCruisingOrAccel: boolean) {
    const speedRatio = Math.max(0, Math.min(1, speedKmh / 130.0));

    // Dynamic continuous rumble volume & pitch modulation
    const targetRumbleGain = speedRatio * this.profile.rumbleGainMax;
    this.rumbleGain.gain.setTargetAtTime(targetRumbleGain, this.ctx.currentTime, 0.15);

    if (this.rumbleOsc) {
      const pitchMod = this.profile.baseRumbleFreq + speedRatio * 45;
      this.rumbleOsc.frequency.setTargetAtTime(pitchMod, this.ctx.currentTime, 0.2);
    }

    // Dynamic traction whine volume & frequency shift
    const targetTractionGain = isCruisingOrAccel ? speedRatio * this.profile.tractionGainMax : targetRumbleGain * 0.3;
    this.tractionGain.gain.setTargetAtTime(targetTractionGain, this.ctx.currentTime, 0.2);

    this.tractionOscs.forEach((osc, idx) => {
      const baseF = this.profile.tractionHarmonics[idx];
      const shiftedF = baseF * (0.8 + speedRatio * 0.9);
      osc.frequency.setTargetAtTime(shiftedF, this.ctx.currentTime, 0.2);
    });

    // Check for braking deceleration
    if (this.lastSpeedKmh > 20 && speedKmh < this.lastSpeedKmh - 5 && !this.isBraking) {
      this.triggerBrakeHiss();
    }
    this.lastSpeedKmh = speedKmh;

    // Schedule next physics-derived wheel-joint clatter
    this.scheduleNextJoint(speedKmh);
  }

  private scheduleNextJoint(speedKmh: number) {
    if (this.jointTimer) {
      clearTimeout(this.jointTimer);
      this.jointTimer = null;
    }

    if (speedKmh < 8) return; // Silent at near-zero stop

    const speedMps = (speedKmh * 1000) / 3600;
    // Physical cadence period = distance between joint sound points / velocity
    const periodMs = Math.max(120, Math.min(1800, (this.profile.jointSpacingMeters / speedMps) * 1000));

    this.jointTimer = setTimeout(() => {
      this.playWheelJointClick(speedKmh);
      this.scheduleNextJoint(this.lastSpeedKmh);
    }, periodMs);
  }

  private playWheelJointClick(speedKmh: number) {
    const norm = Math.max(0.1, Math.min(1.0, speedKmh / 120.0));

    // Two-stage wheel clatter transient (bogie front + rear axle pair)
    [0, 0.045].forEach((offset, idx) => {
      const clickOsc = this.ctx.createOscillator();
      clickOsc.type = "sine";
      clickOsc.frequency.setValueAtTime(idx === 0 ? 220 : 190, this.ctx.currentTime + offset);
      clickOsc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + offset + 0.035);

      const clickGain = this.ctx.createGain();
      const vol = norm * (idx === 0 ? 0.35 : 0.25);
      clickGain.gain.setValueAtTime(vol, this.ctx.currentTime + offset);
      clickGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + offset + 0.04);

      clickOsc.connect(clickGain);
      clickGain.connect(this.outputNode);

      clickOsc.start(this.ctx.currentTime + offset);
      clickOsc.stop(this.ctx.currentTime + offset + 0.05);
    });
  }

  public triggerBrakeHiss() {
    this.isBraking = true;
    const duration = 1.4;

    // Filtered noise transient simulating pneumatic train air exhaust
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.6));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(this.profile.brakeAirCutoffFreq, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.outputNode);

    noise.start();
    setTimeout(() => {
      this.isBraking = false;
    }, duration * 1000);
  }

  public stop() {
    if (this.jointTimer) {
      clearTimeout(this.jointTimer);
      this.jointTimer = null;
    }
    if (this.rumbleOsc) {
      try {
        this.rumbleOsc.stop();
        this.rumbleOsc.disconnect();
      } catch (e) {}
      this.rumbleOsc = null;
    }
    this.tractionOscs.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    });
    this.tractionOscs = [];
  }
}
