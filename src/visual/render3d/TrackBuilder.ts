/**
 * RAILOPT-X — 3D Track & Infrastructure Mesh Generator
 * 
 * BUILT FROM CORRIDORGRAPH TOPOLOGY & ENTITYVISUALSTATE:
 * -----------------------------------------------------
 * Iterates through dynamic CorridorTopologyModel segments and junctions to generate
 * realistic ballast beds, concrete sleepers, steel running rails, turnout junctions,
 * station platforms, and OHE catenary infrastructure.
 * 
 * PHYSICAL OCCUPANCY & INTERLOCKING ILLUMINATION:
 * - Dynamic block occupancy glow driven by EntityVisualState.getBlockVisualState().
 * - An occupied block illuminates warm amber, a blocked section glows red.
 */

import * as THREE from "three";
import type { TrackBlock, Train } from "../../types/railway";
import { CorridorGraph, type CorridorTopologyModel, type CorridorSegment, type CorridorJunction } from "../topology/CorridorGraph";
import { EntityVisualState } from "../state/EntityVisualState";

export class TrackBuilder {
  private static segmentBallastMaterials: Map<string, THREE.MeshStandardMaterial> = new Map();
  private static segmentIndicatorStrips: Map<string, THREE.Mesh> = new Map();

  /**
   * Generates a complete 3D infrastructure Group for the active railway corridor.
   */
  public static buildCorridorMesh(topology: CorridorTopologyModel, blocks: TrackBlock[] = []): THREE.Group {
    const root = new THREE.Group();
    root.name = "CorridorInfrastructure";

    this.segmentBallastMaterials.clear();
    this.segmentIndicatorStrips.clear();

    const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.95, roughness: 0.12 });
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const tactileYellowMat = new THREE.MeshBasicMaterial({ color: 0xFFB300 });
    const catenaryWireMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.8 });
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.6 });

    const blockMap = new Map<string, TrackBlock>();
    blocks.forEach((b) => blockMap.set(b.id, b));

    // 1. Build Each Track Segment
    topology.segments.forEach((seg) => {
      const block = blockMap.get(seg.blockId);
      const visualState = block ? EntityVisualState.getBlockVisualState(block) : null;

      const segGroup = this.buildSegment(seg, visualState, {
        sleeperMat,
        railMat,
        platformMat,
        tactileYellowMat,
        catenaryWireMat,
        mastMat,
      });
      root.add(segGroup);
    });

    // 2. Build Turnout Junction Branches
    topology.junctions.forEach((junc) => {
      const juncMesh = this.buildJunctionTurnout(junc, railMat, sleeperMat);
      root.add(juncMesh);
    });

    return root;
  }

  public static updateBlockOccupancies(blocks: TrackBlock[], trains: Train[] = []) {
    const blockMap = new Map<string, TrackBlock>();
    blocks.forEach((b) => blockMap.set(b.id, b));

    this.segmentBallastMaterials.forEach((ballastMat, blockId) => {
      const block = blockMap.get(blockId);
      if (block) {
        const visualState = EntityVisualState.getBlockVisualState(block, trains);
        ballastMat.emissive.setHex(visualState.emissiveHex);
        ballastMat.emissiveIntensity = visualState.emissiveIntensity;
      }
    });

    this.segmentIndicatorStrips.forEach((stripMesh, blockId) => {
      const block = blockMap.get(blockId);
      if (block) {
        const visualState = EntityVisualState.getBlockVisualState(block, trains);
        (stripMesh.material as THREE.MeshBasicMaterial).color.setHex(visualState.emissiveHex);
        stripMesh.visible = visualState.occupied || visualState.isBlocked;
      }
    });
  }

  private static buildSegment(
    seg: CorridorSegment,
    visualState: ReturnType<typeof EntityVisualState.getBlockVisualState> | null,
    materials: {
      sleeperMat: THREE.Material;
      railMat: THREE.Material;
      platformMat: THREE.Material;
      tactileYellowMat: THREE.Material;
      catenaryWireMat: THREE.Material;
      mastMat: THREE.Material;
    }
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = `Segment_${seg.id}`;

    const lengthX = Math.max(2, Math.abs(seg.x2_3d - seg.x1_3d));
    const centerX = (seg.x1_3d + seg.x2_3d) / 2;
    const centerZ = seg.z1_3d;

    // A. Ballast Trackbed with Dynamic Interlocking Emissive Glow
    const ballastMat = new THREE.MeshStandardMaterial({
      color: 0x141C24,
      roughness: 0.95,
      emissive: new THREE.Color(visualState ? visualState.emissiveHex : 0x141C24),
      emissiveIntensity: visualState ? visualState.emissiveIntensity : 0.05,
    });
    this.segmentBallastMaterials.set(seg.blockId, ballastMat);

    const ballastGeo = new THREE.BoxGeometry(lengthX, 0.45, 3.4);
    const ballast = new THREE.Mesh(ballastGeo, ballastMat);
    ballast.position.set(centerX, -0.22, centerZ);
    ballast.receiveShadow = true;
    group.add(ballast);

    // B. Glowing Block Occupancy Indicator Strip (Centerline illumination)
    const stripGeo = new THREE.BoxGeometry(lengthX, 0.04, 0.35);
    const stripMat = new THREE.MeshBasicMaterial({
      color: visualState ? visualState.emissiveHex : 0xFF8C1A,
      transparent: true,
      opacity: 0.85,
    });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(centerX, 0.23, centerZ);
    strip.visible = visualState ? visualState.occupied || visualState.isBlocked : false;
    group.add(strip);
    this.segmentIndicatorStrips.set(seg.blockId, strip);

    // C. Concrete Sleepers
    const sleeperGeo = new THREE.BoxGeometry(0.38, 0.18, 3.0);
    const numSleepers = Math.max(2, Math.floor(lengthX / 1.2));
    const startX = Math.min(seg.x1_3d, seg.x2_3d);

    for (let i = 0; i <= numSleepers; i++) {
      const sx = startX + (i / numSleepers) * lengthX;
      const sleeper = new THREE.Mesh(sleeperGeo, materials.sleeperMat);
      sleeper.position.set(sx, 0.08, centerZ);
      sleeper.receiveShadow = true;
      group.add(sleeper);
    }

    // D. Steel Running Rails (Standard Gauge 1.676m BG lateral offset ~0.8m)
    [-0.84, 0.84].forEach((zOffset) => {
      const railGeo = new THREE.BoxGeometry(lengthX, 0.2, 0.09);
      const rail = new THREE.Mesh(railGeo, materials.railMat);
      rail.position.set(centerX, 0.22, centerZ + zOffset);
      rail.castShadow = true;
      group.add(rail);
    });

    // E. Overhead Catenary System (OHE Wire & Masts)
    const wireGeo = new THREE.CylinderGeometry(0.015, 0.015, lengthX, 4);
    const wire = new THREE.Mesh(wireGeo, materials.catenaryWireMat);
    wire.rotation.z = Math.PI / 2;
    wire.position.set(centerX, 5.4, centerZ);
    group.add(wire);

    const numMasts = Math.max(1, Math.floor(lengthX / 20.0));
    for (let m = 0; m <= numMasts; m++) {
      const mx = startX + (m / Math.max(1, numMasts)) * lengthX;
      const mastOffsetZ = centerZ + (centerZ >= 0 ? 2.2 : -2.2);

      const mastGeo = new THREE.CylinderGeometry(0.09, 0.11, 5.8, 8);
      const mast = new THREE.Mesh(mastGeo, materials.mastMat);
      mast.position.set(mx, 2.9, mastOffsetZ);
      group.add(mast);

      const armGeo = new THREE.BoxGeometry(0.06, 0.06, 2.4);
      const arm = new THREE.Mesh(armGeo, materials.mastMat);
      arm.position.set(mx, 5.4, centerZ + (centerZ >= 0 ? 1.1 : -1.1));
      group.add(arm);
    }

    // F. Raised Station Platform (if segment has platform)
    if (seg.hasPlatform) {
      const platLength = Math.min(lengthX, 18.0);
      const platOffsetZ = centerZ + (centerZ >= 0 ? 3.2 : -3.2);

      const platGeo = new THREE.BoxGeometry(platLength, 0.8, 2.8);
      const platform = new THREE.Mesh(platGeo, materials.platformMat);
      platform.position.set(centerX, 0.4, platOffsetZ);
      platform.receiveShadow = true;
      group.add(platform);

      // Tactile warning strip along platform coping
      const tileGeo = new THREE.BoxGeometry(platLength, 0.05, 0.25);
      const tile = new THREE.Mesh(tileGeo, materials.tactileYellowMat);
      tile.position.set(centerX, 0.82, platOffsetZ + (centerZ >= 0 ? -1.25 : 1.25));
      group.add(tile);
    }

    return group;
  }

  private static buildJunctionTurnout(
    junc: CorridorJunction,
    railMat: THREE.Material,
    sleeperMat: THREE.Material
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = `Junction_${junc.id}`;

    const branchLength = 8.0;
    const isDown = junc.divergenceAngleDeg < 0;
    const targetZ = isDown ? CorridorGraph.Z_DOWN_LOOP : CorridorGraph.Z_UP_LOOP;
    const sourceZ = isDown ? CorridorGraph.Z_DOWN_MAIN : CorridorGraph.Z_UP_MAIN;

    const splinePoints = CorridorGraph.getTurnoutSplinePoints(
      junc.x_3d - branchLength / 2, sourceZ,
      junc.x_3d + branchLength / 2, targetZ,
      12
    );

    // 1. Curved Rails along spline
    [-0.45, 0.45].forEach((railOffset) => {
      for (let i = 0; i < splinePoints.length - 1; i++) {
        const p1 = splinePoints[i];
        const p2 = splinePoints[i + 1];
        const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        const midX = (p1.x + p2.x) / 2;
        const midZ = (p1.z + p2.z) / 2 + railOffset;
        const angle = Math.atan2(p2.z - p1.z, p2.x - p1.x);

        const railSegment = new THREE.Mesh(
          new THREE.BoxGeometry(segLen, 0.16, 0.08),
          railMat
        );
        railSegment.rotation.y = -angle;
        railSegment.position.set(midX, 0.22, midZ);
        group.add(railSegment);
      }
    });

    // 2. Extended Switch Sleepers across Turnout Lead
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const sx = junc.x_3d - branchLength / 2 + t * branchLength;
      const sz = sourceZ + (targetZ - sourceZ) * (t * t * (3 - 2 * t));
      const sleeperWidth = 2.4 + t * 2.8;

      const sleeper = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.15, sleeperWidth),
        sleeperMat
      );
      sleeper.position.set(sx, 0.08, (sourceZ + sz) / 2);
      group.add(sleeper);
    }

    return group;
  }
}
