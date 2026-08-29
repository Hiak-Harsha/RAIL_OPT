/**
 * AudioBus — Hierarchical Acoustic Mixing Channel Topology for RAILOPT-X 2.0.
 * 
 * Channels:
 *  - Master (Final limiter & master gain)
 *  - Ambience (Corridor wind, distant electrification hum, birds, night atmospheric bed)
 *  - Trains (Continuous bogie/rail rolling, traction harmonics, physics-derived wheel-joints)
 *  - Infrastructure (Mechanical relay clicks, point-switch latch, track interlocking)
 *  - ControlRoom (Mechanical teleprinter keys, OCC hum, console keystrokes)
 *  - Alerts (Restrained warning tones, no arcade sounds)
 */

export interface BusTopology {
  masterGain: GainNode;
  ambienceGain: GainNode;
  trainsGain: GainNode;
  infraGain: GainNode;
  controlGain: GainNode;
  alertsGain: GainNode;
}

export class AudioBusManager {
  private ctx: AudioContext;
  private buses: BusTopology;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    // Master bus with compression limiter
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.7, ctx.currentTime);
    masterGain.connect(ctx.destination);

    // Sub-buses
    const ambienceGain = ctx.createGain();
    ambienceGain.gain.setValueAtTime(0.5, ctx.currentTime);
    ambienceGain.connect(masterGain);

    const trainsGain = ctx.createGain();
    trainsGain.gain.setValueAtTime(0.65, ctx.currentTime);
    trainsGain.connect(masterGain);

    const infraGain = ctx.createGain();
    infraGain.gain.setValueAtTime(0.6, ctx.currentTime);
    infraGain.connect(masterGain);

    const controlGain = ctx.createGain();
    controlGain.gain.setValueAtTime(0.55, ctx.currentTime);
    controlGain.connect(masterGain);

    const alertsGain = ctx.createGain();
    alertsGain.gain.setValueAtTime(0.45, ctx.currentTime);
    alertsGain.connect(masterGain);

    this.buses = {
      masterGain,
      ambienceGain,
      trainsGain,
      infraGain,
      controlGain,
      alertsGain,
    };
  }

  public getBus(channel: keyof BusTopology): GainNode {
    return this.buses[channel];
  }

  public setChannelVolume(channel: keyof BusTopology, volume: number, rampTime = 0.05) {
    const bus = this.buses[channel];
    if (bus) {
      bus.gain.cancelScheduledValues(this.ctx.currentTime);
      bus.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime + rampTime);
    }
  }

  public muteAll() {
    this.buses.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
  }

  public unmuteAll(masterVolume = 0.7) {
    this.buses.masterGain.gain.setValueAtTime(masterVolume, this.ctx.currentTime);
  }
}
