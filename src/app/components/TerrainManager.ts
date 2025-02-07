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
import { FractalNoiseParams } from "../utils/classes/FractalNoise";
import { Chunk } from "./Chunk";
import { F_SHADER, V_SHADER } from "../utils/shaders";
import { TextureArrayBuilder } from "../utils/classes/TextureArrayBuilder";

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
  params: TerrainGenParams;
  chunkSize: number;
  hDrawDist: number;
  vDrawDist: number;
  currentChunk: THREE.Vector3;
  shaderMaterial: THREE.ShaderMaterial;

  workerQueue: WorkerQueue<WorkerObj>;

  // temp vars
  normal: number;
  cube: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  bufferGeoData: Float32Array;
  textureArrayBuilder: TextureArrayBuilder;
  blockId: number;

  constructor(world: World, playerPosition: THREE.Vector3) {
    super();
    this.world = world;
    this.params = world.worldStore.get(["terrain"]);
    this.chunkSize = this.params.chunkSize;
    this.hDrawDist = this.params.hDrawDist;
    this.vDrawDist = this.params.vDrawDist;
    this.currentChunk = worldToChunkCoords(
      playerPosition.x,
      playerPosition.y,
      playerPosition.z,
      this.chunkSize
    ).chunk;

    this.shaderMaterial = new THREE.ShaderMaterial();

    this._getVisibleChunks();

    const texturePaths = [
      [
        "/textures/blocks/grass_carried.png",
        "/textures/blocks/dirt.png",
        "/textures/blocks/grass_side_carried.png",
      ],
      [
        "/textures/blocks/grass_top.png",
        "/textures/blocks/dirt.png",
        "/textures/blocks/grass_side_carried.png",
      ],
      ["/textures/blocks/missing_tile.png"],
    ];

    this.textureArrayBuilder = new TextureArrayBuilder("terrain", 16, 16);
    this.textureArrayBuilder.setTextures(1, texturePaths[0]);
    this.textureArrayBuilder.setTextures(2, texturePaths[1]);
    this.textureArrayBuilder.setTextures(3, texturePaths[2]);

    this.textureArrayBuilder
      .getTextureArray()
      .then(({ textureArray, textureArrayConfig }) => {
        if (textureArray && textureArrayConfig) {
          this.shaderMaterial.dispose();
          this.shaderMaterial.setValues({
            uniforms: {
              uTextureArray: { value: textureArray },
              uTextureConfig: { value: textureArrayConfig },
            },
            glslVersion: THREE.GLSL3,
            vertexShader: V_SHADER,
            fragmentShader: F_SHADER,
          });

          this.shaderMaterial.needsUpdate = true;
        }
      })
      .catch((err) => {
        console.error(err);
      });

    this.geometry = new THREE.BufferGeometry();
    this.blockId = 3;
    this.normal = 0;

    // vertexData(0): 9 unused bits | 2 uv | 3 normal | 6 z | 6 y | 6 x
    // blockData(1):  21 unused bits | 11 block id
    // blockData(2):  unused
    this.bufferGeoData = new Float32Array(18);
    this.bufferGeoData[0] =
      0 | (0 << 6) | (0 << 12) | (Math.floor(this.normal) << 18) | (0 << 21);
    this.bufferGeoData[1] = this.blockId << 0;
    this.bufferGeoData[3] =
      0 | (0 << 6) | (1 << 12) | (Math.floor(this.normal) << 18) | (1 << 21);
    this.bufferGeoData[4] = this.blockId << 0;
    this.bufferGeoData[6] =
      1 | (0 << 6) | (0 << 12) | (Math.floor(this.normal) << 18) | (2 << 21);
    this.bufferGeoData[7] = this.blockId << 0;
    this.bufferGeoData[9] =
      1 | (0 << 6) | (0 << 12) | (Math.floor(this.normal) << 18) | (2 << 21);
    this.bufferGeoData[10] = this.blockId << 0;
    this.bufferGeoData[12] =
      0 | (0 << 6) | (1 << 12) | (Math.floor(this.normal) << 18) | (1 << 21);
    this.bufferGeoData[13] = this.blockId << 0;
    this.bufferGeoData[15] =
      1 | (0 << 6) | (1 << 12) | (Math.floor(this.normal) << 18) | (3 << 21);
    this.bufferGeoData[16] = this.blockId << 0;

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.bufferGeoData, 3)
    );

    this.cube = new THREE.Mesh(this.geometry, this.shaderMaterial);
    this.add(this.cube);

    const workerParams = {
      url: new URL("../utils/workers/genVoxelData.ts", import.meta.url),
      numberOfWorkers: window.navigator.hardwareConcurrency,
      callback: (obj: WorkerObj) => this.handleWorkerMessage(obj),
    };
    this.workerQueue = new WorkerQueue(workerParams);
  }

  async update(playerPosition: THREE.Vector3) {
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
      this._getVisibleChunks();
      // this._removeOldChunks();
    }

    // this.chunksManager.update(this.visibleChunksKeys, chunkChangedFlag);

    // const newMeshesKeys = setDifference(this.chunksManager.chunksKeys, this.meshesKeys)
    // this.generateNewMeshes(newMeshesKeys);
  }

  _getVisibleChunks() {
    this.activeChunks = spiralChunkKeys(
      this.currentChunk,
      this.hDrawDist,
      this.vDrawDist,
      Math.ceil(this.params.maxWorldHeight / this.chunkSize) - 1
    );
  }

  handleWorkerMessage(obj: WorkerObj) {
    const { id } = obj;
    const chunk = this.chunks.get(id);
    if (chunk) chunk.handleWorkerMessage(obj);
    else
      throw new Error("Chunk not found, in TerrainManager.handleWorkerMessage");
  }

  // removeUnusedMeshes(oldMeshesKeys: Set<string>) {
  //   if (oldMeshesKeys.size === 0) return
  //   for (const key of oldMeshesKeys) {
  //     if (!this.meshes[key]) continue;
  //     this.disposeMesh(key);
  //   }
  // }

  // removeQueuedMeshes(oldQueueKeys: Set<string>) {
  //   if (oldQueueKeys.size === 0) return
  //   for (const key of oldQueueKeys) {
  //     if (this.meshes[key]) continue;
  //     this.workerQueue.removeRequest(key);
  //   }
  // }

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

  _removeOldChunks() {
    const oldQueueKeys = setDifference(
      this.workerQueue.getQueueIds(),
      this.visibleChunksKeys
    );
    this.removeQueuedMeshes(oldQueueKeys);

    const oldMeshesKeys = setDifference(
      this.meshesKeys,
      this.visibleChunksKeys
    );
    this.removeUnusedMeshes(oldMeshesKeys);
  }

  // disposeMesh(meshKey: string): void {
  //   const mesh = this.meshes[meshKey];
  //   if (mesh) {
  //     mesh.geometry.dispose();
  //     if (mesh.material instanceof Array) {
  //       mesh.material.forEach((material) => {
  //         material.dispose();
  //       });
  //     } else {
  //       mesh.material.dispose();
  //     }
  //     this.remove(mesh);
  //     delete this.meshes[meshKey];
  //     this.meshesKeys.delete(meshKey);
  //   }
  // }

  // generateNewMeshes(newMeshesKeys: Set<string>) {
  //   if (newMeshesKeys.size === 0) return
  //   for (const meshKey of newMeshesKeys) {
  //     if (!this.chunksManager.chunks[meshKey]) continue;
  //     if (this.meshes[meshKey]) continue;
  //     this.generateMesh(meshKey);
  //   }
  // }

  // generateMesh(meshKey: string) {
  //   if (!this.chunksManager.chunks[meshKey]) return;
  //   const requestData: RequestData = {
  //     id: meshKey,
  //     type: "generateChunkMesh",
  //     data: {
  //       chunkKey: meshKey,
  //       params: this.params,
  //       voxelDataBuffer: this.chunksManager.chunks[meshKey].buffer,
  //       currentChunk: this.currentChunk
  //     },
  //   };
  //   this.workerQueue.addRequest(requestData);
  // }

  // generateMeshGeometry(
  //   chunkKey: string,
  //   positionsBuffer: ArrayBuffer,
  //   normalsBuffer: ArrayBuffer,
  //   indicesBuffer: ArrayBuffer
  // ) {
  //   const { x: chunkX, y: chunkY, z: chunkZ } = coordsXYZFromKey(chunkKey);
  //   const difX = chunkX - this.currentChunk.x;
  //   const difZ = chunkZ - this.currentChunk.z;
  //   const distance = Math.abs(difX) + Math.abs(difZ)
  //   let mesh = this.meshes[chunkKey];
  //   const geometry = mesh ? mesh.geometry : new THREE.BufferGeometry();
  //   const material = mesh ? mesh.material : this.material;
  //   if (mesh) mesh.renderOrder = distance

  //   const positionsArray = new Float32Array(positionsBuffer);
  //   const normalsArray = new Int8Array(normalsBuffer);
  //   const indicesArray = new Uint32Array(indicesBuffer);

  //   geometry.setAttribute("position", new THREE.BufferAttribute(positionsArray, 3));
  //   geometry.setAttribute("normal", new THREE.BufferAttribute(normalsArray, 3));
  //   geometry.setIndex(new THREE.BufferAttribute(indicesArray, 1));
  //   geometry.computeBoundingSphere();

  //   if (!mesh) {
  //     mesh = new THREE.Mesh(geometry, material);
  //     mesh.renderOrder = distance;
  //     mesh.name = chunkKey;
  //     this.meshes[chunkKey] = mesh;
  //     this.meshesKeys.add(chunkKey);
  //     const gx = chunkX * (this.chunkSize - 2)
  //     const gz = chunkZ * (this.chunkSize - 2)
  //     const gy = chunkY * this.chunkSize
  //     mesh.position.set(
  //       gx - 0.5,
  //       gy - 0.5,
  //       gz - 0.5
  //     );
  //     this.add(mesh);
  //   }
  // }
}
