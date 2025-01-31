import * as THREE from 'three'
import { BitArray } from '../utils/classes/BitArray'
import { TerrainGenParams, TerrainManager } from './TerrainManager'
import { World } from './World'
import { WorkerObj } from '../utils/classes/WorkerQueue'
import { indexFromXYZCoords } from '../utils/generalUtils'

export interface ChunkParams {
  id: string
  position: THREE.Vector3
  lod: number
}

export class Chunk {
  // Params
  id: string
  position: THREE.Vector3
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

  constructor(terrainManager: TerrainManager, params: ChunkParams) {
    this.terrainManager = terrainManager
    this.world = terrainManager.world

    this.id = params.id
    this.position = params.position
    this.terrainGenParams = this.terrainManager.params
    this.size = this.terrainGenParams.chunkSize
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
    this.position = new THREE.Vector3(0, 0, 0)
    this.id = ""
  }

  reuseChunk(params: ChunkParams) {
    this.id = params.id
    this.position = params.position
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
      this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.terrainManager.material)
      this.mesh.position.set(this.position.x, this.position.y, this.position.z)
      this.terrainManager.add(this.mesh)
    }
    const meshData = new Uint32Array(meshDataBuffer);
    const bufferAttribute = new THREE.BufferAttribute(meshData, 2)
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