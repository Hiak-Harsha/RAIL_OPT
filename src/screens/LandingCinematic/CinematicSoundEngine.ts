/**
 * Real-Life Physics-Driven Railway Travelling & OCC Sound Engine for RAILOPT-X.
 * Zero external assets — Pure Web Audio API synthesis.
 * 
 * Features:
 *  - Authentic Indian Railway / Local Train Travelling Cadence (realistic rhythmic wheel click-clack "chuk-chuk... chuk-chuk")
 *  - Speed-synchronized tempo & velocity modulation
 *  - Pneumatic train air-brake release hiss on deceleration/stoppage
 *  - Heavy interlocking relay latch clicks on signal transitions
 *  - Dual-tone AWS / Collision warning horns
 *  - Clean lifecycle management: stopAll() instantly silences on skip/completion/pause
 */

class RealRailwaySoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isUnlocked: boolean = false;

  // Master Gain for instant master volume control & teardown
  private masterGain: GainNode | null = null;

  // Continuous sound generator nodes
  private trainRumbleGain: GainNode | null = null;
  private trainRumbleSource: AudioNode | null = null;
  private motorWhineGain: GainNode | null = null;
  private motorWhineOsc: OscillatorNode | null = null;

  // Rhythmic wheel cadence timer
  private wheelClatterTimer: any = null;
  private currentSpeed: number = 0;
  private isPlayingTrainSound: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      const unlockAudio = () => {
        this.resume();
        window.removeEventListener("pointerdown", unlockAudio);
        window.removeEventListener("keydown", unlockAudio);
        window.removeEventListener("touchstart", unlockAudio);
      };
      window.addEventListener("pointerdown", unlockAudio, { passive: true });
      window.addEventListener("keydown", unlockAudio, { passive: true });
      window.addEventListener("touchstart", unlockAudio, { passive: true });
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().then(() => {
        this.isUnlocked = true;
      }).catch(() => {});
    } else if (this.ctx && this.ctx.state === "running") {
      this.isUnlocked = true;
    }
  }

  public resume(): boolean {
    this.initContext();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    this.isUnlocked = true;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1.0, this.ctx.currentTime);
    }
    return this.isUnlocked;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1.0, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    if (!this.isMuted) {
      this.resume();
    }
    return this.isMuted;
  }

  /**
   * Completely stops all running audio, oscillators, noise generators, and rhythmic cadence loops.
   * Called immediately on Skip, Pause, or OCC Transition.
   */
  public stopAll() {
    if (this.wheelClatterTimer) {
      clearTimeout(this.wheelClatterTimer);
      this.wheelClatterTimer = null;
    }
    this.isPlayingTrainSound = false;
    this.currentSpeed = 0;

    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch {}
    }

    try {
      if (this.motorWhineOsc) {
        this.motorWhineOsc.stop();
        this.motorWhineOsc.disconnect();
        this.motorWhineOsc = null;
      }
      if (this.trainRumbleSource) {
        (this.trainRumbleSource as any).stop?.();
        this.trainRumbleSource.disconnect();
        this.trainRumbleSource = null;
      }
      if (this.masterGain) {
        this.masterGain.disconnect();
        this.masterGain = null;
      }
    } catch {}
  }

  /**
   * Initializes continuous rolling background nodes if not already started.
   */
  private ensureContinuousNodes() {
    if (!this.ctx || this.masterGain) return;

    try {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // 1. Continuous Low-Frequency Trackbed Rolling Rumble
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.03 * white) / 1.03; // Brown/pink noise
        lastOut = data[i];
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;

      const rumbleFilter = this.ctx.createBiquadFilter();
      rumbleFilter.type = "lowpass";
      rumbleFilter.frequency.setValueAtTime(160, this.ctx.currentTime);

      this.trainRumbleGain = this.ctx.createGain();
      this.trainRumbleGain.gain.setValueAtTime(0.01, this.ctx.currentTime);

      noiseSource.connect(rumbleFilter);
      rumbleFilter.connect(this.trainRumbleGain);
      this.trainRumbleGain.connect(this.masterGain);
      noiseSource.start();
      this.trainRumbleSource = noiseSource;

      // 2. Electric Traction Inverter Motor Whine
      this.motorWhineGain = this.ctx.createGain();
      this.motorWhineGain.gain.setValueAtTime(0.004, this.ctx.currentTime);

      this.motorWhineOsc = this.ctx.createOscillator();
      this.motorWhineOsc.type = "triangle";
      this.motorWhineOsc.frequency.setValueAtTime(260, this.ctx.currentTime);

      const motorFilter = this.ctx.createBiquadFilter();
      motorFilter.type = "bandpass";
      motorFilter.frequency.setValueAtTime(420, this.ctx.currentTime);
      motorFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      this.motorWhineOsc.connect(motorFilter);
      motorFilter.connect(this.motorWhineGain);
      this.motorWhineGain.connect(this.masterGain);
      this.motorWhineOsc.start();
    } catch {}
  }

  /**
   * Synchronizes the real-life train travelling sound with the current animation speed.
   * Modulates the rhythmic "chuk-chuk... chuk-chuk" wheel cadence in real-time.
   */
  public updateSimulationSpeed(speedKmh: number) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    this.ensureContinuousNodes();

    this.currentSpeed = speedKmh;

    // Modulate continuous rumble & motor whine based on speed
    const norm = Math.min(Math.max(speedKmh / 130.0, 0), 1);
    if (this.trainRumbleGain && this.ctx) {
      const targetGain = norm > 0.05 ? 0.008 + norm * 0.022 : 0.0;
      this.trainRumbleGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
    }
    if (this.motorWhineOsc && this.motorWhineGain && this.ctx) {
      const targetFreq = 180 + norm * 360;
      const targetGain = norm > 0.08 ? 0.003 + norm * 0.008 : 0.0;
      this.motorWhineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
      this.motorWhineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
    }

    // Start or adjust the rhythmic train wheel joint cadence loop
    if (speedKmh > 10 && !this.isPlayingTrainSound) {
      this.isPlayingTrainSound = true;
      this.scheduleNextWheelChug();
    } else if (speedKmh <= 10 && this.isPlayingTrainSound) {
      this.isPlayingTrainSound = false;
      if (this.wheelClatterTimer) {
        clearTimeout(this.wheelClatterTimer);
        this.wheelClatterTimer = null;
      }
      this.playPneumaticBrakeHiss();
    }
  }

  /**
   * Plays the rhythmic 2-pulse rail joint clatter ("chuk-chuk") and schedules the next beat.
   */
  private scheduleNextWheelChug = () => {
    if (!this.isPlayingTrainSound || this.currentSpeed <= 10) return;
    this.playWheelChugPair();

    // Calculate tempo: faster train -> shorter interval between rail joints
    // 130 km/h -> ~380ms interval; 40 km/h -> ~850ms interval
    const norm = Math.min(Math.max(this.currentSpeed / 130.0, 0.1), 1.0);
    const intervalMs = Math.round(950 - norm * 570);

    this.wheelClatterTimer = setTimeout(this.scheduleNextWheelChug, intervalMs);
  };

  /**
   * Real-life physical wheel clatter pair ("ta-tum... ta-tum" over rail fishplates).
   */
  private playWheelChugPair() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const vol = Math.min(0.02 + (this.currentSpeed / 130.0) * 0.035, 0.06);

    // Axle 1: Leading wheel impact
    this.triggerAxleTransient(t, vol, 240);
    // Axle 2: Trailing wheel impact (65ms later)
    this.triggerAxleTransient(t + 0.065, vol * 0.75, 210);
  }

  private triggerAxleTransient(time: number, vol: number, freq: number) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.04);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq * 1.4, time);
    filter.Q.setValueAtTime(2.2, time);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  /**
   * Pneumatic train air brake release hiss ("psssshhh") when coming to a halt.
   */
  public playPneumaticBrakeHiss() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const bufferSize = this.ctx.sampleRate * 0.8;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.6);
    filter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.035, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.65);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.7);
  }

  /**
   * Heavy interlocking solenoid relay contact click on signal aspect transitions.
   */
  public playRelayClick() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.03);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1700, t);
    filter.Q.setValueAtTime(4.0, t);

    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.045);
  }

  /**
   * Real Locomotive Dual-Tone Warning Horn (A5 + F#5 dissonant warning).
   */
  public playWarningTone() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = "sawtooth";
    osc2.type = "sawtooth";
    osc1.frequency.setValueAtTime(880, t);  // A5
    osc2.frequency.setValueAtTime(740, t);  // F#5

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, t);

    gain.gain.setValueAtTime(0.065, t);
    gain.gain.setValueAtTime(0.065, t + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.38);
    osc2.stop(t + 0.38);
  }

  /**
   * Teleprinter dot-matrix solenoid print head chatter.
   */
  public playTeleprinterChatter() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(920 + Math.random() * 200, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.025);

    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.035);
  }

  /**
   * Four-note harmonic resolution chord shimmer (C4 - E4 - G4 - C5) on optimal dispatch approval.
   */
  public playResolveChime() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const notes = [261.63, 329.63, 392.00, 523.25];
    const baseTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = baseTime + idx * 0.075;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.055, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.7);
    });
  }
}

export const CinematicSound = new RealRailwaySoundEngine();
