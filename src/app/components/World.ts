import { InputManager } from "../utils/classes/InputManger";
import * as THREE from "three";
import { DataStore } from "../utils/classes/DataStore";
import { TimeObject } from "./unused/Time";
import { TerrainGenParams, TerrainManager } from "./TerrainManager";
import { MainScene } from "../pages/MainScene";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface WorldStore {
  objects: { [key: string]: any };
  players: { [key: string]: any };
  time: TimeObject;
  terrain: TerrainGenParams;
  diffs: Record<string, { blockId: number }>;
}

export const defaultWorldStore: WorldStore = {
  time: { time: 0, days: 0, years: 0, minutesInDay: 20, daysInYear: 365 },
  objects: {},
  players: {},
  terrain: {
    chunkSize: 32,
    maxWorldHeight: 256,
    hDrawDist: 20, 
    vDrawDist: 1,
    seed: "def",
    fractalNoise: {
      amplitude: 0.9,
      frequency: 0.002,
      octaves: 4,
      lacunarity: 2.0,
      persistence: 0.5,
      offset: 0.1,
    },
    trees: {
      trunk: {
        diameter: 1,
        minHeight: 5,
        maxHeight: 10,
      },
      canopy: {
        minRadius: 3,
        maxRadius: 5,
      },
      buffer: 3,
      density: 0.008,
    },
  },
  diffs: {},
};

export class World extends THREE.Group {
  scene: MainScene;
  inputManager: InputManager;
  params: WorldStore;

  terrain: TerrainManager;
  orbitCamera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  activeCamera: THREE.Camera;

  sun: THREE.DirectionalLight = new THREE.DirectionalLight();
  ambientLight: THREE.AmbientLight = new THREE.AmbientLight();

  accumulator: number = 0;
  simulationRate: number = 480;
  timeStep: number = 1 / this.simulationRate;

  worldStore: DataStore<WorldStore> = new DataStore(defaultWorldStore);

  pos: THREE.Vector3;

  constructor(scene: MainScene, params: WorldStore = defaultWorldStore) {
    super();

    this.scene = scene;
    this.scene.background = new THREE.Color("rgb(154, 218, 255)");


    this.inputManager = scene.inputManager;
    this.accumulator = 0;

    this.params = params;
    this.worldStore = new DataStore(params);

    this.terrain = new TerrainManager(this);
    this.add(this.terrain);

    this.orbitCamera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      this.params.terrain.chunkSize * this.params.terrain.hDrawDist + 5000
    );
    this.orbitCamera.updateProjectionMatrix();
    this.orbitCamera.updateMatrixWorld();
    const center = this.params.terrain.chunkSize / 2;
    this.orbitCamera.position.set(
      center,
      this.params.terrain.vDrawDist * this.params.terrain.chunkSize,
      center
    );

    this.controls = new OrbitControls(
      this.orbitCamera,
      this.scene.renderer.domElement
    );

    this.activeCamera = this.orbitCamera;
    this.add(this.activeCamera);

    // this.sun.lookAt(0, 0, 0);
    // this.add(this.sun);
    // this.add(this.ambientLight);

    this.pos = new THREE.Vector3(0, 0, 0);

    const axesHelper = new THREE.AxesHelper(
      this.params.terrain.chunkSize
    );
    this.add(axesHelper);

    // const helper = new THREE.CameraHelper(this.activeCamera);
    // this.add(helper);
  }

  update(dt: number) {
    this.accumulator += dt;
    this.terrain.update(this.pos);
  }

  getVoxel(x: number, y: number, z: number) {
    return this.terrain.getVoxel(x, y, z);
  }

  addVoxel(x: number, y: number, z: number, blockId: number) {
    return this.terrain.addVoxel(x, y, z, blockId);
  }

  removeVoxel(x: number, y: number, z: number) {
    return this.terrain.removeVoxel(x, y, z);
  }
}
