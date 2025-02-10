import { FractalNoise } from './../classes/FractalNoise';
import { TerrainGenParams } from "../../components/TerrainManager";
import { WorkerPostMessage } from "../classes/WorkerQueue";
import { coordsXYZFromKey, measureTime, RNG } from "../generalUtils";
import * as THREE from 'three';
import { BLOCKS } from '../BlocksData';
import * as SimplexNoise from "simplex-noise";
import { BitArray } from '../classes/BitArray';
import { checkForDirtHeight, checkForHeight, generateResources, getTerrainXYZ } from '../chunkGenFunctions';

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

  const sampleRate = 7

  const fractalNoise = new FractalNoise(params.fractalNoise, params.seed);
  const resources = generateResources(params);
  const dirtNoise = SimplexNoise.createNoise2D(RNG(params.seed + "dirt"));
  const maxDirtDepth = 30

  // 1-5 ms pretty fast
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const sampleX = (Math.floor(x / sampleRate) * sampleRate) + wCoords.x;
      const sampleZ = (Math.floor(z / sampleRate) * sampleRate) + wCoords.z;
      const posX = x + wCoords.x;
      const posZ = z + wCoords.z;
      const heightValueA = checkForHeight({x: sampleX, z: sampleZ}, heightMap, params, fractalNoise);
      const heightValueB = checkForHeight({x: sampleX + sampleRate, z: sampleZ}, heightMap, params, fractalNoise);
      const heightValueC = checkForHeight({x: sampleX, z: sampleZ + sampleRate}, heightMap, params, fractalNoise);
      const heightValueD = checkForHeight({x: sampleX + sampleRate, z: sampleZ + sampleRate}, heightMap, params, fractalNoise);
      const heightValueX = THREE.MathUtils.lerp(heightValueA, heightValueB, (posX - sampleX) / sampleRate);
      const heightValueZ = THREE.MathUtils.lerp(heightValueC, heightValueD, (posZ - sampleZ) / sampleRate);
      const heightValue = THREE.MathUtils.lerp(heightValueX, heightValueZ, (posZ - sampleZ) / sampleRate);
      heightMap[x + (z * size)] = heightValue

      const dirtValueA = checkForDirtHeight({x: sampleX, z: sampleZ}, maxDirtDepth, dirtNoiseMap, params, dirtNoise);
      const dirtValueB = checkForDirtHeight({x: sampleX + sampleRate, z: sampleZ}, maxDirtDepth, dirtNoiseMap, params, dirtNoise);
      const dirtValueC = checkForDirtHeight({x: sampleX, z: sampleZ + sampleRate}, maxDirtDepth, dirtNoiseMap, params, dirtNoise);
      const dirtValueD = checkForDirtHeight({x: sampleX + sampleRate, z: sampleZ + sampleRate}, maxDirtDepth, dirtNoiseMap, params, dirtNoise);
      const dirtValueX = THREE.MathUtils.lerp(dirtValueA, dirtValueB, (posX - sampleX) / sampleRate);
      const dirtValueZ = THREE.MathUtils.lerp(dirtValueC, dirtValueD, (posZ - sampleZ) / sampleRate);
      const dirtValue = THREE.MathUtils.lerp(dirtValueX, dirtValueZ, (posZ - sampleZ) / sampleRate);

      dirtNoiseMap[x + z * size] = dirtValue
    }
  }

  let solidExternal = [true, true, true, true, true, true];
  for (let y = 0; y < size; y++) {
    for (let z = 0; z < size; z++) {
      const bitArray = new BitArray(size);
      for (let x = 0; x < size; x++) {
        const pos = {x: x + wCoords.x, y: y + wCoords.y, z: z + wCoords.z};
        // todo: Add the diffs query and change block id here
        const terrainHeight = heightMap[x + (z * size)];
        const dirtDepth = dirtNoiseMap[x + (z * size)];
        const blockId = getTerrainXYZ(pos, terrainHeight, resources, dirtDepth);
        if (blockId !== BLOCKS.air.id) bitArray.setBit(x)
        voxelData[x + (z * size) + (y * size * size)] = blockId;
        if (x === size - 1 && blockId !== BLOCKS.air.id) solidExternal[0] = false;
        if (x === 0 && blockId !== BLOCKS.air.id) solidExternal[1] = false;
        if (y === size - 1 && blockId !== BLOCKS.air.id) solidExternal[2] = false;
        if (y === 0 && blockId !== BLOCKS.air.id) solidExternal[3] = false;
        if (z === size - 1 && blockId !== BLOCKS.air.id) solidExternal[4] = false;
        if (z === 0 && blockId !== BLOCKS.air.id) solidExternal[5] = false;
      }
      binaryData.push(bitArray);
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