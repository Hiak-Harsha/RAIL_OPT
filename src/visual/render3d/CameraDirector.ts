/**
 * RAILOPT-X — 3D Dynamic Camera Director & Focus Manager
 */

import * as THREE from "three";
import type { Train, PredictedConflict } from "../../types/railway";
import { ConflictGeometry } from "../topology/ConflictGeometry";
import { CorridorGraph, type CorridorTopologyModel } from "../topology/CorridorGraph";
import type { TrainRenderer } from "./TrainRenderer";

export type Camera3DMode = 
  | "OPERATIONAL_OVERVIEW" 
  | "FOLLOW_TRAIN" 
  | "CAB_POV" 
  | "CORRIDOR_FLYTHROUGH" 
  | "CONFLICT_FOCUS" 
  | "STATION_INSPECTION" 
  | "FUTURE_WORLDS" 
  | "ORBIT";

export class CameraDirector {
  private cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 1.8, 0);
  private orbitAngles = { yaw: 0, pitch: 0.38, distance: 42 };
  private isDragging = false;
  private prevMouse = { x: 0, y: 0 };

  public attachControls(container: HTMLDivElement) {
    const onMouseDown = (e: MouseEvent) => {
      this.isDragging = true;
      this.prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevMouse.x;
      const dy = e.clientY - this.prevMouse.y;
      this.prevMouse = { x: e.clientX, y: e.clientY };

      this.orbitAngles.yaw -= dx * 0.005;
      this.orbitAngles.pitch = Math.max(0.1, Math.min(Math.PI / 2.2, this.orbitAngles.pitch + dy * 0.005));
    };

    const onMouseUp = () => {
      this.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.orbitAngles.distance = Math.max(8, Math.min(140, this.orbitAngles.distance + e.deltaY * 0.04));
    };

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("wheel", onWheel);
    };
  }

  public updateCamera(
    camera: THREE.PerspectiveCamera,
    mode: Camera3DMode,
    nowSec: number,
    trainRenderer: TrainRenderer,
    trains: Train[],
    focusedTrainId?: string | null,
    predictedConflicts: PredictedConflict[] = [],
    focusedConflictId?: string | null,
    topology?: CorridorTopologyModel,
    viewportStartKm: number = 0,
    viewportEndKm: number = 435
  ) {
    const activeTrain = trains.find((t) => t.train_id === focusedTrainId) || trains[0];
    const followTarget = activeTrain ? trainRenderer.getTargetPosition(activeTrain.train_id) : null;

    if (mode === "OPERATIONAL_OVERVIEW") {
      const midX = 0;
      const spanKm = Math.max(1, viewportEndKm - viewportStartKm);
      const camDist = spanKm > 100 ? 52 : 36;
      const desiredTarget = new THREE.Vector3(midX, 1.2, 0);
      const desiredCamPos = new THREE.Vector3(midX, camDist * 0.75, camDist);

      this.cameraTarget.lerp(desiredTarget, 0.08);
      camera.position.lerp(desiredCamPos, 0.08);
      camera.lookAt(this.cameraTarget);
    } else if (mode === "FOLLOW_TRAIN" && followTarget) {
      const tPos = followTarget.pos;
      const speedKmh = followTarget.speed;
      const isDown = followTarget.direction === "DOWN";
      const dirMult = isDown ? -1 : 1;

      // Speed vibration
      const vibration = (Math.sin(nowSec * 25) * 0.02) * (speedKmh / 130);

      const desiredTarget = new THREE.Vector3(tPos.x + (6 * dirMult), 1.8, tPos.z);
      const desiredCamPos = new THREE.Vector3(
        tPos.x - (16 * dirMult),
        6.5 + vibration,
        tPos.z + 10.5
      );

      this.cameraTarget.lerp(desiredTarget, 0.09);
      camera.position.lerp(desiredCamPos, 0.08);
      camera.lookAt(this.cameraTarget);
    } else if (mode === "CAB_POV" && followTarget) {
      const tPos = followTarget.pos;
      const isDown = followTarget.direction === "DOWN";
      const dirMult = isDown ? -1 : 1;

      const cabCamPos = new THREE.Vector3(tPos.x + (3.2 * dirMult), 3.3, tPos.z);
      const cabLookTarget = new THREE.Vector3(tPos.x + (40 * dirMult), 3.0, tPos.z);

      this.cameraTarget.lerp(cabLookTarget, 0.12);
      camera.position.lerp(cabCamPos, 0.12);
      camera.lookAt(this.cameraTarget);
    } else if (mode === "CORRIDOR_FLYTHROUGH") {
      const flyX = Math.sin(nowSec * 0.3) * 45;
      const flyCamPos = new THREE.Vector3(flyX, 18, 32);
      this.cameraTarget.lerp(new THREE.Vector3(flyX, 1.5, 0), 0.06);
      camera.position.lerp(flyCamPos, 0.06);
      camera.lookAt(this.cameraTarget);
    } else if (mode === "CONFLICT_FOCUS" && topology) {
      const focusedConf = predictedConflicts.find((c) => c.conflict_id === focusedConflictId) || predictedConflicts[0];
      if (focusedConf) {
        const footprint = ConflictGeometry.extractFootprint(
          focusedConf,
          topology,
          trains,
          viewportStartKm,
          viewportEndKm
        );
        this.cameraTarget.lerp(new THREE.Vector3(footprint.centroid3D.x, 1.6, footprint.centroid3D.z), 0.1);
        camera.position.lerp(new THREE.Vector3(footprint.centroid3D.x, 15, footprint.centroid3D.z + 22), 0.08);
        camera.lookAt(this.cameraTarget);
      }
    } else if (mode === "FUTURE_WORLDS" && topology) {
      // Cinematic slow sweep over resolution junction
      const sweepX = Math.sin(nowSec * 0.5) * 15;
      const targetPos = new THREE.Vector3(sweepX, 1.5, 0);
      const camPos = new THREE.Vector3(sweepX - 12, 9, 16);
      this.cameraTarget.lerp(targetPos, 0.08);
      camera.position.lerp(camPos, 0.08);
      camera.lookAt(this.cameraTarget);
    } else if (mode === "STATION_INSPECTION" && topology && topology.stations.length > 0) {
      const stn = topology.stations[0];
      const stnX = (stn.position_km - (viewportStartKm + viewportEndKm) / 2) * CorridorGraph.getScaleFactor3D(viewportStartKm, viewportEndKm);
      this.cameraTarget.lerp(new THREE.Vector3(stnX, 1.2, 0), 0.1);
      camera.position.lerp(new THREE.Vector3(stnX - 10, 8, 15), 0.08);
      camera.lookAt(this.cameraTarget);
    } else {
      // Free Orbit Mode
      const cx = this.cameraTarget.x + this.orbitAngles.distance * Math.sin(this.orbitAngles.yaw) * Math.cos(this.orbitAngles.pitch);
      const cy = this.cameraTarget.y + this.orbitAngles.distance * Math.sin(this.orbitAngles.pitch);
      const cz = this.cameraTarget.z + this.orbitAngles.distance * Math.cos(this.orbitAngles.yaw) * Math.cos(this.orbitAngles.pitch);

      camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.1);
      camera.lookAt(this.cameraTarget);
    }
  }

  public frameTarget(x: number, y: number, z: number) {
    this.cameraTarget.set(x, y, z);
  }
}
