import * as THREE from 'three'
import { TerrainGenParams, TerrainManager } from './TerrainManager'
import { World } from './World'
import { WorkerObj } from '../utils/classes/WorkerQueue'
import { coordsXYZFromKey, indexFromXYZCoords } from '../utils/generalUtils'



export class Chunk {
  // Params
  id: string
  chunkCoords: { x: number; y: number; z: number }
  worldPosition: { x: number; y: number; z: number }
  size: number
  terrainGenParams: TerrainGenParams
  // lod: number

  // Refs
  terrainManager: TerrainManager
  world: World

  // Flags
  needsUpdate: boolean = false
  
  // Data
  binaryData: Uint32Array
  blockData: Uint16Array
  mesh: THREE.Mesh | null = null

  // vertexData(x): 9 unused bits | 2 uv | 3 normal | 6 z | 6 y | 6 x
  // (0 << 21) | (this.normal << 18) | (0 << 12)| (0 << 6) | 0
  // blockData(y):  21 unused bits | 11 block id
  // blockData(z):  unused

  constructor(terrainManager: TerrainManager, id: string) {
    this.terrainManager = terrainManager
    this.world = terrainManager.world

    this.id = id
    this.chunkCoords = coordsXYZFromKey(this.id)
    this.terrainGenParams = this.terrainManager.params
    this.size = this.terrainGenParams.chunkSize
    this.worldPosition = { 
      x: this.chunkCoords.x * this.size,
      y: this.chunkCoords.y * this.size,
      z: this.chunkCoords.z * this.size
    }
    // this.lod = params.lod

    this.binaryData = new Uint32Array(this.size * this.size * 3)
    this.blockData = new Uint16Array(this.size * this.size * this.size)

    this._generateVoxelData()
  }

  getVoxel(x: number, y: number, z: number) {
    return this.blockData[indexFromXYZCoords(x, y, z, this.size)]
  }

  setVoxel(x: number, y: number, z: number, value: number) {
    const index = indexFromXYZCoords(x, y, z, this.size)
    this.blockData[index] = value

    if (value === 0){
      this.binaryData[z + (y * this.size)] = this.binaryData[z + (y * this.size)] & ~(1 << x);
      this.binaryData[x + (y * this.size) + (this.size * this.size)] = this.binaryData[x + (y * this.size) + (this.size * this.size)] & ~(1 << z);
      this.binaryData[x + (z * this.size) + (this.size * this.size * 2)] = this.binaryData[x + (z * this.size) + (this.size * this.size * 2)] & ~(1 << y);
    } else {
      this.binaryData[z + (y * this.size)] = this.binaryData[z + (y * this.size)] | (1 << x);
      this.binaryData[x + (y * this.size) + (this.size * this.size)] = this.binaryData[x + (y * this.size) + (this.size * this.size)] | (1 << z);
      this.binaryData[x + (z * this.size) + (this.size * this.size * 2)] = this.binaryData[x + (z * this.size) + (this.size * this.size * 2)] | (1 << y);
    }

    this.generateMesh()
  }

  clear() {
    this._disposeMesh()
    this.binaryData = new Uint32Array(this.size * this.size * 3)
    this.blockData = new Uint16Array(this.size * this.size * this.size)
    this.chunkCoords = { x: 0, y: 0, z: 0 }
    this.worldPosition = { x: 0, y: 0, z: 0 }
    this.id = ""
  }

  reuseChunk(terrainManager: TerrainManager, id: string) {
    this.terrainManager = terrainManager
    this.world = terrainManager.world

    this.id = id
    this.chunkCoords = coordsXYZFromKey(this.id)
    this.terrainGenParams = this.terrainManager.params
    this.size = this.terrainGenParams.chunkSize
    this.worldPosition = { 
      x: this.chunkCoords.x * this.size,
      y: this.chunkCoords.y * this.size,
      z: this.chunkCoords.z * this.size
    }
    // this.lod = params.lod

    this.binaryData = new Uint32Array(this.size * this.size * 3)
    this.blockData = new Uint16Array(this.size * this.size * this.size)

    this._generateVoxelData()
  }

  handleWorkerMessage(obj: WorkerObj) {
    const { type, data } = obj;
    if (type === "genChunkVoxelData") {
      this.blockData = new Uint16Array(data.voxelDataBuffer);
      this.binaryData = new Uint32Array(data.binaryDataBuffer)
      this.generateMesh();
    }
    if (type === "genChunkMeshData") {
      this._processMeshData(data.verticesBuffer);
    }
  }

  private _generateVoxelData() {
    const diffs = this.world.worldStore.get(["diffs"]);
    const requestData: WorkerObj = {
      id: this.id,
      type: "genChunkVoxelData",
      data: {
        chunkKey: this.id,
        params: this.terrainGenParams,
        diffs: diffs,
      },
      buffers: []
    };
    this.terrainManager.workerQueue.addRequest(requestData);
  }

  generateMesh() {
    const requestData: WorkerObj = {
      id: this.id,
      type: "genChunkMeshData",
      data: {
        chunkKey: this.id,
        params: this.terrainGenParams,
        voxelDataBuffer: this.blockData.buffer,
        binaryDataBuffer: this.binaryData.buffer,
      },
      buffers: [this.blockData.buffer, this.binaryData.buffer]
    };
    this.terrainManager.workerQueue.addPriorityRequest(requestData);
  }

  private _processMeshData(verticesBuffer: ArrayBuffer) {
    if (!this.mesh) {
      this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.terrainManager.shaderMaterial)
      this.terrainManager.add(this.mesh)
    }

    const verticesData = new Float32Array(verticesBuffer);
    const bufferAttribute = new THREE.BufferAttribute(verticesData, 3)

    this.mesh.position.set(this.worldPosition.x, this.worldPosition.y, this.worldPosition.z)
    this.mesh.geometry.setAttribute('position', bufferAttribute)
    this.mesh.geometry.computeBoundingSphere()
  }


  private _disposeMesh() {
    if (!this.mesh) return
    this.terrainManager.remove(this.mesh);
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((material) => {
        material.dispose();
      });
    } else {
      this.mesh.material.dispose();
    }
    this.mesh = null
  }
}