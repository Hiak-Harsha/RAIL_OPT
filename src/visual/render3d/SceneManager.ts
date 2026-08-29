/**
 * RAILOPT-X — 3D Scene, Camera & WebGL Renderer Lifecycle Manager
 */

import * as THREE from "three";

export interface SceneManagerInitResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  dispose: () => void;
}

export class SceneManager {
  public static isWebGLAvailable(): boolean {
    try {
      const canvas = document.createElement("canvas");
      return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
    } catch {
      return false;
    }
  }

  public static initialize(container: HTMLDivElement): SceneManagerInitResult | null {
    if (!this.isWebGLAvailable()) return null;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;

    // 1. Scene & Atmospheric Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04080D);
    scene.fog = new THREE.FogExp2(0x04080D, 0.008);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 16, 28);
    camera.lookAt(0, 2, 0);

    // 3. WebGL Renderer with Shadows
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 4. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xC8D8E8, 0.75);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00E5FF, 1.2);
    dirLight.position.set(40, 50, 25);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xFF8C1A, 0.45);
    fillLight.position.set(-40, 20, -25);
    scene.add(fillLight);

    // 5. Window Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    const dispose = () => {
      window.removeEventListener("resize", handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };

    return { scene, camera, renderer, dispose };
  }
}
