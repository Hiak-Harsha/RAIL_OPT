/**
 * AudioEventMapper — Event-Driven Railway Acoustic Dispatcher for RAILOPT-X 2.0.
 * 
 * Maps live operational events directly to physical railway sound cues:
 *  - No arcade video-game notification chimes
 *  - Authentic physical relay clicks, pneumatic air exhausts, and mechanical latches
 */
import type { SignalAspect } from "../types/railway";

export class AudioEventMapper {
  private ctx: AudioContext;
  private infraBus: AudioNode;
  private alertsBus: AudioNode;

  constructor(ctx: AudioContext, infraBus: AudioNode, alertsBus: AudioNode) {
    this.ctx = ctx;
    this.infraBus = infraBus;
    this.alertsBus = alertsBus;
  }

  /**
   * Signal aspect relay click transition.
   */
  public playSignalRelay(aspect: SignalAspect) {
    const t = this.ctx.currentTime;

    // Green / Yellow: Standard electrical interlocking relay click
    // Red: Heavy electromagnetic trip latch
    const isRed = aspect === "RED";
    const osc = this.ctx.createOscillator();
    osc.type = isRed ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(isRed ? 420 : 340, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.035);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isRed ? 0.35 : 0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(isRed ? 1400 : 2200, t);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.infraBus);

    osc.start(t);
    osc.stop(t + 0.045);
  }

  /**
   * Conflict prediction acoustic cue — restrained low-frequency cautionary drone.
   */
  public playConflictAlert() {
    const t = this.ctx.currentTime;

    // Dual-tone cautionary pulse (620Hz + 520Hz)
    [620, 520].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.alertsBus);

      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  /**
   * Route lock mechanical point throw.
   */
  public playRouteLock() {
    const t = this.ctx.currentTime;

    // Multi-stage metallic point lock sound
    [0, 0.035, 0.08].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(idx === 2 ? 180 : 420 - idx * 60, t + offset);
      osc.frequency.exponentialRampToValueAtTime(50, t + offset + 0.03);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(idx === 2 ? 0.3 : 0.18, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.04);

      osc.connect(gain);
      gain.connect(this.infraBus);

      osc.start(t + offset);
      osc.stop(t + offset + 0.05);
    });
  }
}
