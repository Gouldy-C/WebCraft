import { FractalNoise } from './../classes/FractalNoise';
import { TerrainGenParams } from "../../components/TerrainManager";
import { FractalNoise } from "../classes/FractalNoise";
import { WorkerPostMessage } from "../classes/WorkerQueue";
import { clamp, coordsXYZFromKey, keyFromXZCoords, measureTime } from "../generalUtils";
import * as THREE from 'three';

export interface RequestVoxelData {
  chunkKey: string;
  params: TerrainGenParams;
  diffs: Record<string, { blockId: number }>;
}

export interface RequestGeometryData {
  chunkKey: string;
  params: TerrainGenParams;
  voxelDataBuffer: ArrayBuffer;
  currentChunk: { x: number; y: number; z: number };
}

self.onmessage = (e: MessageEvent) => {
  if (e.data.request.type === "genChunkVoxelData") {
    measureTime(() => genVoxelData(e.data), "processChunk");
  }
  if (e.data.request.type === "genChunkMeshData") {
    measureTime(() => genMeshData(e.data), "processGeometry");
  }
};


function genVoxelData(message: WorkerPostMessage) {
  const workerId = message.workerId
  const { chunkKey, params, diffs } = message.request.data as RequestVoxelData
  const size = params.chunkSize
  const cCoords = coordsXYZFromKey(chunkKey);
  const wCoords = { x: cCoords.x * size, y: cCoords.y * size, z: cCoords.z * size }
  const binaryData = []
  const voxelData = []
  const heightMap = new Uint8Array(size * size)
  const sampleRate = 7

  const fractalNoise = new FractalNoise(params.fractalNoise, params.seed);
  const resources = generateResources(params);

  // 1-2 ms pretty fast
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const height = params.maxWorldHeight;
      const sampleX = Math.floor(x / sampleRate) * sampleRate;
      const sampleZ = Math.floor(z / sampleRate) * sampleRate;
      const heightValueA = checkForHeight(heightMap, params, fractalNoise, {x: sampleX, z: sampleZ});
      const heightValueB = checkForHeight(heightMap, params, fractalNoise, {x: sampleX + sampleRate, z: sampleZ});
      const heightValueC = checkForHeight(heightMap, params, fractalNoise, {x: sampleX, z: sampleZ + sampleRate});
      const heightValueD = checkForHeight(heightMap, params, fractalNoise, {x: sampleX + sampleRate, z: sampleZ + sampleRate});
      const heightValueX = THREE.MathUtils.lerp(heightValueA, heightValueB, (x - sampleX) / sampleRate);
      const heightValueZ = THREE.MathUtils.lerp(heightValueC, heightValueD, (z - sampleZ) / sampleRate);
      const heightValue = THREE.MathUtils.lerp(heightValueX, heightValueZ, (z - sampleZ) / sampleRate);
      heightMap[x + (z * size)] = heightValue
    }
  }

}

function genMeshData(message: WorkerPostMessage) {
  const workerId = message.workerId
  const { chunkKey, params, voxelDataBuffer } = message.request.data as RequestGeometryData
}




function checkForHeight(heightMap: Uint8Array, params: TerrainGenParams, fractalNoise: FractalNoise, pos: { x: number; z: number }) {
  const value = heightMap[pos.x + (pos.z * params.chunkSize)]
  if (value === 0) {
    const noiseValue = fractalNoise.fractal2D(pos.x, pos.z)
    const heightValue = (noiseValue + 1) / 2
    const blockHeight = Math.floor(heightValue * params.maxWorldHeight - 1)
    heightMap[pos.x + (pos.z * params.chunkSize)] = blockHeight
    return blockHeight
  }
  return value
}