import * as THREE from "three";
import { ChunkSize, TerrainGenParams } from "./unused/Terrain";
import { World } from "./World";
import { ChunksManager } from "./ChunksManager";
import {
  coordsXYZFromKey,
  getVisibleChunks,
  keyFromXYZCoords,
  measureTime,
  objectDifference,
  spiralGridCoords,
  worldToChunkCoords,
} from "../utils/helpers";
import { RequestObj, ReturnObj, WorkerQueue } from "../utils/WorkerQueue";
import { ReturnGeometryData } from "../utils/workers/genVoxelData";

const neighborOffsets = [
  [0, 0, 0], // self
  [-1, 0, 0], // left
  [1, 0, 0], // right
  [0, -1, 0], // down
  [0, 1, 0], // up
  [0, 0, -1], // back
  [0, 0, 1], // front
];

const V_SHADER = `
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  vNormal = normal;
  vUv = uv;
}
`;

const F_SHADER = `
uniform vec3 color;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  //gl_FragColor = vec4(vNormal, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
`;

interface RequestData extends RequestObj {
  id: string;
  type: string;
  data: {
    chunkKey: string;
    params: TerrainGenParams;
    voxelDataBuffer: ArrayBuffer;
  };
}

export class TerrainManager extends THREE.Group {
  asyncLoad = false;

  world: World;

  chunksManager: ChunksManager;
  params: TerrainGenParams;
  meshes: Record<string, THREE.Mesh> = {};
  chunkSize: ChunkSize;
  material: THREE.Material;
  
  currentChunk: { x: number; y: number; z: number } | null = null
  visibleChunks: THREE.Vector3[] | null = null

  workerQueue: WorkerQueue<RequestData>;

  constructor(world: World) {
    super();
    this.world = world;
    this.params = world.worldStore.get(["terrain"]);
    this.chunkSize = this.params.chunkSize;
    this.chunksManager = new ChunksManager(world);
    // this.material = new THREE.MeshLambertMaterial({
    //   map: texture,
    //   side: THREE.DoubleSide,
    //   alphaTest: 0.1,
    //   transparent: true,
    // });

    // this.material = new THREE.ShaderMaterial({
    //   uniforms: {
    //     color: { value: new THREE.Color("#33551c") },
    //     texture: { value: null },
    //   },
    //   vertexShader: V_SHADER,
    //   fragmentShader: F_SHADER,
    // });

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

    if (curr === null || coords.x !== curr.x || coords.z !== curr.z) {
      this.currentChunk = coords;
      this.visibleChunks = spiralGridCoords(
        0,
        this.params.drawDistance, 
        {x: this.currentChunk.x, z: this.currentChunk.z}
      )
    }

    const chunksToRender = Object.keys(this.chunksManager.chunks).filter(x => !Object.keys(this.meshes).includes(x));
    this.generateNewMeshes(chunksToRender);

    if (!this.visibleChunks) return
    this.chunksManager.update(this.visibleChunks);
    // this.removeUnusedMeshes(this.visibleChunks);
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

  generateNewMeshes(chunksToRender: string[]) {
    if (!chunksToRender) return
    for (const key of chunksToRender) {
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
      },
    };
    this.workerQueue.addRequest(requestData);
  }

  removeUnusedMeshes(
    visibleChunks: THREE.Vector3[] | null
  ) {
    
    if (!visibleChunks) return;
    const queues = [
      ...this.workerQueue.getQueueIds(),
      ...Object.keys(this.meshes),
      ...Object.keys(this.chunksManager.chunks),
      ...Object.keys(this.chunksManager.workerQueue.getQueueIds())
    ];
    const unusedChunks = queues.filter((key) => !visibleChunks.some(
        (chunk) => key === keyFromXYZCoords(chunk.x, chunk.y, chunk.z)
      )
    );

    for (const key of unusedChunks) {
      delete this.chunksManager.chunks[key];
      this.chunksManager.workerQueue.removeRequest(key);
      this.workerQueue.removeRequest(key);
      const mesh = this.meshes[key];
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
        delete this.meshes[key];
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
      mesh.position.set(
        chunkX * this.chunkSize.width - 0.5,
        -0.5,
        chunkZ * this.chunkSize.width - 0.5
      );
      this.add(mesh);
    }
  }
}
