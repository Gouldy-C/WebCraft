import * as THREE from 'three'
import { BitArray } from '../utils/classes/BitArray'
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
  binaryData: BitArray[]
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

    this.binaryData = []
    this.blockData = new Uint16Array(this.size * this.size * this.size)

    this._generateVoxelData()
  }

  getVoxel(x: number, y: number, z: number) {
    return this.blockData[indexFromXYZCoords(x, y, z, this.size)]
  }

  setVoxel(x: number, y: number, z: number, value: number) {
    const index = indexFromXYZCoords(x, y, z, this.size)
    this.blockData[index] = value
    const bitArrayIndex = z + y * this.size

    if (value === 0) this.binaryData[bitArrayIndex].clearBit(x)
    else this.binaryData[bitArrayIndex].setBit(x)

    this.generateMesh()
  }

  clear() {
    this._disposeMesh()
    this.binaryData = []
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

    this.binaryData = []
    this.blockData = new Uint16Array(this.size * this.size * this.size)

    this._generateVoxelData()
  }

  handleWorkerMessage(obj: WorkerObj) {
    const { type, data } = obj;
    if (type === "genChunkVoxelData") {
      this.blockData = new Uint16Array(data.voxelDataBuffer);
      this.binaryData = BitArray.fromBuffer(data.binaryDataBuffer, this.size);
      this.generateMesh();
    }
    if (type === "genChunkMeshData") {
      this._processMeshData(data.meshDataBuffer);
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
        binaryDataBuffer: BitArray.getBufferFromBitArrays(this.binaryData),
      },
    };
    this.terrainManager.workerQueue.addPriorityRequest(requestData);
  }

  private _processMeshData(meshDataBuffer: ArrayBuffer) {
    if (!this.mesh) {
      this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.terrainManager.shaderMaterial)
      this.terrainManager.add(this.mesh)
    }
    const meshData = new Uint32Array(meshDataBuffer);
    const bufferAttribute = new THREE.BufferAttribute(meshData, 2)
    this.mesh.position.set(this.worldPosition.x, this.worldPosition.y, this.worldPosition.z)
    this.mesh.geometry.setAttribute('voxleVertexData', bufferAttribute)
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