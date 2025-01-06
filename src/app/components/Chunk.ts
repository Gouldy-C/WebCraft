import * as THREE from 'three'
import { ChunkSize } from './TerrainManager'



export class Chunk {
  position: THREE.Vector3
  size: ChunkSize
  resolution: number
  binaryData: Uint32Array

  constructor() {

  }
}