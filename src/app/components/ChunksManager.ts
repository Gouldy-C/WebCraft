import * as THREE from "three";
import { ChunkSize, TerrainGenParams } from "./unused/Terrain";
import { World } from "./World";
import {
  coordsXYZFromKey,
  getVisibleChunks,
  indexFromXYZCoords,
  keyFromXYZCoords,
  measureTime,
  worldToChunkCoords,
} from "../utils/helpers";

interface WorkerData {
  workerId: number;
  chunkKey: string;
  voxelDataBuffer: ArrayBuffer;
}

export class ChunksManager {
  world: World;

  params: TerrainGenParams;
  chunkSize: ChunkSize;
  chunks: Record<string, Uint16Array | null>

  chunksQueue: Set<string> = new Set();
  numberOfWorkers = 4;
  workers: Worker[] = [];
  workersBusy: boolean[] = [];

  constructor(world: World) {
    this.world = world;
    this.params = world.worldStore.get(["terrain"]);
    this.chunkSize = this.params.chunkSize;
    this.chunks = {}

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

  update(visibleChunks: { x: number; y: number; z: number }[] | null) {
    if (visibleChunks) {
      for (const { x, y, z } of visibleChunks) {
        const key = keyFromXYZCoords(x, y, z);
        if ( !this.chunks.hasOwnProperty(key) &&
              !this.chunksQueue.has(key)
        ) this.chunksQueue.add(key)
      }
    }

    const workersAvailable = this.workersBusy.filter((busy) => !busy).length;
    if (workersAvailable === 0) return;
    for (let i = 0; i < workersAvailable; i++) {
      this.generateChunk();
    }
  }

  generateChunk() {
    if (this.chunksQueue.size == 0) return;
    if (!this.workersBusy.includes(false)) return;

    const key = this.chunksQueue.values().next().value;
    if (!key) return;

    const diffs = this.world.worldStore.get(["diffs"]);

    const workerId = this.workersBusy.findIndex((busy) => !busy);
    this.workersBusy[workerId] = true;
    this.workers[workerId].postMessage({
      type: "generateChunkData",
      data: {
        chunkKey: key,
        params: this.params,
        diffs: diffs,
      },
      workerId: workerId,
    });
    this.chunksQueue.delete(key);
  }

  handleWorkerMessage(e: MessageEvent) {
    const { workerId, chunkKey, voxelDataBuffer } = e.data as WorkerData;
    this.workersBusy[workerId] = false;
    this.chunks[chunkKey] = new Uint16Array(voxelDataBuffer);
  }

  computeChunkId(x: number, y: number, z: number) {
    const { x:chunkX, y: chunkY, z:chunkZ } = worldToChunkCoords(x, y, z, this.chunkSize).chunk
    return `${chunkX},${chunkY},${chunkZ}`;
  }

  getChunkForVoxel(x: number, y: number, z: number) {
    const { x:chunkX, y: chunkY, z:chunkZ } = worldToChunkCoords(x, y, z, this.chunkSize).chunk
    return this.chunks[keyFromXYZCoords(chunkX, chunkY, chunkZ)];
  }

  getVoxel(x: number, y: number, z: number) {
    const chunkData = this.getChunkForVoxel(x, y, z);
    if (!chunkData) {
      return 0;
    }
    const voxelIndex = indexFromXYZCoords(x, y, z, this.chunkSize);
    return chunkData[voxelIndex];
  }

  setVoxel(x: number, y: number, z: number, v: number) {
    let chunkData = this.getChunkForVoxel(x, y, z);
    if (!chunkData) {
      console.error("Chunk not found for setVoxel at " + x + ", " + y + ", " + z);
      return;
    }
    this.world.worldStore.set(
      ["diffs", keyFromXYZCoords(x, y, z)],
      { id: v }
    );
    const voxelIndex = indexFromXYZCoords(x, y, z, this.chunkSize);
    chunkData[voxelIndex] = v;
  }
}
