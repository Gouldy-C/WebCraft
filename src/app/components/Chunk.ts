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

  bufferGeometry: THREE.BufferGeometry = new THREE.BufferGeometry()

  geometryId: number = -1
  instanceId: number = -1


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
    this.bufferGeometry?.dispose()
    this.bufferGeometry = new THREE.BufferGeometry()
    if (this.instanceId !== -1){
      this.terrainManager.batchedMesh.deleteInstance(this.instanceId)
      this.instanceId = -1
    }
    if (this.geometryId !== -1){
      this.terrainManager.batchedMesh.deleteGeometry(this.geometryId)
      this.geometryId = -1
      console.log(this.terrainManager.batchedMesh)
    }
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
      this._processMeshData(data.verticesBuffer, data.indicesBuffer, data.voxelInfoBuffer);
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

  private _processMeshData(verticesBuffer: ArrayBuffer, indicesBuffer: ArrayBuffer, voxelInfoBuffer: ArrayBuffer) {
    const verticesData = new Float32Array(verticesBuffer);
    const indicesData = new Uint32Array(indicesBuffer);
    const voxelInfoData = new Uint32Array(voxelInfoBuffer);

    const verticesBA = new THREE.BufferAttribute(verticesData, 3)
    const voxelInfoBA = new THREE.BufferAttribute(voxelInfoData, 2)

    this.bufferGeometry.setAttribute('position', verticesBA)
    this.bufferGeometry.setAttribute('voxel', voxelInfoBA)
    this.bufferGeometry.setIndex(new THREE.Uint32BufferAttribute(indicesData, 1))
    this.bufferGeometry.translate(this.worldPosition.x, this.worldPosition.y, this.worldPosition.z)
    
    if (verticesData.length <= 111) return
    this.geometryId = this.terrainManager.batchedMesh.addGeometry(this.bufferGeometry)
    this.instanceId = this.terrainManager.batchedMesh.addInstance(this.geometryId)
    this.terrainManager.batchedMesh.computeBoundingBox()
    this.terrainManager.batchedMesh.computeBoundingSphere()
  }
}