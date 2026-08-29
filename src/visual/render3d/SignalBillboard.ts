/**
 * RAILOPT-X — 3D Signal Aspect Billboard & Multi-Aspect Post System
 * 
 * DIRECTLY DRIVEN BY ENTITYVISUALSTATE:
 * -------------------------------------
 * Renders 3D signal masts with LED aspect lenses whose colors and stop states
 * are strictly determined by EntityVisualState.getSignalVisualState().
 */

import * as THREE from "three";
import type { Signal } from "../../types/railway";
import type { CorridorTopologyModel, CorridorSegment } from "../topology/CorridorGraph";
import { EntityVisualState } from "../state/EntityVisualState";

export class SignalBillboard {
  private signalGroups: Map<string, THREE.Group> = new Map();
  private aspectLamps: Map<string, THREE.Mesh> = new Map();
  private aspectGlowLights: Map<string, THREE.PointLight> = new Map();

  public buildSignalMasts(topology: CorridorTopologyModel, signals: Signal[] = []): THREE.Group {
    const root = new THREE.Group();
    root.name = "Signals3D";

    this.signalGroups.clear();
    this.aspectLamps.clear();
    this.aspectGlowLights.clear();

    const postMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.7 });
    const targetShieldMat = new THREE.MeshBasicMaterial({ color: 0x050B11 });

    const signalByBlock = new Map<string, Signal>();
    signals.forEach((s) => {
      signalByBlock.set(s.block_id, s);
      signalByBlock.set(s.id, s);
    });

    topology.segments.forEach((seg) => {
      const liveSig = signalByBlock.get(seg.blockId);
      const visualState = EntityVisualState.getSignalVisualState(liveSig, seg.signalAspect);

      // Place signal at segment entry
      const sigGroup = new THREE.Group();
      sigGroup.name = `Sig_${seg.blockId}`;

      // 1. Steel Mast Post
      const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.2, 8);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(0, 2.1, 0);
      sigGroup.add(post);

      // 2. Black Target Shield
      const shieldGeo = new THREE.BoxGeometry(0.38, 1.3, 0.22);
      const shield = new THREE.Mesh(shieldGeo, targetShieldMat);
      shield.position.set(0, 3.8, 0);
      sigGroup.add(shield);

      // 3. Aspect Lamp LED Lens
      const aspectGeo = new THREE.SphereGeometry(0.14, 16, 16);
      const aspectMat = new THREE.MeshBasicMaterial({ color: visualState.aspectHex });
      const aspect = new THREE.Mesh(aspectGeo, aspectMat);
      aspect.position.set(0, 3.8, 0.14);
      sigGroup.add(aspect);

      // 4. Glow Point Light
      const glow = new THREE.PointLight(visualState.aspectHex, visualState.isStopAspect ? 1.5 : 0.8, 8);
      glow.position.set(0, 3.8, 0.4);
      sigGroup.add(glow);

      const mastOffsetZ = seg.z1_3d + (seg.direction === "DOWN" ? -2.2 : 2.2);
      sigGroup.position.set(seg.x1_3d, 0, mastOffsetZ);

      root.add(sigGroup);
      this.signalGroups.set(seg.blockId, sigGroup);
      this.aspectLamps.set(seg.blockId, aspect);
      this.aspectGlowLights.set(seg.blockId, glow);
    });

    return root;
  }

  public updateAspects(segments: CorridorSegment[], signals: Signal[] = []) {
    const signalByBlock = new Map<string, Signal>();
    signals.forEach((s) => {
      signalByBlock.set(s.block_id, s);
      signalByBlock.set(s.id, s);
    });

    segments.forEach((seg) => {
      const lamp = this.aspectLamps.get(seg.blockId);
      const glow = this.aspectGlowLights.get(seg.blockId);
      const liveSig = signalByBlock.get(seg.blockId);
      const visualState = EntityVisualState.getSignalVisualState(liveSig, seg.signalAspect);

      if (lamp) {
        (lamp.material as THREE.MeshBasicMaterial).color.setHex(visualState.aspectHex);
      }
      if (glow) {
        glow.color.setHex(visualState.aspectHex);
        glow.intensity = visualState.isStopAspect ? 1.8 : 0.8;
      }
    });
  }
}
