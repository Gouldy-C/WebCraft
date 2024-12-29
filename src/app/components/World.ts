import { InputManager } from "./../utils/InputManger";
import * as THREE from "three";
import { Player } from "./unused/Player";
import { DataStore } from "../utils/DataStore";
import { Time, TimeObject } from "./unused/Time";
import { Terrain, TerrainGenParams } from "./unused/Terrain";
import { MainScene } from "../pages/MainScene";
// import { Lighting } from "./Lighting";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TerrainManager } from "./TerrainManager";

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
    drawDistance: 6,
    chunkSize: { width: 64, height: 256 },
    seed: "default",
    fractalNoise: {
      maxHeight: 0.3,
      frequency: 0.002,
      octaves: 4,
      lacunarity: 2.0,
      persistence: 0.5,
      offset: 0.4,
    },
    trees: {
      trunk: {
        diameter: 1,
        minHeight: 4,
        maxHeight: 8,
      },
      canopy: {
        minRadius: 3,
        maxRadius: 5,
      },
      density: 0.008,
    },
  },
  diffs: {},
};

export class World extends THREE.Group {
  scene: MainScene;
  inputManager: InputManager;
  params: WorldStore;

  // lighting: Lighting;
  terrain: TerrainManager;
  // player: Player;
  orbitCamera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  activeCamera: THREE.Camera;

  // time
  // fullDayTime = 500;
  // time: Time = new Time({
  //   time: 0,
  //   days: 0,
  //   years: 0,
  //   minutesInDay: this.fullDayTime / 60,
  //   daysInYear: 365,
  // });

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
    this.inputManager = scene.inputManager;
    this.accumulator = 0;

    this.params = params;
    this.worldStore = new DataStore(params);

    this.terrain = new TerrainManager(this);
    this.add(this.terrain);

    // this.player = new Player(this);
    // this.add(this.player);

    // this.lighting = new Lighting(this);
    // this.add(this.lighting);

    this.orbitCamera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      this.params.terrain.chunkSize.width * this.params.terrain.drawDistance +
        5000
    );
    this.orbitCamera.position.set(
      this.params.terrain.chunkSize.width / 2,
      this.params.terrain.chunkSize.height / 2,
      this.params.terrain.chunkSize.width / 2
    );

    this.controls = new OrbitControls(
      this.orbitCamera,
      this.scene.renderer.domElement
    );

    this.activeCamera = this.orbitCamera;
    this.add(this.activeCamera);

    this.scene.renderer.setClearColor(0xc4e2ff, 1);
    this.sun.lookAt(0, 0, 0);
    this.add(this.sun);
    this.add(this.ambientLight);

    this.pos = new THREE.Vector3(0, 0, 1);
  }

  update(dt: number) {
    this.accumulator += dt;
    // if (dt) {
    //   this.time.update(dt);
    // }

    // if (this.inputManager.getCurrentlyPressedActions().length > 0) {
    //   this.player.controls.lock();
    // }

    // this.activeCamera = this.player.controls.isLocked
    //   ? this.player.camera
    //   : this.orbitCamera;

    // while (this.accumulator >= this.timeStep) {
    //   if (this.player.controls.isLocked) {
    //     this.player.update(this.timeStep);
    //   }
    //   this.accumulator -= this.timeStep;
    // }
    // this.pos = this.pos.add(new THREE.Vector3(0.25, 0, 0.25));
    this.terrain.update(this.pos);
    // this.lighting.update(this.player.position);

    this.controls.update();
  }

  getVoxel(x: number, y: number, z: number) {
    return this.terrain.getVoxel(x, y, z);
  }

  // hideVoxel(x: number, y: number, z: number) {
  //   return this.terrain.hideVoxel(x, y, z);
  // }

  addVoxel(x: number, y: number, z: number, blockId: number) {
    return this.terrain.addVoxel(x, y, z, blockId);
  }

  removeVoxel(x: number, y: number, z: number) {
    return this.terrain.removeVoxel(x, y, z);
  }

  // revealBlock(x: number, y: number, z: number) {
  //   return this.terrain.revealVoxel(x, y, z);
  // }
}
