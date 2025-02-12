import { FractalNoise } from './../classes/FractalNoise';
import { TerrainGenParams } from "../../components/TerrainManager";
import { WorkerPostMessage } from "../classes/WorkerQueue";
import { coordsXYZFromKey, measureTime, RNG } from "../generalUtils";
import * as THREE from 'three';
import { BLOCKS } from '../BlocksData';
import * as SimplexNoise from "simplex-noise";
import { BitArray } from '../classes/BitArray';
import { dirtDepth, getTerrainXYZ, terrainHeight } from '../chunkGenFunctions';

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

  const binaryData: BitArray[] = []
  const voxelData = new Uint16Array(size * size * size)

  const heightMap = new Uint8Array(size * size)
  const dirtNoiseMap = new Uint8Array(size * size)

  const fractalNoise = new FractalNoise(params.fractalNoise, params.seed);
  const dirtNoise = SimplexNoise.createNoise2D(RNG(params.seed + "dirtLayer"));

  const sampleRate = 8
  const maxDirtDepth = 25

  for (let i = 0; i <= size * size; i++) {
    binaryData.push(new BitArray(size))
  }

  // 1-4 ms pretty fast
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const sampleX = Math.floor(x / sampleRate) * sampleRate;
      const sampleZ = Math.floor(z / sampleRate) * sampleRate;
  
      const nextSampleX = Math.min(sampleX + sampleRate, size - 1);
      const nextSampleZ = Math.min(sampleZ + sampleRate, size - 1);
  
      const intervalX = nextSampleX - sampleX;
      const intervalZ = nextSampleZ - sampleZ;
      const tX = intervalX === 0 ? 0 : (x - sampleX) / intervalX;
      const tZ = intervalZ === 0 ? 0 : (z - sampleZ) / intervalZ;
  
      const smoothTX = THREE.MathUtils.smootherstep(tX, 0, 1);
      const smoothTZ = THREE.MathUtils.smootherstep(tZ, 0, 1);
  
      if (wCoords.y >= 0) {
        const heightValueA = terrainHeight({ x: sampleX, z: sampleZ }, heightMap, params, fractalNoise);
        const heightValueB = terrainHeight({ x: nextSampleX, z: sampleZ }, heightMap, params, fractalNoise);
        const heightValueC = terrainHeight({ x: sampleX, z: nextSampleZ }, heightMap, params, fractalNoise);
        const heightValueD = terrainHeight({ x: nextSampleX, z: nextSampleZ }, heightMap, params, fractalNoise);
  
        const heightValueX = THREE.MathUtils.lerp(heightValueA, heightValueB, smoothTX);
        const heightValueZ = THREE.MathUtils.lerp(heightValueC, heightValueD, smoothTX);
        const heightValue = THREE.MathUtils.lerp(heightValueX, heightValueZ, smoothTZ);
        heightMap[x + z * size] = heightValue;
      }
  
      if (wCoords.y >= -size) {
        const dirtValueA = dirtDepth({ x: sampleX, z: sampleZ }, maxDirtDepth, dirtNoiseMap, params, dirtNoise);
        const dirtValueB = dirtDepth({ x: nextSampleX, z: sampleZ }, maxDirtDepth, dirtNoiseMap, params, dirtNoise);
        const dirtValueC = dirtDepth({ x: sampleX, z: nextSampleZ }, maxDirtDepth, dirtNoiseMap, params, dirtNoise);
        const dirtValueD = dirtDepth({ x: nextSampleX, z: nextSampleZ }, maxDirtDepth, dirtNoiseMap, params, dirtNoise);
  
        const dirtValueX = THREE.MathUtils.lerp(dirtValueA, dirtValueB, smoothTX);
        const dirtValueZ = THREE.MathUtils.lerp(dirtValueC, dirtValueD, smoothTX);
        const dirtValue = THREE.MathUtils.lerp(dirtValueX, dirtValueZ, smoothTZ);
        dirtNoiseMap[x + z * size] = dirtValue;
      }
    }
  }

  let solidExternal = [true, true, true, true, true, true];
  for (let z = 0; z < size; z++) {
    const zOffset = z * size;
    const wzCol = wCoords.z + z;
    
    for (let x = 0; x < size; x++) {
      const wxCol = wCoords.x + x;
      const mapIndex = x + zOffset;
      const terrainHeight = heightMap[mapIndex];
      const dirtDepth = dirtNoiseMap[mapIndex];
      
      for (let y = 0; y < size; y++) {
        const wy = wCoords.y + y;
        const bitArray = binaryData[z + (y * size)]
        const blockId = getTerrainXYZ(
          {x: wxCol, y: wy, z: wzCol},
          terrainHeight,
          dirtDepth,
          params
        );
  
        const index = x + z * size + y * size * size;
        voxelData[index] = blockId;
  
        if (blockId !== BLOCKS.air.id) {
          bitArray.setBit(x);
          if (x === size - 1) solidExternal[0] = false;
          if (x === 0) solidExternal[1] = false;
          if (y === size - 1) solidExternal[2] = false;
          if (y === 0) solidExternal[3] = false;
          if (z === size - 1) solidExternal[4] = false;
          if (z === 0) solidExternal[5] = false;
        }
      }
    }
  }

  const binaryDataBuffer = BitArray.getBufferFromBitArrays(binaryData)

  const returnData: WorkerPostMessage = {
    id: message.id,
    workerId,
    request: {
      id: message.id,
      type: 'voxelData',
      data: {
        chunkKey,
        solidExternal,
        voxelDataBuffer: voxelData.buffer,
        binaryDataBuffer: binaryDataBuffer
      },
    },
  };

  self.postMessage(returnData, [voxelData.buffer, binaryDataBuffer]);
}

function genMeshData(message: WorkerPostMessage) {
  const workerId = message.workerId
  const { chunkKey, params, voxelDataBuffer } = message.request.data as RequestGeometryData
}