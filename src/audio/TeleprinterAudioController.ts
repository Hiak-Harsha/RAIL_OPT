/**
 * TeleprinterAudioController — Mechanical Keystroke & Teleprinter Sound Scheduler.
 * 
 * Synchronizes mechanical typewriter/teleprinter audio cadence with live text streams.
 */

export class TeleprinterAudioController {
  private ctx: AudioContext;
  private outputNode: AudioNode;

  constructor(ctx: AudioContext, outputNode: AudioNode) {
    this.ctx = ctx;
    this.outputNode = outputNode;
  }

  /**
   * Plays a burst of mechanical key strikes corresponding to the provided text string.
   */
  public playMessageCadence(text: string, onComplete?: () => void) {
    if (!text || text.trim().length === 0) return;

    const chars = text.slice(0, 35).split("");
    let accumulatedDelay = 0;

    chars.forEach((char, index) => {
      // Micro timing variation (25ms to 65ms per strike, longer pause on spaces and punctuation)
      const baseDelay = char === " " ? 85 : 38;
      const jitter = (Math.random() - 0.5) * 16;
      const charDelay = Math.max(20, baseDelay + jitter);
      accumulatedDelay += charDelay;

      setTimeout(() => {
        this.playSingleKeyStrike(char === "." || char === ":");
        if (index === chars.length - 1 && onComplete) {
          onComplete();
        }
      }, accumulatedDelay);
    });
  }

  /**
   * Generates an authentic mechanical relay/key strike transient.
   */
  public playSingleKeyStrike(isPunctuation = false) {
    const t = this.ctx.currentTime;

    // Transient click oscillator
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    const freq = isPunctuation ? 720 : 540 + (Math.random() - 0.5) * 80;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.025);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    // Filter to simulate mechanical metal chassis resonance
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.setValueAtTime(3.0, t);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.outputNode);

    osc.start(t);
    osc.stop(t + 0.035);
  }

  /**
   * Heavy mechanical carriage return & route latch sound when an optimization plan is selected.
   */
  public playPlanCommitLatch() {
    const t = this.ctx.currentTime;

    // Two-stage mechanical lock: primary latch (0s) + heavy electromagnetic relay (0.06s)
    [0, 0.06].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(idx === 0 ? 380 : 180, t + offset);
      osc.frequency.exponentialRampToValueAtTime(60, t + offset + 0.05);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(idx === 0 ? 0.25 : 0.4, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.08);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1200, t + offset);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.outputNode);

      osc.start(t + offset);
      osc.stop(t + offset + 0.09);
    });
  }
}
