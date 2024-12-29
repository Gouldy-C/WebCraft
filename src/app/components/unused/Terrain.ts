import * as THREE from "three";
import { World } from "../World";
import { TerrainChunk } from "./TerrainChunk";
import { FractalNoiseParams } from "../../utils/FractalNoise";
import {
  coordsXZFromKey,
  getDirections,
  getVisibleChunks,
  keyFromXYZCoords,
  keyFromXZCoords,
  worldToChunkCoords,
} from "../../utils/helpers";
import { TexturesManager } from "../../utils/TexturesManger";
import { BLOCKS } from "../../utils/BlocksData";

export interface ChunkSize {
  width: number;
  height: number;
}

export interface TerrainGenParams {
  drawDistance: number;
  chunkSize: ChunkSize;
  seed: string | number;
  fractalNoise: FractalNoiseParams;
  trees: {
    trunk: {
      diameter: number;
      minHeight: number;
      maxHeight: number;
    };
    canopy: {
      minRadius: number;
      maxRadius: number;
    };
    density: number;
  };
}

export class Terrain extends THREE.Group {
  private loaded = false;
  private asyncLoad = false;

  world: World;
  params: TerrainGenParams;

  chunks: Map<string, TerrainChunk> = new Map();
  chunksQueue: Set<string> = new Set();

  numberOfWorkers = 4;
  workers: Worker[] = [];
  workersBusy: boolean[] = [];

  constructor(world: World) {
    super();

    this.world = world;

    this.params = world.worldStore.get(["terrain"]);

    for (let i = 0; i < this.numberOfWorkers; i++) {
      const worker = new Worker(
        new URL("../utils/workers/terrainGenWorker.ts", import.meta.url),
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
    const visibleChunks = getVisibleChunks(
      playerPosition,
      this.params.chunkSize,
      this.params.drawDistance
    );

    this.removeUnusedChunks(visibleChunks);

    for (const { x, z } of visibleChunks) {
      if (!this.chunks.has(keyFromXZCoords(x, z))) {
        this.chunksQueue.add(keyFromXZCoords(x, z));
      }
    }

    const availableWorkers = this.workersBusy.filter((busy) => !busy).length;
    const chunksToProcess = Math.min(availableWorkers, this.chunksQueue.size);

    for (let i = 0; i < chunksToProcess; i++) {
      this.generateChunk();
    }

    if (
      this.chunksQueue.size === 0 &&
      this.workersBusy.filter((busy) => busy).length === 0
    ) {
      if (this.loaded == false) console.log("world loaded");
      this.loaded = true;
    }
  }

  generateChunk() {
    if (this.chunksQueue.size <= 0) return;
    if (!this.workersBusy.includes(false)) return;
    if (!TexturesManager.getInstance().isInitialized) return;

    const key = this.chunksQueue.values().next().value;
    if (!key) return;
    const { x, z } = coordsXZFromKey(key);
    const chunk = new TerrainChunk(this.params, this.world);
    chunk.position.set(
      x * this.params.chunkSize.width,
      0,
      z * this.params.chunkSize.width
    );
    chunk.userData = { x: x, z: z };
    this.addChunk(chunk, x, z);
    this.chunksQueue.delete(key);
    let diffs = this.world.worldStore.get(["diffs", keyFromXZCoords(x, z)]);

    const workerId = this.workersBusy.findIndex((busy) => !busy);
    this.workersBusy[workerId] = true;
    this.workers[workerId].postMessage({
      chunkX: x,
      chunkZ: z,
      params: this.params,
      diffs: diffs,
      workerId: workerId,
    });
  }

  async handleWorkerMessage(e: MessageEvent) {
    const { chunkX, chunkZ, blockData, meshesData, workerId } = e.data;
    this.workersBusy[workerId] = false;

    const chunk = this.getChunk(chunkX, chunkZ);
    if (!chunk) return;
    chunk.setBlockData(new Uint16Array(blockData));
    if (this.asyncLoad) {
      requestIdleCallback(() => chunk.generateMeshes(meshesData));
    } else {
      chunk.generateMeshes(meshesData);
    }
  }

  removeUnusedChunks(visibleChunks: { x: number; z: number }[]) {
    const unusedChunks = [...this.chunks.keys()].filter((key) => {
      const [x, z] = key.split(",").map(Number);
      return !visibleChunks.some((c) => c.x === x && c.z === z);
    });

    for (const key of unusedChunks) {
      const chunk = this.chunks.get(key);
      if (chunk) {
        chunk.dispose();
        this.remove(chunk);
        this.chunks.delete(key);
      }
    }
  }

  addChunk(chunk: TerrainChunk, x: number, z: number) {
    const key = keyFromXZCoords(x, z);
    this.chunks.set(key, chunk);
    this.add(chunk);
  }

  getChunk(x: number, z: number): TerrainChunk | undefined {
    return this.chunks.get(keyFromXZCoords(x, z));
  }

  getIntractableChunks(x: number, y: number, z: number): TerrainChunk[] {
    const coords = worldToChunkCoords(x, y, z, this.params.chunkSize);
    const chunks = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const chunk = this.getChunk(coords.chunk.x + dx, coords.chunk.z + dz);
        if (chunk) {
          chunks.push(chunk);
        }
      }
    }
    return chunks;
  }

  getVoxel(x: number, y: number, z: number) {
    const coords = worldToChunkCoords(x, y, z, this.params.chunkSize);
    const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);
    if (chunk) {
      return chunk.getVoxel(coords.voxel.x, coords.voxel.y, coords.voxel.z);
    } else {
      return null;
    }
  }

  hideVoxel(x: number, y: number, z: number) {
    const coords = worldToChunkCoords(x, y, z, this.params.chunkSize);
    const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);
    if (
      chunk &&
      chunk.isVoxelObscured(coords.voxel.x, coords.voxel.y, coords.voxel.z)
    ) {
      chunk.deleteMeshInstance(coords.voxel.x, coords.voxel.y, coords.voxel.z);
    }
  }

  addVoxel(x: number, y: number, z: number, blockId: number) {
    const coords = worldToChunkCoords(x, y, z, this.params.chunkSize);
    const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);
    if (chunk) {
      chunk.addVoxel(coords.voxel.x, coords.voxel.y, coords.voxel.z, blockId);
      this.world.worldStore.set(
        [
          "diffs",
          keyFromXZCoords(coords.chunk.x, coords.chunk.z),
          keyFromXYZCoords(coords.voxel.x, coords.voxel.y, coords.voxel.z),
        ],
        { id: blockId }
      );
      for (const direction of getDirections(1)) {
        this.hideVoxel(x + direction.dx, y + direction.dy, z + direction.dz);
      }
    }
  }

  removeVoxel(x: number, y: number, z: number) {
    const coords = worldToChunkCoords(x, y, z, this.params.chunkSize);
    const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);
    if (chunk) {
      chunk.removeVoxel(coords.voxel.x, coords.voxel.y, coords.voxel.z);
      this.world.worldStore.set(
        [
          "diffs",
          keyFromXZCoords(coords.chunk.x, coords.chunk.z),
          keyFromXYZCoords(coords.voxel.x, coords.voxel.y, coords.voxel.z),
        ],
        { id: BLOCKS.air.id }
      );
      for (const direction of getDirections(1)) {
        this.revealVoxel(x + direction.dx, y + direction.dy, z + direction.dz);
      }
    }
  }

  revealVoxel(x: number, y: number, z: number) {
    const coords = worldToChunkCoords(x, y, z, this.params.chunkSize);
    const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);
    if (chunk) {
      chunk.addMeshInstance(coords.voxel.x, coords.voxel.y, coords.voxel.z);
    }
  }

  dispose() {
    for (const chunk of this.chunks.values()) {
      chunk.dispose();
      this.remove(chunk);
    }
    this.chunks.clear();
  }
}
