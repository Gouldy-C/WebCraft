import { blockIDToBlock, BLOCKS } from "../../utils/BlocksData";
import { InputManager, InputAction } from "../../utils/classes/InputManger";
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { World } from "../World";
import { Physics } from "./MyPhysics";
import { Chunk } from "../Chunk";

export class Player extends THREE.Object3D {
  // Cached objects for reuse
  private readonly tempEuler: THREE.Euler = new THREE.Euler();
  private readonly tempMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private readonly tempVector: THREE.Vector3 = new THREE.Vector3();
  private readonly worldVelocity: THREE.Vector3 = new THREE.Vector3();
  private readonly CENTER_SCREEN = new THREE.Vector2();

  // Core components
  private readonly inputManager: InputManager;
  private readonly physics: Physics;
  world: World;

  // Readonly constants
  readonly radius: number = 0.4;
  readonly height: number = 1.8;
  readonly baseSpeed: number = 5;
  readonly sprintSpeed: number = 8;
  readonly jumpSpeed: number = 9;
  readonly reach: number = 2.9;

  // State variables
  private raycastInterval = 33; // ms
  private lastRaycastTime = 0;
  private previousSpeed = this.baseSpeed;
  private actionTimer = 0;
  private activeBlockId: number = BLOCKS.dirt.id;
  private intersect: THREE.Intersection | null = null;

  // Movement state
  sprinting: boolean = false;
  onGround: boolean = false;
  crouching: boolean = false;
  input: THREE.Vector3 = new THREE.Vector3();
  velocity: THREE.Vector3 = new THREE.Vector3();
  lastGroundY: number = -Infinity; // Track the last ground position

  // Scene objects
  camera: THREE.PerspectiveCamera;
  controls: PointerLockControls;
  raycaster: THREE.Raycaster;
  cameraHelper: THREE.CameraHelper;
  boundMesh: THREE.Mesh;
  selectionHelper: THREE.Mesh;
  selectedCoords: THREE.Vector3 | null = null;

  // Geometry and materials - made readonly
  private readonly BOUNDING_GEOMETRY = new THREE.CylinderGeometry(
    this.radius,
    this.radius,
    this.height,
    16
  );
  private readonly BOUNDING_MATERIAL = new THREE.MeshBasicMaterial({
    wireframe: true,
  });
  private readonly SELECTION_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true,
  });
  private readonly SELECTION_GEOMETRY = new THREE.BoxGeometry(1.01, 1.01, 1.01);

  constructor(world: World) {
    super();

    this.world = world;
    this.inputManager = world.inputManager;

    this.physics = new Physics(this);

    this.camera = new THREE.PerspectiveCamera(
      80,
      window.innerWidth / window.innerHeight,
      0.1,
      this.world.params.terrain.chunkSize * this.world.params.terrain.hDrawDist
    );
    this.world.add(this.camera);
    this.camera.position.set(
      this.world.params.terrain.chunkSize / 2,
      150,
      this.world.params.terrain.chunkSize / 2
    );

    this.controls = new PointerLockControls(this.camera, document.body);
    this.controls.pointerSpeed = 1.75;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = this.reach;
    this.raycaster.setFromCamera(this.CENTER_SCREEN, this.camera);

    this.boundMesh = new THREE.Mesh(
      this.BOUNDING_GEOMETRY,
      this.BOUNDING_MATERIAL
    );
    this.cameraHelper = new THREE.CameraHelper(this.camera);

    this.selectionHelper = new THREE.Mesh(
      this.SELECTION_GEOMETRY,
      this.SELECTION_MATERIAL
    );
    this.world.add(this.selectionHelper);
    this.updateBounds();
  }

  update(timeStep: number) {
    if (!this.controls.isLocked) return;
    this.physics.update(timeStep);
    console.log("player update");

    this.inputMapping();
    this.applyInput(timeStep);
    this.camera.position.set(this.position.x, this.position.y, this.position.z);

    // this.updateRaycaster()
    this.updateBounds();

    const posStringElement = document.getElementById("player-position");
    if (posStringElement) posStringElement.innerHTML = this.positionString();
  }

  private inputMapping() {
    const ima = (x: InputAction) => this.inputManager.isActionActive(x);

    this.crouching = ima(InputAction.CROUCH);
    this.sprinting =
      ima(InputAction.SPRINT) && this.onGround && !this.crouching;

    if (ima(InputAction.JUMP) && this.onGround && !this.crouching) {
      this.velocity.y = this.jumpSpeed;
    }

    if (ima(InputAction.MOVE_LEFT)) this.input.x = -1;
    if (ima(InputAction.MOVE_RIGHT)) this.input.x = 1;
    if (
      (ima(InputAction.MOVE_RIGHT) && ima(InputAction.MOVE_LEFT)) ||
      (!ima(InputAction.MOVE_LEFT) && !ima(InputAction.MOVE_RIGHT))
    )
      this.input.x = 0;

    if (ima(InputAction.MOVE_FORWARD)) this.input.z = 1;
    if (ima(InputAction.MOVE_BACKWARD)) this.input.z = -1;
    if (
      (ima(InputAction.MOVE_FORWARD) && ima(InputAction.MOVE_BACKWARD)) ||
      (!ima(InputAction.MOVE_FORWARD) && !ima(InputAction.MOVE_BACKWARD))
    )
      this.input.z = 0;

    if (ima(InputAction.RELOAD)) {
      this.position.set(10, 150, 10);
      this.velocity.set(0, 0, 0);
    }

    this.actionTimer = Math.max(0, this.actionTimer - 1);

    if (ima(InputAction.PRIMARY_ACTION)) {
      this.primaryAction();
    }

    if (ima(InputAction.SECONDARY_ACTION)) {
      this.secondaryAction();
    }

    const mouseWheelDelta = this.inputManager.getMouseWheelDelta();
    if (mouseWheelDelta.y) {
      if (mouseWheelDelta.y < 0) {
        this.activeBlockId++;
        if (this.activeBlockId > BLOCKS.cobblestone.id) {
          this.activeBlockId = BLOCKS.dirt.id;
        }
        console.log(blockIDToBlock[this.activeBlockId].name);
      }
      if (mouseWheelDelta.y > 0) {
        this.activeBlockId--;
        if (this.activeBlockId < BLOCKS.dirt.id) {
          this.activeBlockId = BLOCKS.cobblestone.id;
        }
        console.log(blockIDToBlock[this.activeBlockId].name);
      }
    }
  }

  private applyInput(timeStep: number) {
    if (!this.controls.isLocked) return;

    let speed = this.calculateMovementSpeed();

    this.velocity.x = this.input.x * speed;
    this.velocity.z = this.input.z * speed;

    this.controls.moveRight(this.velocity.x * timeStep);
    this.controls.moveForward(this.velocity.z * timeStep);

    this.camera.position.y += this.velocity.y * timeStep;
    this.position.set(
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z
    );
  }

  updateBounds() {
    this.boundMesh.position.copy(this.camera.position);
    this.boundMesh.position.y -= this.height * 0.4;
  }

  // private updateRaycaster() {
  //   const now = performance.now();
  //   if (now - this.lastRaycastTime < this.raycastInterval) return;
  //   this.lastRaycastTime = now;

  //   this.raycaster.setFromCamera(this.CENTER_SCREEN, this.camera);
  //   const chunks = this.world.terrain.getIntractableChunks(
  //     this.position.x,
  //     this.position.y,
  //     this.position.z
  //   );

  //   if (chunks.length === 0) {
  //     this.clearSelection();
  //     return;
  //   }

  //   const intersects = this.raycaster.intersectObjects(chunks, true);
  //   this.handleIntersection(intersects[0]);
  // }

  private clearSelection() {
    this.selectedCoords = null;
    this.selectionHelper.visible = false;
  }

  // private handleIntersection(intersect: THREE.Intersection | undefined) {
  //   if (!intersect) {
  //     this.clearSelection();
  //     return;
  //   }

  //   const chunk = intersect.object.parent as Chunk;
  //   const mesh = intersect.object as THREE.InstancedMesh;

  //   if (!this.isValidIntersection(intersect)) {
  //     this.clearSelection();
  //     return;
  //   }

  //   this.updateSelectionPosition(intersect, chunk, mesh);
  // }

  private isValidIntersection(intersect: THREE.Intersection): boolean {
    if (intersect.instanceId === undefined) {
      console.log("no instance id");
      return false;
    }
    if (intersect.instanceId === -1) {
      console.log("instance id = -1");
      return false;
    }
    if (parseInt(intersect.object.name) === BLOCKS.air.id) {
      console.log("air block");
      return false;
    }
    return true;
  }

  private updateSelectionPosition(
    intersect: THREE.Intersection,
    chunk: Chunk,
    mesh: THREE.InstancedMesh
  ) {
    this.intersect = intersect;
    this.tempMatrix.identity();
    mesh.getMatrixAt(intersect.instanceId!, this.tempMatrix);

    this.tempVector.setFromMatrixPosition(this.tempMatrix);
    this.tempVector.add(chunk.worldPosition);

    this.selectedCoords = this.tempVector.clone();

    this.selectionHelper.position.copy(this.tempVector);
    this.selectionHelper.visible = true;
  }

  private calculateMovementSpeed(): number {
    let speed =
      this.sprinting && !this.crouching ? this.sprintSpeed : this.baseSpeed;
    speed = this.previousSpeed > speed ? this.previousSpeed - 0.03 : speed;
    speed = this.crouching ? speed / 2 : speed;
    speed = this.input.x && this.input.z ? speed * 0.708 : speed;
    this.previousSpeed = speed;
    return speed;
  }

  get worldVelocityVector(): THREE.Vector3 {
    this.worldVelocity.copy(this.velocity);
    this.tempEuler.set(0, this.camera.rotation.y, 0);
    this.worldVelocity.applyEuler(this.tempEuler);
    return this.worldVelocity;
  }

  primaryAction() {
    if (this.selectedCoords && !this.actionTimer) {
      this.world.removeVoxel(
        this.selectedCoords.x,
        this.selectedCoords.y,
        this.selectedCoords.z
      );
      this.actionTimer = 60;
    }
  }

  secondaryAction() {
    if (this.selectedCoords && !this.actionTimer) {
      const normal = this.intersect?.normal;
      normal && this.selectedCoords.add(normal);
      this.world.addVoxel(
        this.selectedCoords.x,
        this.selectedCoords.y,
        this.selectedCoords.z,
        this.activeBlockId
      );
      this.actionTimer = 60;
    }
  }

  positionString(): string {
    return `position: X:${Math.round(this.position.x)}, Y:${Math.round(
      this.position.y
    )}, Z:${Math.round(this.position.z)}\n`;
  }

  applyWorldDeltaVelocity(dv: THREE.Vector3) {
    if (!this.controls.isLocked) return;
    this.tempEuler.set(0, -this.camera.rotation.y, 0);
    dv.applyEuler(this.tempEuler);
    this.velocity.add(dv);
  }
}
