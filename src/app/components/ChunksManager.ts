import { ChunkSize, TerrainGenParams } from "./TerrainManager";
import { World } from "./World";
import {
  indexFromXYZCoords,
  keyFromXYZCoords,
  setDifference,
  worldToChunkCoords,
} from "../utils/generalUtils";
import { RequestObj, WorkerQueue } from "../utils/classes/WorkerQueue";
import { ReturnVoxelData } from "../utils/workers/genVoxelData";
import { VoxelGenXYZ } from "../utils/classes/VoxelGenXYZ";


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
  chunksKeys: Set<string>

  workerQueue: WorkerQueue<RequestData>;

  voxelGenXYZ: VoxelGenXYZ

  constructor(world: World) {
    this.world = world;
    this.params = world.worldStore.get(["terrain"]);
    this.chunkSize = this.params.chunkSize;
    this.chunksKeys = new Set();
    this.chunks = {}

    this.voxelGenXYZ = new VoxelGenXYZ(this.params);

    const workerParams = {
      url: new URL("../utils/workers/genVoxelData.ts", import.meta.url),
      numberOfWorkers: 8,
      callback: (obj: ReturnVoxelData) => this._handleWorkerMessage(obj),
    };
    this.workerQueue = new WorkerQueue(workerParams);
  }

  update(visibleChunksKeys: Set<string>, chunkChangedFlag: boolean) {
    this.workerQueue.update()
    if (chunkChangedFlag) {
      const oldChunksKeys = setDifference(this.chunksKeys, visibleChunksKeys)
      this._removeUnusedChunks(oldChunksKeys);

      const oldQueueKeys = setDifference(this.workerQueue.getQueueIds(), visibleChunksKeys)
      this._removeQueuedChunks(oldQueueKeys);

      const newChunksKeys = setDifference(visibleChunksKeys, this.chunksKeys)
      this._generateNewChunks(newChunksKeys);
    }
  }

  _generateNewChunks(newChunksKeys: Set<string>) {
    if (newChunksKeys.size === 0) return
    for (const key of newChunksKeys) {
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

  _handleWorkerMessage(obj:ReturnVoxelData) {
    const { chunkKey, voxelDataBuffer } = obj
    this.chunksKeys.add(chunkKey);
    this.chunks[chunkKey] = new Uint16Array(voxelDataBuffer);
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

  removeChunk(chunkKey: string) {
    this.chunksKeys.delete(chunkKey);
    delete this.chunks[chunkKey];
  }

  _removeQueuedChunks(unusedChunksKeys: Set<string>) {
    if (unusedChunksKeys.size === 0) return
    for (const key of unusedChunksKeys) {
      this.workerQueue.removeRequest(key);
    }
  }

  _removeUnusedChunks(unusedChunksKeys: Set<string>) {
    if (unusedChunksKeys.size === 0) return;
    for (const chunkKey of unusedChunksKeys) {
      this.removeChunk(chunkKey);
    }
  }
}
