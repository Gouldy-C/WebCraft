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
import { FractalNoiseParams } from "../utils/classes/FractalNoise";
import { Chunk } from "./Chunk";
import { F_SHADER, V_SHADER } from "../utils/shaders";
import { TextureArrayBuilder } from "../utils/classes/TextureArrayBuilder";
import { BLOCKS } from "../utils/BlocksData";
import { displayNoiseMapImage, TerrainMaps } from "../utils/classes/TerrainMaps";
import { getQuadPoints, packVertices } from "../utils/chunkGenFunctions";

export interface TerrainGenParams {
  seed: string;
  chunkSize: number;
  maxWorldHeight: number;
  hDrawDist: number;
  vDrawDist: number;
  terrainSampleRate: number;

  fractalNoise: FractalNoiseParams;

  seaLevel: number;
  mountainHeight: number;
  snowHeight: number;
  surfaceVariance: number;

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
  chunkPool: Chunk[] = [];

  params: TerrainGenParams;
  chunkSize: number;
  hDrawDist: number;
  vDrawDist: number;
  currentChunk: { x: number; y: number; z: number };

  shaderMaterial: THREE.ShaderMaterial;
  textureArrayBuilder: TextureArrayBuilder;

  batchedMesh: THREE.BatchedMesh;

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

    const workerParams = {
      url: new URL("../utils/workers/terrainWorker.ts", import.meta.url),
      numberOfWorkers: window.navigator.hardwareConcurrency,
      callback: (obj: WorkerObj) => this._handleWorkerMessage(obj),
    };
    this.workerQueue = new WorkerQueue(workerParams);

    this._init();

    this.batchedMesh = new THREE.BatchedMesh(20000, 7000000, 10000000, this.shaderMaterial);
    this.add(this.batchedMesh);


    // const terrainMaps = new TerrainMaps(this.params);
    // displayNoiseMapImage(terrainMaps, 'humidity', 8000, 8000);

    // const xp = getQuadPoints(0,4,0,0,5,5)
    // console.log('xp', ...xp)
    // const xn = getQuadPoints(1,0,0,0,5,5)
    // console.log('xn', ...xn)
    // const yp = getQuadPoints(2,0,4,0,5,5)
    // console.log('yp', ...yp)
    // const yn = getQuadPoints(3,0,0,0,5,5)
    // console.log('yn', ...yn)
    // const zp = getQuadPoints(4,0,0,4,5,5)
    // console.log('zp', ...zp)
    // const zn = getQuadPoints(5,0,0,0,5,5)
    // console.log('zn', ...zn)

    // const points = [xp, xn, yp, yn, zp, zn]
    // const vertices = []
    // const indices = []
    // const voxelData = []

    // for (let i = 0; i < 6; i++) {
    //   const {verts, inds, voxel} = packVertices(points[i], 2, i, 5, 5, vertices.length)
    //   console.log('verts', ...verts)
    //   console.log('inds', ...inds)


    //   vertices.push(...verts)
    //   indices.push(...inds)
    //   voxelData.push(...voxel)
    // }
    // const bufferGeometry = new THREE.BufferGeometry()
    // bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    // bufferGeometry.setAttribute('voxel', new THREE.Uint32BufferAttribute(voxelData, 2))
    // bufferGeometry.setIndex(indices)
    // const testMesh = new THREE.Mesh(bufferGeometry, this.shaderMaterial)
    // testMesh.position.set(0, 0, 0);
    // this.add(testMesh)

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
      Math.ceil(this.params.maxWorldHeight / this.chunkSize)
    );
  }

  _handleWorkerMessage(obj: WorkerObj) {
    const { id } = obj;
    const chunk = this.chunks.get(id);
    if (chunk) chunk.handleWorkerMessage(obj);
    else
      throw new Error(`Chunk not found, in TerrainManager.handleWorkerMessage ${id}`);  
  }

  _updateChunks(addedChunks: Set<string>, removedChunks: Set<string>) {
    for (const chunkKey of addedChunks) {
      if (this.chunks.has(chunkKey)) continue;
      const chunk = this.chunkPool.pop();
      if (chunk) {
        chunk.reuseChunk(this, chunkKey);
        this.chunks.set(chunkKey, chunk)
      }
      else this.chunks.set(chunkKey, new Chunk(this, chunkKey));
      this.activeChunks.add(chunkKey);
    }
    for (const chunkKey of removedChunks) {
      const chunk = this.chunks.get(chunkKey);
      this.workerQueue.removeRequest(chunkKey)
      if (chunk) {
        chunk.clear();
        this.chunkPool.push(chunk);
      }
      this.chunks.delete(chunkKey);
      this.activeChunks.delete(chunkKey);
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
