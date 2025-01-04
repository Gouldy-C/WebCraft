import * as THREE from "three";
import { World } from "./World";
import { ChunksManager } from "./ChunksManager";
import {
  chunkKeyFromXYZ,
  coordsXYZFromKey,
  getDirections,
  keyFromXYZCoords,
  setDifference,
  spiralGridKeys,
  worldToChunkCoords,
} from "../utils/generalUtils";
import { RequestObj, WorkerQueue } from "../utils/classes/WorkerQueue";
import { ReturnGeometryData } from "../utils/workers/genVoxelData";
import { QuadTree } from "../utils/classes/QuadTree";
import { FractalNoiseParams } from "../utils/classes/FractalNoise";


export interface ChunkSize {
  width: number;
  height: number;
}

export interface TerrainGenParams {
  seed: string;
  chunkSize: ChunkSize;
  drawDistance: number;
  lodDistance: number;
  lod: number;
  fractalNoise: FractalNoiseParams;
  trees: {
    buffer: number;
    density: number;
    trunk: {
      diameter: number;
      minHeight: number;
      maxHeight: number;
    };
    canopy: {
      minRadius: number;
      maxRadius: number;
    };
  };
}
interface RequestData extends RequestObj {
  id: string;
  type: string;
  data: {
    chunkKey: string;
    params: TerrainGenParams;
    voxelDataBuffer: ArrayBuffer;
    currentChunk: { x: number; y: number; z: number } | null;
  };
}

export class TerrainManager extends THREE.Group {

  meshes: Record<string, THREE.Mesh> = {};
  meshesKeys: Set<string> = new Set();
  currentChunk: { x: number; y: number; z: number } = { x: -Infinity, y: -Infinity, z: -Infinity };
  visibleChunksKeys:Set<string> = new Set();
  
  world: World;
  chunksManager: ChunksManager;
  params: TerrainGenParams;
  chunkSize: ChunkSize;
  material: THREE.Material;
  workerQueue: WorkerQueue<RequestData>;

  constructor(world: World) {
    super();
    this.world = world;
    this.params = world.worldStore.get(["terrain"]);
    this.chunkSize = this.params.chunkSize;
    this.chunksManager = new ChunksManager(world);
    this.material = new THREE.MeshLambertMaterial({color: "#33551c"});

    const workerParams = {
      url: new URL("../utils/workers/genVoxelData.ts", import.meta.url),
      numberOfWorkers: window.navigator.hardwareConcurrency,
      callback: (obj: ReturnGeometryData) => this.handleWorkerMessage(obj),
    };
    this.workerQueue = new WorkerQueue(workerParams);
  }

  update(playerPosition: THREE.Vector3) {
    this.workerQueue.update();
    const coords = worldToChunkCoords(playerPosition.x, playerPosition.y, playerPosition.z, this.chunkSize).chunk;
    const curr = this.currentChunk
    let chunkChangedFlag = false

    if (coords.x !== curr.x || coords.z !== curr.z) {
      this.currentChunk = coords
      chunkChangedFlag = true
      this.getVisibleChunksRemoveOldChunks(playerPosition);
    }

    this.chunksManager.update(this.visibleChunksKeys, chunkChangedFlag);

    const newMeshesKeys = setDifference(this.chunksManager.chunksKeys, this.meshesKeys)
    this.generateNewMeshes(newMeshesKeys);
  }

  handleWorkerMessage(obj: ReturnGeometryData) {
    const { chunkKey, positionsBuffer, normalsBuffer, uvsBuffer, indicesBuffer } = obj
    this.generateMeshGeometry(
        chunkKey,
        positionsBuffer,
        normalsBuffer,
        uvsBuffer,
        indicesBuffer
    );
  }

  generateNewMeshes(newMeshesKeys: Set<string>) {
    if (newMeshesKeys.size === 0) return
    for (const meshKey of newMeshesKeys) {
      if (this.meshes[meshKey]) continue;
      this.generateMesh(meshKey);
    }
  }

  generateMesh(meshKey: string) {
    if (!this.chunksManager.chunks[meshKey]) return;
    const requestData: RequestData = {
      id: meshKey,
      type: "generateChunkMesh",
      data: {
        chunkKey: meshKey,
        params: this.params,
        voxelDataBuffer: this.chunksManager.chunks[meshKey].buffer,
        currentChunk: this.currentChunk
      },
    };
    this.workerQueue.addRequest(requestData);
  }

  removeUnusedMeshes(oldMeshesKeys: Set<string>) {
    if (oldMeshesKeys.size === 0) return
    for (const key of oldMeshesKeys) {
      if (!this.meshes[key]) continue;
      this.disposeMesh(key);
    }
  }

  removeQueuedMeshes(oldQueueKeys: Set<string>) {
    if (oldQueueKeys.size === 0) return
    for (const key of oldQueueKeys) {
      if (this.meshes[key]) continue;
      this.workerQueue.removeRequest(key);
    }
  }

  disposeMesh(meshKey: string): void {
    const mesh = this.meshes[meshKey];
    if (mesh) {
      mesh.geometry.dispose();
      if (mesh.material instanceof Array) {
        mesh.material.forEach((material) => {
          material.dispose();
        });
      } else {
        mesh.material.dispose();
      }
      this.remove(mesh);
      delete this.meshes[meshKey];
      this.meshesKeys.delete(meshKey);
    }
  }


  getVoxel(x: number, y: number, z: number) {
    return this.chunksManager.getVoxel(x, y, z);
  }

  addVoxel(x: number, y: number, z: number, voxelId: number) {
    this.chunksManager.setVoxel(x, y, z, voxelId);
    this.updateVoxelGeometry(x, y, z);
  }

  removeVoxel(x: number, y: number, z: number) {
    this.chunksManager.setVoxel(x, y, z, 0);
    this.updateVoxelGeometry(x, y, z);
  }

  updateVoxelGeometry(x: number, y: number, z: number) {
    const set = new Set();
    for (const { dx, dy, dz} of getDirections(1)) {
      const vx = x + dx;
      const vy = y + dy;
      const vz = z + dz;
      const chunkId = chunkKeyFromXYZ(vx, vy, vz, this.params.chunkSize);
      if (set.has(chunkId)) continue;
      set.add(chunkId);
      this.generateMesh(chunkId)
    }
  }

  getIntractableMeshes(x: number, y: number, z: number): THREE.Mesh[] {
    const coords = worldToChunkCoords(x, y, z, this.params.chunkSize);
    const meshes = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = keyFromXYZCoords(
          coords.chunk.x + dx,
          coords.chunk.y,
          coords.chunk.z + dz
        );
        const mesh = this.meshes[key];
        if (mesh) {
          meshes.push(mesh);
        }
      }
    }
    return meshes;
  }

  getVisibleChunksRemoveOldChunks(playerPosition: THREE.Vector3) {
    this.visibleChunksKeys = spiralGridKeys(
      0,
      this.params.drawDistance, 
      {x: this.currentChunk.x, z: this.currentChunk.z}
    )
    const worldSize = this.chunkSize.width * Math.pow(2, this.params.drawDistance);
    const qParams = {
      min: new THREE.Vector2(-worldSize, -worldSize),
      max: new THREE.Vector2(worldSize, worldSize),
      chunkWidth: this.chunkSize.width,
      drawDistance: this.params.drawDistance
    };
    const q = new QuadTree(qParams);
    q.Insert(playerPosition);
    const children = q.GetChildren();
    
    const oldMeshesKeys = setDifference(this.meshesKeys, this.visibleChunksKeys)
    const oldQueueKeys = setDifference(this.workerQueue.getQueueIds(), this.visibleChunksKeys)
    this.removeQueuedMeshes(oldQueueKeys);
    this.removeUnusedMeshes(oldMeshesKeys);
  }

  generateMeshGeometry(
    chunkKey: string,
    positionsBuffer: ArrayBuffer,
    normalsBuffer: ArrayBuffer,
    uvsBuffer: ArrayBuffer,
    indicesBuffer: ArrayBuffer
  ) {
    const { x: chunkX, y: chunkY, z: chunkZ } = coordsXYZFromKey(chunkKey);
    const difX = chunkX - this.currentChunk.x;
    const difZ = chunkZ - this.currentChunk.z;
    const distance = Math.abs(difX) + Math.abs(difZ)
    let mesh = this.meshes[chunkKey];
    const geometry = mesh ? mesh.geometry : new THREE.BufferGeometry();
    const material = mesh ? mesh.material : this.material;
    if (mesh) mesh.renderOrder = distance
    
    const positionsArray = new Float32Array(positionsBuffer);
    const normalsArray = new Int8Array(normalsBuffer);
    const indicesArray = new Uint32Array(indicesBuffer);
    
    geometry.setAttribute("position", new THREE.BufferAttribute(positionsArray, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normalsArray, 3));
    geometry.setIndex(new THREE.BufferAttribute(indicesArray, 1));
    geometry.computeBoundingSphere();
    
    if (!mesh) {
      mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = distance;
      mesh.name = chunkKey;
      this.meshes[chunkKey] = mesh;
      this.meshesKeys.add(chunkKey);
      const gx = chunkX * (this.chunkSize.width - 2)
      const gz = chunkZ * (this.chunkSize.width - 2)
      mesh.position.set(
        gx- 0.5,
        -0.5,
        gz - 0.5
      );
      this.add(mesh);
    }
  }
}
