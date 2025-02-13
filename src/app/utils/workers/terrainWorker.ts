import { FractalNoise } from './../classes/FractalNoise';
import { TerrainGenParams } from "../../components/TerrainManager";
import { WorkerPostMessage } from "../classes/WorkerQueue";
import { coordsXYZFromKey, measureTime, RNG } from "../generalUtils";
import * as THREE from 'three';
import { BLOCKS } from '../BlocksData';
import * as SimplexNoise from "simplex-noise";
import { BitArray } from '../classes/BitArray';
import { dirtDepth, getTerrainXYZ, terrainHeight } from '../chunkGenFunctions';
import { arrayBuffer } from 'three/webgpu';

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
    measureTime(() => genVoxelData(e.data), `processChunk ${e.data.request.id}`);
    // genVoxelData(e.data)
  }
  if (e.data.request.type === "genChunkMeshData") {
    measureTime(() => genMeshData(e.data), `processGeometry ${e.data.request.id}`);
    // genMeshData(e.data)
  }
};


function genVoxelData(message: WorkerPostMessage) {
  const workerId = message.workerId
  const { chunkKey, params, diffs } = message.request.data as RequestVoxelData

  const size = params.chunkSize
  const cCoords = coordsXYZFromKey(chunkKey);
  const wCoords = { x: cCoords.x * size, y: cCoords.y * size, z: cCoords.z * size }

  const binaryData = new Uint16Array(size * size)
  const voxelData = new Uint16Array(size * size * size)

  const heightMap = new Uint8Array(size * size)
  const dirtNoiseMap = new Uint8Array(size * size)

  const fractalNoise = new FractalNoise(params.fractalNoise, params.seed);
  const dirtNoise = SimplexNoise.createNoise2D(RNG(params.seed + "dirtLayer"));

  const sampleRate = 4
  const maxDirtDepth = 25

  // 1-6 ms pretty fast, rarely up to 20ms
  if (wCoords.y >= -size) {
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
    
        const heightValueA = terrainHeight({ x: sampleX, z: sampleZ }, heightMap, params, fractalNoise, wCoords);
        const heightValueB = terrainHeight({ x: nextSampleX, z: sampleZ }, heightMap, params, fractalNoise, wCoords);
        const heightValueC = terrainHeight({ x: sampleX, z: nextSampleZ }, heightMap, params, fractalNoise, wCoords);
        const heightValueD = terrainHeight({ x: nextSampleX, z: nextSampleZ }, heightMap, params, fractalNoise, wCoords);
  
        const heightValueX = THREE.MathUtils.lerp(heightValueA, heightValueB, smoothTX);
        const heightValueZ = THREE.MathUtils.lerp(heightValueC, heightValueD, smoothTZ);
        const heightValue = THREE.MathUtils.lerp(heightValueX, heightValueZ, smoothTZ);
        heightMap[x + z * size] = heightValue;
    
        const dirtValueA = dirtDepth({ x: sampleX, z: sampleZ }, maxDirtDepth, dirtNoiseMap, params, dirtNoise, wCoords);
        const dirtValueB = dirtDepth({ x: nextSampleX, z: sampleZ }, maxDirtDepth, dirtNoiseMap, params, dirtNoise, wCoords);
        const dirtValueC = dirtDepth({ x: sampleX, z: nextSampleZ }, maxDirtDepth, dirtNoiseMap, params, dirtNoise, wCoords);
        const dirtValueD = dirtDepth({ x: nextSampleX, z: nextSampleZ }, maxDirtDepth, dirtNoiseMap, params, dirtNoise, wCoords);
  
        const dirtValueX = THREE.MathUtils.lerp(dirtValueA, dirtValueB, smoothTX);
        const dirtValueZ = THREE.MathUtils.lerp(dirtValueC, dirtValueD, smoothTZ);
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
        const blockId = getTerrainXYZ(
          {x: wxCol, y: wy, z: wzCol},
          terrainHeight,
          dirtDepth,
          params
        );
  
        const index = x + z * size + y * size * size;
        voxelData[index] = blockId;
  
        if (blockId !== BLOCKS.air.id) {
          binaryData[z + (y * size)] = binaryData[z + (y * size)] | (1 << x);
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
        binaryDataBuffer: binaryData.buffer,
      },
    },
  };

  self.postMessage(returnData, [voxelData.buffer, binaryData.buffer]);
}

function genMeshData(message: WorkerPostMessage) {
  const workerId = message.workerId
  const { chunkKey, params, voxelDataBuffer } = message.request.data as RequestGeometryData
}