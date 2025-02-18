import * as THREE from "three";
import { World } from "./World";
import {
  chunkKeyFromXYZ,
  getDirections,
  measureTime,
  setDifference,
  spiralChunkKeys,
  worldToChunkCoords,
} from "../utils/generalUtils";
import { WorkerObj, WorkerQueue } from "../utils/classes/WorkerQueue";
import {
  FractalNoiseParams,
} from "../utils/classes/FractalNoise";
import { Chunk } from "./Chunk";
import { F_SHADER, V_SHADER } from "../utils/shaders";
import { TextureArrayBuilder } from "../utils/classes/TextureArrayBuilder";
import { BLOCKS } from "../utils/BlocksData";
import { getQuadPoints, packVertices, posNegFacesThroughAxis } from "../utils/chunkGenFunctions";
import { materialAOMap } from "three/webgpu";

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
  terrainMesh: THREE.BatchedMesh

  chunks: Map<string, Chunk> = new Map();
  activeChunks: Set<string> = new Set();
  chunkPool: Chunk[] = [];

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
    this.textureArrayBuilder = new TextureArrayBuilder("terrain", 16, 16);
    this.terrainMesh = new THREE.BatchedMesh(3000, 99999999);
    this.terrainMesh.material = this.shaderMaterial
    this.add(this.terrainMesh);

    const workerParams = {
      url: new URL("../utils/workers/terrainWorker.ts", import.meta.url),
      numberOfWorkers: window.navigator.hardwareConcurrency,
      callback: (obj: WorkerObj) => this._handleWorkerMessage(obj),
    };
    this.workerQueue = new WorkerQueue(workerParams);

    this._init();
    const blockId = 2
    const vertices = [];
    const points0 = getQuadPoints(0, 0, 0, 0, 0, 32, 32)
    vertices.push(...packVertices(points0, blockId, 0, 0, 31, 31))
    const points1 = getQuadPoints(0, 1, 31, 0, 0, 32, 32)
    vertices.push(...packVertices(points1, blockId, 0, 1, 31, 31))
    const points2 = getQuadPoints(1, 0, 0, 0, 0, 32, 32)
    vertices.push(...packVertices(points2, blockId, 1, 0, 31, 31))
    const points3 = getQuadPoints(1, 1, 31, 0, 0, 32, 32)
    vertices.push(...packVertices(points3, blockId, 1, 1, 31, 31))
    const points4 = getQuadPoints(2, 0, 0, 0, 0, 32, 32)
    vertices.push(...packVertices(points4, blockId, 2, 0, 31, 31))
    const points5 = getQuadPoints(2, 1, 31, 0, 0, 32, 32)
    vertices.push(...packVertices(points5, blockId, 2, 1, 31, 31))

    vertices.push(0, 0, 0);

    const verticesData = new Float32Array(vertices);
    const bufferAttribute = new THREE.BufferAttribute(verticesData, 3)
    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setAttribute('position', bufferAttribute)
    bufferGeometry.computeBoundingSphere();
    bufferGeometry.computeBoundingBox();

    const testMesh = new THREE.Mesh(bufferGeometry, this.shaderMaterial)
    this.add(testMesh)


    const testBinary = 0b10000100001111010000000000000001
    const {PosFaces, NegFaces} = posNegFacesThroughAxis(testBinary)
    // console.log(PosFaces.toString(2).padStart(32, '0'), NegFaces.toString(2).padStart(32, '0'))
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
      this.currentChunk = chunkCoords;
      const newChunks = this._getVisibleChunks();
      const removedChunks = setDifference(this.activeChunks, newChunks);
      const addedChunks = setDifference(newChunks, this.activeChunks);
      this.activeChunks = new Set(newChunks);
      this._updateChunks(addedChunks, removedChunks);
    }
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
    else throw new Error("Chunk not found, in TerrainManager.handleWorkerMessage");
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
      if (chunk) chunk.reuseChunk(this, chunkKey);
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
    for (const block in BLOCKS) {
      this.textureArrayBuilder.setTextures(
        BLOCKS[block].id,
        BLOCKS[block].textures
      );
    }

    this.textureArrayBuilder
      .getTextureArray()
      .then(({ textureArray, textureArrayConfig }) => {
        if (textureArray && textureArrayConfig) {
          this.shaderMaterial.setValues({
            glslVersion: THREE.GLSL3,
            vertexShader: V_SHADER,
            fragmentShader: F_SHADER,
            uniforms: {
              uTextureArray: { value: textureArray },
              uTextureConfig: { value: textureArrayConfig },
            },
            transparent: true,
          });

          this.shaderMaterial.needsUpdate = true;
        }
      })
      .catch((err) => {
        console.error(err);
      });
  }
}
