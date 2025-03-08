import * as THREE from "three";
import  * as RAPIER from '@dimforge/rapier3d';
import { InputAction, InputManager } from "../utils/classes/InputManger";
import { DataStore } from "../utils/classes/DataStore";
import { TerrainManager } from "./TerrainManager";
import { MainScene } from "../pages/MainScene";
import { defaultWorldStore, WorldStore } from "../utils/states/WorldState";
import { Physics } from "./Physics";


export class World extends THREE.Group {
  scene: MainScene;
  inputManager: InputManager;
  params: WorldStore;

  // player: Player;
  // physics: Physics;

  terrain: TerrainManager;
  orbitCamera: THREE.PerspectiveCamera;
  activeCamera: THREE.Camera;
  cameraGroup: THREE.Group;

  sun: THREE.DirectionalLight = new THREE.DirectionalLight();
  ambientLight: THREE.AmbientLight = new THREE.AmbientLight();

  accumulator: number = 0;
  simulationRate: number = 120;
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
    
    // this.physics = new Physics({gravity: {x:0, y: -9.81, z: 0} });

    this.terrain = new TerrainManager(this);
    this.add(this.terrain);

    this.orbitCamera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      this.params.terrain.chunkSize * this.params.terrain.hDrawDist + 5000
    );

    this.activeCamera = this.orbitCamera;
    this.cameraGroup = new THREE.Group();
    this.cameraGroup.position.set(0, params.terrain.maxWorldHeight, 0);
    this.cameraGroup.add(this.activeCamera);
    this.add(this.cameraGroup);

    // Calculate the bounding box of the cameraGroup
    const box = new THREE.Box3().setFromObject(this.cameraGroup);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Create a wireframe box geometry
    const boxGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const boxMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00, // Green wireframe
      wireframe: true,
    });
    const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
    boxMesh.position.copy(center); // Position at the center of the bounding box
    this.cameraGroup.add(boxMesh); // Add the wireframe to the cameraGroup

    // this.physics.addPhysics({
    //   object: this.cameraGroup,
    //   autoAnimate: true,
    //   rigidBodyType: RAPIER.RigidBodyType.Dynamic,
    //   colliderType: 'capsule',
    //   colliderSettings: {dimensions: {radius: 0.4, halfHeight: 2}}
    // });



    this.pos = new THREE.Vector3(0, 0, 0);

    const axesHelper = new THREE.AxesHelper(480);
    this.add(axesHelper);

    // const helper = new THREE.CameraHelper(this.activeCamera);
    // this.add(helper);
  }

  update(dt: number) {
    this.accumulator += dt;
    while (this.accumulator >= this.timeStep) {
      this.accumulator -= this.timeStep;
      if (this.scene.inputManager.isActionActive(InputAction.PRIMARY_ACTION)) {
        const mouseDelta = this.scene.inputManager.getMouseDelta();
        this.cameraGroup.rotateY(-(mouseDelta.x / 50));
        this.orbitCamera.rotateX(-(mouseDelta.y / 50));
      }
      if (this.scene.inputManager.isActionActive(InputAction.MOVE_FORWARD)) {
        this.cameraGroup.translateZ(-0.40);
      }
      if (this.scene.inputManager.isActionActive(InputAction.MOVE_BACKWARD)) {
        this.cameraGroup.translateZ(0.40);
      }
      if (this.scene.inputManager.isActionActive(InputAction.MOVE_LEFT)) {
        this.cameraGroup.translateX(-0.40);
      }
      if (this.scene.inputManager.isActionActive(InputAction.MOVE_RIGHT)) {
        this.cameraGroup.translateX(0.40);
      }
      if (this.scene.inputManager.isActionActive(InputAction.JUMP)) {
        this.cameraGroup.translateY(0.40);
      }
      if (this.scene.inputManager.isActionActive(InputAction.CROUCH)) {
        this.cameraGroup.translateY(-0.40);
      }
    }
    // this.physics.update()
    this.terrain.update(this.cameraGroup.position);
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
