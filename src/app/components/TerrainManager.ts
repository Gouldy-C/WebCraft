import * as THREE from "three";
import { World } from "./World";
import { ChunksManager } from "./ChunksManager";
import {
  chunkKeyFromXYZ,
  coordsXYZFromKey,
  getDirections,
  keyFromXYZCoords,
  measureTime,
  setDifference,
  spiralChunkKeys,
  worldToChunkCoords,
} from "../utils/generalUtils";
import { WorkerObj, WorkerQueue } from "../utils/classes/WorkerQueue";
import { FractalNoise, FractalNoiseParams } from "../utils/classes/FractalNoise";
import { Chunk } from "./Chunk";
import { F_SHADER, V_SHADER } from "../utils/shaders";
import { TextureArrayBuilder } from "../utils/classes/TextureArrayBuilder";
import { BLOCKS } from "../utils/BlocksData";

export interface TerrainGenParams {
  seed: string;
  chunkSize: number;
  maxWorldHeight: number;
  hDrawDist: number;
  vDrawDist: number;
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

export class TerrainManager extends THREE.Object3D {
  world: World;

  chunks: Map<string, Chunk> = new Map();
  activeChunks: Set<string> = new Set();
  chunkPool:Chunk[] = [];

  params: TerrainGenParams;
  chunkSize: number;
  hDrawDist: number;
  vDrawDist: number;
  currentChunk: { x: number; y: number; z: number };

  shaderMaterial: THREE.ShaderMaterial;
  textureArrayBuilder: TextureArrayBuilder;

  workerQueue: WorkerQueue<WorkerObj>;

  constructor(world: World) {
    super();
    this.world = world;
    this.params = world.params.terrain;
    this.chunkSize = this.params.chunkSize;
    this.hDrawDist = this.params.hDrawDist;
    this.vDrawDist = this.params.vDrawDist;
    this.currentChunk = { x: Infinity, y: Infinity, z: Infinity };
    this.shaderMaterial = new THREE.ShaderMaterial();
    this.textureArrayBuilder = new TextureArrayBuilder("terrain", 16, 16)

    const workerParams = {
      url: new URL("../utils/workers/terrainWorker.ts", import.meta.url),
      numberOfWorkers: window.navigator.hardwareConcurrency,
      callback: (obj: WorkerObj) => this._handleWorkerMessage(obj),
    };
    this.workerQueue = new WorkerQueue(workerParams);
    
    this._init()
  }

  update(playerPosition: THREE.Vector3) {
    this.workerQueue.update();

    const chunkCoords = worldToChunkCoords(
      playerPosition.x,
      playerPosition.y,
      playerPosition.z,
      this.chunkSize
    ).chunk;
    if (
      chunkCoords.x !== this.currentChunk.x ||
      chunkCoords.z !== this.currentChunk.z ||
      chunkCoords.y !== this.currentChunk.y
    ) {
      this.currentChunk = chunkCoords
      const newChunks = this._getVisibleChunks()
      const removedChunks = setDifference(this.activeChunks, newChunks)
      const addedChunks = setDifference(newChunks, this.activeChunks)
      this.activeChunks = new Set(newChunks)
      this._updateChunks(addedChunks, removedChunks)
    }
    console.log(this.activeChunks.size)
  }

  _getVisibleChunks() {
    return spiralChunkKeys(
      this.currentChunk,
      this.hDrawDist,
      this.vDrawDist,
      Math.ceil(this.params.maxWorldHeight / this.chunkSize) - 1
    );
  }

  _handleWorkerMessage(obj: WorkerObj) {
    const { id } = obj;
    const chunk = this.chunks.get(id);
    if (chunk) chunk.handleWorkerMessage(obj);
    else
      throw new Error("Chunk not found, in TerrainManager.handleWorkerMessage");
  }

  _updateChunks(addedChunks: Set<string>, removedChunks: Set<string>) {
    for (const chunkKey of removedChunks) {
      const chunk = this.chunks.get(chunkKey);
      if (chunk) {
        chunk.clear();
        this.chunkPool.push(chunk);
      }
      this.chunks.delete(chunkKey);
      this.activeChunks.delete(chunkKey);
    }
    for (const chunkKey of addedChunks) {
      if (this.chunks.has(chunkKey)) continue;
      const chunk = this.chunkPool.pop();
      if (chunk) chunk.reuseChunk(this, chunkKey)
      else this.chunks.set(chunkKey, new Chunk(this, chunkKey));
      this.activeChunks.add(chunkKey);
    }
  }

  getVoxel(x: number, y: number, z: number) {
    const { chunk: chunkCoords, voxel: voxelCoords } = worldToChunkCoords(
      x,
      y,
      z,
      this.chunkSize
    );
    const chunkId = chunkKeyFromXYZ(
      chunkCoords.x,
      chunkCoords.y,
      chunkCoords.z,
      this.chunkSize
    );
    const chunk = this.chunks.get(chunkId);
    if (!chunk) throw new Error("Chunk not found, in TerrainManager.getVoxel");
    return chunk.getVoxel(voxelCoords.x, voxelCoords.y, voxelCoords.z);
  }

  addVoxel(x: number, y: number, z: number, voxelId: number) {
    const { chunk: chunkCoords, voxel: voxelCoords } = worldToChunkCoords(
      x,
      y,
      z,
      this.chunkSize
    );
    const chunkId = chunkKeyFromXYZ(
      chunkCoords.x,
      chunkCoords.y,
      chunkCoords.z,
      this.chunkSize
    );
    const chunk = this.chunks.get(chunkId);
    if (!chunk) throw new Error("Chunk not found, in TerrainManager.addVoxel");
    chunk.setVoxel(voxelCoords.x, voxelCoords.y, voxelCoords.z, voxelId);
    this.updateVoxelGeometry(x, y, z);
  }

  removeVoxel(x: number, y: number, z: number) {
    const { chunk: chunkCoords, voxel: voxelCoords } = worldToChunkCoords(
      x,
      y,
      z,
      this.chunkSize
    );
    const chunkId = chunkKeyFromXYZ(
      chunkCoords.x,
      chunkCoords.y,
      chunkCoords.z,
      this.chunkSize
    );
    const chunk = this.chunks.get(chunkId);
    if (!chunk)
      throw new Error("Chunk not found, in TerrainManager.removeVoxel");
    chunk.setVoxel(voxelCoords.x, voxelCoords.y, voxelCoords.z, 0);
    this.updateVoxelGeometry(x, y, z);
  }

  updateVoxelGeometry(x: number, y: number, z: number) {
    const { chunk: cCoords } = worldToChunkCoords(x, y, z, this.chunkSize);
    for (const { dx, dy, dz } of getDirections(1)) {
      const vx = x + dx;
      const vy = y + dy;
      const vz = z + dz;
      const { chunk: vCCoords } = worldToChunkCoords(
        vx,
        vy,
        vz,
        this.chunkSize
      );
      if (
        cCoords.x !== vCCoords.x ||
        cCoords.y !== vCCoords.y ||
        cCoords.z !== vCCoords.z
      )
        continue;
      const chunkId = chunkKeyFromXYZ(
        vCCoords.x,
        vCCoords.y,
        vCCoords.z,
        this.chunkSize
      );
      const chunk = this.chunks.get(chunkId);
      if (!chunk) continue;
      chunk.generateMesh();
    }
  }

  _init() {
    this.textureArrayBuilder = new TextureArrayBuilder("terrain", 16, 16);
    for (const block in BLOCKS) {
      if (block === "air") continue;
      this.textureArrayBuilder.setTextures(BLOCKS[block].id, BLOCKS[block].textures)
    }

    this.textureArrayBuilder
      .getTextureArray()
      .then(({ textureArray, textureArrayConfig }) => {
        if (textureArray && textureArrayConfig) {
          this.shaderMaterial.setValues({
            uniforms: {
              uTextureArray: { value: textureArray },
              uTextureConfig: { value: textureArrayConfig },
            },
            glslVersion: THREE.GLSL3,
            vertexShader: V_SHADER,
            fragmentShader: F_SHADER,
            transparent: true
          });

          this.shaderMaterial.needsUpdate = true;
        }
      })
      .catch((err) => {
        console.error(err);
      });
  }

}
