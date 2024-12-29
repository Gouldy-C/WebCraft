import * as THREE from "three";
import { ChunkSize, TerrainGenParams } from "./unused/Terrain";
import { World } from "./World";
import { ChunksManager } from "./ChunksManager";
import {
  coordsXYZFromKey,
  getVisibleChunks,
  keyFromXYZCoords,
  measureTime,
  spiralGridCoords,
  worldToChunkCoords,
} from "../utils/helpers";

const neighborOffsets = [
  [0, 0, 0], // self
  [-1, 0, 0], // left
  [1, 0, 0], // right
  [0, -1, 0], // down
  [0, 1, 0], // up
  [0, 0, -1], // back
  [0, 0, 1], // front
];

interface WorkerData {
  chunkKey: string;
  positionsBuffer: ArrayBuffer;
  normalsBuffer: ArrayBuffer;
  uvsBuffer: ArrayBuffer;
  indicesBuffer: ArrayBuffer;
  workerId: number;
}

export class TerrainManager extends THREE.Group {
  asyncLoad = false;

  world: World;

  chunksManager: ChunksManager;
  params: TerrainGenParams;
  chunkIdToMesh: Record<string, THREE.Mesh | undefined>;
  chunkSize: ChunkSize;
  currentChunk: { x: number; y: number; z: number } | null;
  material: THREE.MeshLambertMaterial;

  meshesQueue: Set<string> = new Set();
  numberOfWorkers = 4;
  workers: Worker[] = [];
  workersBusy: boolean[] = [];

  constructor(world: World) {
    super();
    this.world = world;
    this.params = world.worldStore.get(["terrain"]);
    this.chunkSize = this.params.chunkSize;
    this.chunksManager = new ChunksManager(world);
    this.currentChunk = null
    this.chunkIdToMesh = {};
    // this.material = new THREE.MeshLambertMaterial({
    //   map: texture,
    //   side: THREE.DoubleSide,
    //   alphaTest: 0.1,
    //   transparent: true,
    // });

    this.material = new THREE.MeshLambertMaterial({ color: "#246d36" });

    for (let i = 0; i < this.numberOfWorkers; i++) {
      const worker = new Worker(
        new URL("../utils/workers/genVoxelData.ts", import.meta.url),
        { type: "module" }
      );
      worker.onmessage = (e) => this.handleWorkerMessage(e);
      worker.onerror = (e) => {
        console.error(e);
      };
      worker.onmessageerror = (e) => {
        console.error(e);
      };
      this.workers.push(worker);
      this.workersBusy.push(false);
    }
  }

  update(playerPosition: THREE.Vector3) {
    let visibleChunks = null
    const coords = worldToChunkCoords(playerPosition.x, playerPosition.y, playerPosition.z, this.chunkSize);
    if (this.currentChunk === null || coords.chunk.x !== this.currentChunk.x || coords.chunk.z !== this.currentChunk.z) {
      this.currentChunk = coords.chunk;
      visibleChunks = spiralGridCoords(
        0,
        this.params.drawDistance, 
        {x: this.currentChunk.x, z: this.currentChunk.z}
      )

      for (const chunk of visibleChunks) {
        const key = keyFromXYZCoords(chunk.x, chunk.y, chunk.z);
        if (!this.chunkIdToMesh.hasOwnProperty(key)) {
          this.meshesQueue.add(key);
        }
      }
    }
    
    this.chunksManager.update(visibleChunks);

    this.removeUnusedMeshes(visibleChunks);


    const availableWorkers = this.workersBusy.filter((busy) => !busy).length;
    if (availableWorkers === 0) return;
    for (let i = 0; i < availableWorkers; i++) {
      this.generateMesh();
    }
  }

  handleWorkerMessage(e: MessageEvent) {
    const { workerId, chunkKey, positionsBuffer, normalsBuffer, uvsBuffer, indicesBuffer } = e.data as WorkerData;
    this.workersBusy[workerId] = false;
    this.updateChunkGeometry(
        chunkKey,
        positionsBuffer,
        normalsBuffer,
        uvsBuffer,
        indicesBuffer
    );
}

  generateMesh() {
    if (this.meshesQueue.size === 0) return;
    if (!this.workersBusy.includes(false)) return;

    const key = this.meshesQueue.values().next().value;

    if (!key) return;
    if (!this.chunksManager.chunks[key]) return;

    this.chunkIdToMesh[key] = undefined;

    const workerId = this.workersBusy.indexOf(false);
    this.workersBusy[workerId] = true;
    this.workers[workerId].postMessage({
      type: "generateChunkMeshData",
      workerId: workerId,
      data: {
        chunkKey: key,
        params: this.params,
        voxelDataBuffer: this.chunksManager.chunks[key].buffer,
      },
    });
    this.meshesQueue.delete(key);
  }

  removeUnusedMeshes(
    visibleChunks: { x: number; y: number; z: number }[] | null
  ) {
    if (!visibleChunks) return;
    const queues = [...this.meshesQueue, ...Object.keys(this.chunkIdToMesh), ...Object.keys(this.chunksManager.chunks), ...Object.keys(this.chunksManager.chunksQueue)];
    const unusedChunks = queues.filter((key) => !visibleChunks.some(
        ({ x, y, z }) => key === keyFromXYZCoords(x, y, z)
      )
    );

    for (const key of unusedChunks) {
      delete this.chunksManager.chunks[key];
      this.chunksManager.chunksQueue.delete(key);
      this.meshesQueue.delete(key);
      const mesh = this.chunkIdToMesh[key];
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
        delete this.chunkIdToMesh[key];
      }
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
      this.meshesQueue.add(chunkId);
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
        const mesh = this.chunkIdToMesh[key];
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
    let mesh = this.chunkIdToMesh[chunkKey];
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
      this.chunkIdToMesh[chunkKey] = mesh;
      mesh.position.set(
        chunkX * this.chunkSize.width - 0.5,
        -0.5,
        chunkZ * this.chunkSize.width - 0.5
      );
      this.add(mesh);
    }
  }
}
