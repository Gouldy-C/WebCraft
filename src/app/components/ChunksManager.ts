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
import { RequestObj, ReturnObj, WorkerQueue } from "../utils/WorkerQueue";
import { ReturnVoxelData } from "../utils/workers/genVoxelData";

interface RequestData extends RequestObj {
  id: string;
  type: string;
  data: {
    chunkKey: string;
    params: TerrainGenParams;
    diffs: Record<string, { blockId: number }>;
  };
}

export class ChunksManager {
  world: World;

  params: TerrainGenParams;
  chunkSize: ChunkSize;
  chunks: Record<string, Uint16Array | null>

  workerQueue: WorkerQueue<RequestData>;

  constructor(world: World) {
    this.world = world;
    this.params = world.worldStore.get(["terrain"]);
    this.chunkSize = this.params.chunkSize;
    this.chunks = {}

    const workerParams = {
      url: new URL("../utils/workers/genVoxelData.ts", import.meta.url),
      numberOfWorkers: 4,
      callback: (obj: ReturnVoxelData) => this.handleWorkerMessage(obj),
    };
    this.workerQueue = new WorkerQueue(workerParams);
  }

  update(visibleChunks: THREE.Vector3[] | null) {
    this.workerQueue.update();
    if (!visibleChunks) return;
    for (const { x, y, z } of visibleChunks) {
      const key = keyFromXYZCoords(x, y, z);
      if (this.chunks[key]) continue;
      if (this.workerQueue.isRequestInQueue(key)) continue;
      this.generateChunk(key);
    }
  }

  generateChunk(chunkKey: string) {
    const diffs = this.world.worldStore.get(["diffs"]);
    const requestData: RequestData = {
      id: chunkKey,
      type: "generateChunkVoxelData",
      data: {
        chunkKey: chunkKey,
        params: this.params,
        diffs: diffs,
      },
    };
    this.workerQueue.addRequest(requestData);
  }

  handleWorkerMessage(obj:ReturnVoxelData) {
    const { chunkKey, voxelDataBuffer } = obj
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
