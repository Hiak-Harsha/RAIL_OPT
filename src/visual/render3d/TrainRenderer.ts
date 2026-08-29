/**
 * RAILOPT-X — 3D Rolling Stock Consist & Physics Renderer
 * 
 * DIRECTLY DRIVEN BY ENTITYVISUALSTATE:
 * -------------------------------------
 * Renders realistic train posture and visual cues based on real operational status:
 * - BRAKING: Rear red tail brake lights illuminate and lerp dampens smoothly.
 * - DWELLING: Doors-open visual indicators slide out along platform side.
 * - WAITING_FOR_ROUTE / WAITING_FOR_HEADWAY / DISRUPTED: Pulsing amber/red roof beacon.
 * - ACCELERATING / CRUISING: High-intensity forward headlight beam.
 */

import * as THREE from "three";
import type { Train, PredictedConflict } from "../../types/railway";
import { Train3DModelBuilder } from "../Train3DModel";
import { CorridorGraph, type CorridorTopologyModel } from "../topology/CorridorGraph";
import { EntityVisualState, type TrainVisualState } from "../state/EntityVisualState";

export class TrainRenderer {
  private trainMeshes: Map<string, THREE.Group> = new Map();
  private headlightSpots: Map<string, THREE.SpotLight> = new Map();
  private brakeLights: Map<string, { mesh: THREE.Mesh; light: THREE.PointLight }> = new Map();
  private roofBeacons: Map<string, { mesh: THREE.Mesh; light: THREE.PointLight }> = new Map();
  private doorPanels: Map<string, THREE.Group> = new Map();
  private conflictRings: Map<string, THREE.Mesh> = new Map();
  private targetPositions: Map<string, {
    pos: THREE.Vector3;
    rotY: number;
    speed: number;
    direction: string;
    visualState: TrainVisualState;
  }> = new Map();

  public syncTrains(
    scene: THREE.Scene,
    trains: Train[],
    topology: CorridorTopologyModel,
    predictedConflicts: PredictedConflict[],
    viewportStartKm: number,
    viewportEndKm: number
  ) {
    const activeIds = new Set(trains.map((t) => t.train_id));

    // 1. Remove deleted trains
    for (const [id, mesh] of this.trainMeshes.entries()) {
      if (!activeIds.has(id)) {
        scene.remove(mesh);
        this.trainMeshes.delete(id);
        this.headlightSpots.delete(id);
        this.brakeLights.delete(id);
        this.roofBeacons.delete(id);
        this.doorPanels.delete(id);
        this.conflictRings.delete(id);
        this.targetPositions.delete(id);
      }
    }

    const trainConflictMap = new Map<string, PredictedConflict>();
    predictedConflicts.forEach((c) => {
      (c.involved_train_ids || []).forEach((tId) => trainConflictMap.set(tId, c));
    });

    // 2. Update / create consists
    trains.forEach((train) => {
      const visualState = EntityVisualState.getTrainVisualState(train);
      const isDown = train.direction === "DOWN";
      const dirMult = isDown ? -1 : 1;

      let rakeGroup = this.trainMeshes.get(train.train_id);
      if (!rakeGroup) {
        rakeGroup = Train3DModelBuilder.buildTrainConsist(train);

        // A. Forward Headlight Spotlight
        const spotLight = new THREE.SpotLight(0xFFFBEB, 4.0, 45, Math.PI / 5, 0.6, 1.2);
        spotLight.position.set(4.0 * dirMult, 2.5, 0);
        spotLight.target.position.set(28.0 * dirMult, 0, 0);
        rakeGroup.add(spotLight);
        rakeGroup.add(spotLight.target);
        this.headlightSpots.set(train.train_id, spotLight);

        // B. Rear Red Tail Brake Light
        const brakeGeo = new THREE.SphereGeometry(0.16, 12, 12);
        const brakeMat = new THREE.MeshBasicMaterial({ color: 0xFF1744 });
        const brakeMesh = new THREE.Mesh(brakeGeo, brakeMat);
        brakeMesh.position.set(-4.0 * dirMult, 2.2, 0);
        const brakeLight = new THREE.PointLight(0xFF1744, 0.0, 10);
        brakeLight.position.set(-4.2 * dirMult, 2.2, 0);
        rakeGroup.add(brakeMesh);
        rakeGroup.add(brakeLight);
        this.brakeLights.set(train.train_id, { mesh: brakeMesh, light: brakeLight });

        // C. Roof Hazard Beacon (for Held / Disrupted trains)
        const beaconGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.25, 12);
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0xFF8C1A });
        const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
        beaconMesh.position.set(2.2 * dirMult, 3.4, 0);
        const beaconLight = new THREE.PointLight(0xFF8C1A, 0.0, 12);
        beaconLight.position.set(2.2 * dirMult, 3.6, 0);
        rakeGroup.add(beaconMesh);
        rakeGroup.add(beaconLight);
        this.roofBeacons.set(train.train_id, { mesh: beaconMesh, light: beaconLight });

        // D. Station Platform Doors-Open Indicator
        const doorsGroup = new THREE.Group();
        const doorGeo = new THREE.BoxGeometry(0.8, 1.6, 0.05);
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x38BDF8, emissive: 0x00E5FF, emissiveIntensity: 0.6 });
        const doorPanel1 = new THREE.Mesh(doorGeo, doorMat);
        doorPanel1.position.set(0, 1.8, 1.35);
        const doorPanel2 = new THREE.Mesh(doorGeo, doorMat);
        doorPanel2.position.set(0, 1.8, -1.35);
        doorsGroup.add(doorPanel1);
        doorsGroup.add(doorPanel2);
        doorsGroup.visible = false;
        rakeGroup.add(doorsGroup);
        this.doorPanels.set(train.train_id, doorsGroup);

        scene.add(rakeGroup);
        this.trainMeshes.set(train.train_id, rakeGroup);
      }

      // 3. Update Visual Cue Elements from EntityVisualState
      const brake = this.brakeLights.get(train.train_id);
      if (brake) {
        brake.light.intensity = visualState.brakeLightIntensity * 2.5;
        (brake.mesh.material as THREE.MeshBasicMaterial).color.setHex(
          visualState.isBraking ? 0xFF1744 : 0x550000
        );
      }

      const beacon = this.roofBeacons.get(train.train_id);
      if (beacon) {
        if (visualState.beaconHex) {
          beacon.light.color.setHex(visualState.beaconHex);
          (beacon.mesh.material as THREE.MeshBasicMaterial).color.setHex(visualState.beaconHex);
          beacon.mesh.visible = true;
        } else {
          beacon.light.intensity = 0.0;
          beacon.mesh.visible = false;
        }
      }

      const doors = this.doorPanels.get(train.train_id);
      if (doors) {
        doors.visible = visualState.doorsOpen;
      }

      // Compute 3D position from CorridorGraph
      const proj3D = CorridorGraph.projectTrain3D(train, topology, viewportStartKm, viewportEndKm);

      this.targetPositions.set(train.train_id, {
        pos: new THREE.Vector3(proj3D.x, 0, proj3D.z),
        rotY: proj3D.headingRad,
        speed: train.current_speed_kmh,
        direction: train.direction,
        visualState,
      });

      // 4. Conflict Proximity Ring
      const conf = trainConflictMap.get(train.train_id);
      let ring = this.conflictRings.get(train.train_id);

      if (conf) {
        const isActive = conf.time_to_conflict_sec <= 30 || conf.conflict_state === "ACTIVE";
        const ringColor = isActive ? 0xFF1744 : 0xFFB300;

        if (!ring) {
          const ringGeo = new THREE.RingGeometry(3.5, 4.2, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: ringColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
          });
          ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.05;
          rakeGroup.add(ring);
          this.conflictRings.set(train.train_id, ring);
        } else {
          (ring.material as THREE.MeshBasicMaterial).color.setHex(ringColor);
        }
      } else if (ring) {
        rakeGroup.remove(ring);
        this.conflictRings.delete(train.train_id);
      }
    });
  }

  public updateAnimation(nowSec: number) {
    this.trainMeshes.forEach((mesh, id) => {
      const target = this.targetPositions.get(id);
      if (target) {
        // Dynamic lerp dampening based on motion state
        const lerpFactor = target.visualState.motionState === "BRAKING" ? 0.06 : 0.12;
        mesh.position.lerp(target.pos, lerpFactor);
        mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, target.rotY, 0.12);

        // Flash roof beacon for held / disrupted trains
        const beacon = this.roofBeacons.get(id);
        if (beacon && target.visualState.beaconHex) {
          const pulse = (Math.sin(nowSec * 8) + 1.0) * 1.2;
          beacon.light.intensity = pulse;
        }
      }
    });

    this.conflictRings.forEach((ring) => {
      const scalePulse = 1.0 + Math.sin(nowSec * 5) * 0.18;
      ring.scale.set(scalePulse, scalePulse, 1);
    });
  }

  public getTargetPosition(trainId: string) {
    return this.targetPositions.get(trainId);
  }

  public raycastClick(
    camera: THREE.Camera,
    mouseNorm: { x: number; y: number },
    trains: Train[]
  ): Train | null {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseNorm.x, mouseNorm.y), camera);

    for (const [trainId, group] of this.trainMeshes.entries()) {
      const intersects = raycaster.intersectObjects(group.children, true);
      if (intersects.length > 0) {
        return trains.find((t) => t.train_id === trainId) || null;
      }
    }
    return null;
  }
}
