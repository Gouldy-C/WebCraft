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
  voxelCount: number = 0
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
  bufferGeometry: THREE.BufferGeometry | null = null




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
      this.voxelCount--
      this.binaryData[z + (y * this.size) + (this.size * this.size * 0)] &= ((~(1 << x)) >>> 0);
      this.binaryData[x + (y * this.size) + (this.size * this.size * 1)] &= ((~(1 << z)) >>> 0);
      this.binaryData[x + (z * this.size) + (this.size * this.size * 2)] &= ((~(1 << y)) >>> 0);
    } else {
      this.voxelCount++
      this.binaryData[z + (y * this.size) + (this.size * this.size * 0)] |= ((1 << x) >>> 0);
      this.binaryData[x + (y * this.size) + (this.size * this.size * 1)] |= ((1 << z) >>> 0);
      this.binaryData[x + (z * this.size) + (this.size * this.size * 2)] |= ((1 << y) >>> 0);
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
    this.voxelCount = 0
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
      this.voxelCount = data.voxelCount
      if (data.voxelCount > 0)this.generateMesh();
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
    const verticesData = new Float32Array(verticesBuffer);
    const bufferAttribute = new THREE.BufferAttribute(verticesData, 3)
    if (!this.bufferGeometry) {
      this.bufferGeometry = new THREE.BufferGeometry();
    }
    this.bufferGeometry.setAttribute('position', bufferAttribute)
    this.bufferGeometry.computeBoundingBox();

    if (!this.mesh) {
      this.mesh = new THREE.Mesh(this.bufferGeometry, this.terrainManager.shaderMaterial)
      this.terrainManager.add(this.mesh)
    }

    this.mesh.position.set(this.worldPosition.x, this.worldPosition.y, this.worldPosition.z)
    this.mesh.geometry.setAttribute('position', bufferAttribute)
    this.mesh.geometry.computeBoundingSphere()
    this.mesh.geometry.computeBoundingBox()
  }


  private _disposeMesh() {
    if (!this.mesh) return
    this.terrainManager.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.bufferGeometry?.dispose();
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