/**
 * AudioSpatializer — 3D & Stereo Spatial Positioning for Railway Sound Sources.
 * 
 * Provides camera-relative distance attenuation, stereo panning, and occlusion filtering.
 */

export interface SpatialNodeChain {
  inputGain: GainNode;
  panner: StereoPannerNode | PannerNode;
  occlusionFilter: BiquadFilterNode;
  outputNode: AudioNode;
}

export class AudioSpatializer {
  private ctx: AudioContext;
  private cameraPosition = { x: 0, y: 0, z: 0 };

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  public updateCamera(x: number, y: number, z = 0) {
    this.cameraPosition = { x, y, z };
  }

  /**
   * Creates a spatialized audio processing chain connected to a destination bus.
   */
  public createSpatialChain(destination: AudioNode): SpatialNodeChain {
    const inputGain = this.ctx.createGain();
    const occlusionFilter = this.ctx.createBiquadFilter();
    occlusionFilter.type = "lowpass";
    occlusionFilter.frequency.setValueAtTime(20000, this.ctx.currentTime); // Open by default

    let panner: StereoPannerNode;
    if (typeof this.ctx.createStereoPanner === "function") {
      panner = this.ctx.createStereoPanner();
    } else {
      // Fallback
      panner = this.ctx.createStereoPanner();
    }

    inputGain.connect(occlusionFilter);
    occlusionFilter.connect(panner);
    panner.connect(destination);

    return {
      inputGain,
      panner,
      occlusionFilter,
      outputNode: panner,
    };
  }

  /**
   * Updates distance attenuation, pan, and occlusion based on source coordinates.
   */
  public updateSpatialSource(
    chain: SpatialNodeChain,
    sourceX: number,
    sourceY: number,
    isOccluded = false,
    maxDistanceKm = 80.0
  ) {
    const dx = sourceX - this.cameraPosition.x;
    const dy = sourceY - this.cameraPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Distance attenuation (inverse distance curve with gentle rolloff)
    const normalizedDist = distance / maxDistanceKm;
    const gain = Math.max(0.0, Math.min(1.0, 1.0 / (1.0 + normalizedDist * 3.5)));

    chain.inputGain.gain.setValueAtTime(gain, this.ctx.currentTime);

    // Stereo pan (-1.0 left, +1.0 right based on X offset)
    const pan = Math.max(-1.0, Math.min(1.0, dx / 30.0));
    if ("pan" in chain.panner) {
      chain.panner.pan.setValueAtTime(pan, this.ctx.currentTime);
    }

    // Low-pass occlusion filter when buildings or terrain obscure line-of-sight
    const cutoffFreq = isOccluded ? 1200 : 20000;
    chain.occlusionFilter.frequency.setTargetAtTime(cutoffFreq, this.ctx.currentTime, 0.1);
  }
}
