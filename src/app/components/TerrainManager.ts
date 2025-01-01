import * as THREE from "three";
import { ChunkSize, TerrainGenParams } from "./unused/Terrain";
import { World } from "./World";
import { ChunksManager } from "./ChunksManager";
import {
  coordsXYZFromKey,
  keyFromXYZCoords,
  setDifference,
  spiralGridKeys,
  worldToChunkCoords,
} from "../utils/helpers";
import { RequestObj, WorkerQueue } from "../utils/WorkerQueue";
import { ReturnGeometryData } from "../utils/workers/genVoxelData";
import { QuadTree } from "../utils/QuadTree";

const neighborOffsets = [
  [0, 0, 0], // self
  [-1, 0, 0], // left
  [1, 0, 0], // right
  [0, -1, 0], // down
  [0, 1, 0], // up
  [0, 0, -1], // back
  [0, 0, 1], // front
];

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
      numberOfWorkers: 4,
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
      chunkChangedFlag = true
      this.currentChunk = coords;
      this.visibleChunksKeys = spiralGridKeys(
        0,
        this.params.drawDistance, 
        {x: this.currentChunk.x, z: this.currentChunk.z}
      )
      
      const oldMeshesKeys = setDifference(this.meshesKeys, this.visibleChunksKeys)
      const oldQueueKeys = setDifference(this.workerQueue.getQueueIds(), this.visibleChunksKeys)
      this.removeUnusedMeshes(oldMeshesKeys);
      this.removeQueuedMeshes(oldQueueKeys);

      // const min = this.params.chunkSize.width * 1000 * -1
      // const max = this.params.chunkSize.width * 1000;
      // const qParams = {
      //   min: new THREE.Vector2(min, min),
      //   max: new THREE.Vector2(max, max),
      //   chunkWidth: this.chunkSize.width,
      //   drawDistance: this.params.drawDistance
      // }
      // const q = new QuadTree(qParams);
      // q.Insert({x: playerPosition.x, z: playerPosition.z})
      // const children = q.GetChildren()
      // const newTerrainChunks = {}
      // const center = new THREE.Vector2()
      // const dimensions = new THREE.Vector2()
      // const index = 3
      // for (let i = 0; i < children.length; i++) {
      //   const xmin = children[i].bounds.min.x > children[i].bounds.max.x ? children[i].bounds.min.x : children[i].bounds.max.x
      //   const ymin = children[i].bounds.min.y > children[i].bounds.max.y ? children[i].bounds.min.y : children[i].bounds.max.y
      //   console.log(xmin, ymin)
      // }
    }

    this.chunksManager.update(this.visibleChunksKeys, chunkChangedFlag);

    const newMeshesKeys = setDifference(this.chunksManager.chunksKeys, this.meshesKeys)
    this.generateNewMeshes(newMeshesKeys);
  }

  handleWorkerMessage(obj: ReturnGeometryData) {
    const { chunkKey, positionsBuffer, normalsBuffer, uvsBuffer, indicesBuffer } = obj
    this.updateChunkGeometry(
        chunkKey,
        positionsBuffer,
        normalsBuffer,
        uvsBuffer,
        indicesBuffer
    );
  }

  generateNewMeshes(newMeshesKeys: Set<string>) {
    if (newMeshesKeys.size === 0) return
    for (const key of newMeshesKeys) {
      if (this.meshes[key]) continue;
      this.generateMesh(key);
    }
  }

  generateMesh(chunkKey: string) {
    if (!this.chunksManager.chunks[chunkKey]) return;
    const requestData: RequestData = {
      id: chunkKey,
      type: "generateChunkMesh",
      data: {
        chunkKey: chunkKey,
        params: this.params,
        voxelDataBuffer: this.chunksManager.chunks[chunkKey].buffer,
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
    for (const offset of neighborOffsets) {
      const ox = x + offset[0];
      const oy = y + offset[1];
      const oz = z + offset[2];
      const chunkId = this.chunksManager.computeChunkId(ox, oy, oz);
      this.generateMesh(chunkId);
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

  updateChunkGeometry(
    chunkKey: string,
    positionsBuffer: ArrayBuffer,
    normalsBuffer: ArrayBuffer,
    uvsBuffer: ArrayBuffer,
    indicesBuffer: ArrayBuffer
  ) {
    const { x: chunkX, y: chunkY, z: chunkZ } = coordsXYZFromKey(chunkKey);
    let mesh = this.meshes[chunkKey];
    const geometry = mesh ? mesh.geometry : new THREE.BufferGeometry();
    const material = mesh ? mesh.material : this.material;

    const positionsArray = new Float32Array(positionsBuffer);
    const normalsArray = new Int8Array(normalsBuffer);
    const uvsArray = new Int16Array(uvsBuffer);
    const indicesArray = new Uint32Array(indicesBuffer);

    geometry.setAttribute("position", new THREE.BufferAttribute(positionsArray, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normalsArray, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvsArray, 2));
    geometry.setIndex(new THREE.BufferAttribute(indicesArray, 1));
    geometry.computeBoundingSphere();

    if (!mesh) {
      mesh = new THREE.Mesh(geometry, material);
      mesh.name = chunkKey;
      this.meshes[chunkKey] = mesh;
      this.meshesKeys.add(chunkKey);
      mesh.position.set(
        chunkX * this.chunkSize.width - 0.5,
        -0.5,
        chunkZ * this.chunkSize.width - 0.5
      );
      this.add(mesh);
    }
  }
}
