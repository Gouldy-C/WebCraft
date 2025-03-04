import { FractalNoise } from './../classes/FractalNoise';
import { TerrainGenParams } from "../../components/TerrainManager";
import { WorkerPostMessage } from "../classes/WorkerQueue";
import { coordsXYZFromKey, measureTime, RNG } from "../generalUtils";
import * as THREE from 'three';
import { BLOCKS } from '../BlocksData';
import * as SimplexNoise from "simplex-noise";
import { binaryGreedyMesher, culledMesher, getTerrainXYZ, terrainHeight, terrainNoiseValue } from '../chunkGenFunctions';

export interface RequestVoxelData {
  chunkKey: string;
  params: TerrainGenParams;
  diffs: Record<string, { blockId: number }>;
}

export interface RequestGeometryData {
  chunkKey: string;
  params: TerrainGenParams;
  voxelDataBuffer: ArrayBuffer;
  binaryDataBuffer: ArrayBuffer
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

  const binaryData = new Uint32Array(size * size * 3)
  const voxelData = new Uint16Array(size * size * size)

  const heightMap = new Uint16Array(size * size)
  const dirtNoiseMap = new Uint16Array(size * size)
  const mountainNoiseMap = new Uint16Array(size * size)
  const snowNoiseMap = new Uint16Array(size * size)
  const sandNoiseMap = new Uint16Array(size * size)


  const fractalNoise = new FractalNoise(params.fractalNoise, params.seed);
  const detailNoise = new FractalNoise(params.fractalNoise, params.seed + "detail")

  const dirtNoise = SimplexNoise.createNoise2D(RNG(params.seed + "dirtLayer"));
  const mountainNoise = SimplexNoise.createNoise2D(RNG(params.seed + "mountainLayer"));
  const snowNoise = SimplexNoise.createNoise2D(RNG(params.seed + "snowLayer"));
  const sandNoise = SimplexNoise.createNoise2D(RNG(params.seed + "sandLayer"));
  const biomeNoise = SimplexNoise.createNoise2D(RNG(params.seed + "biome"));

  const mountainOffset = params.mountainHeight
  const mountianChange = params.mountainVariance

  const snowOffset = params.snowHeight
  const snowChange = params.snowVariance

  const sandChange = params.sandVariance
  const dirtChange = params.dirtVariance

  const waterLevel = params.seaLevel
  const sampleRate = params.terrainSampleRate


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
        const heightValueZ = THREE.MathUtils.lerp(heightValueC, heightValueD, smoothTX);
        const heightValue = THREE.MathUtils.lerp(heightValueX, heightValueZ, smoothTZ);
        heightMap[x + z * size] = heightValue;
    
        const dirtValueA = terrainNoiseValue({ x: sampleX, z: sampleZ }, dirtChange, dirtNoiseMap, params, dirtNoise, wCoords);
        const dirtValueB = terrainNoiseValue({ x: nextSampleX, z: sampleZ }, dirtChange, dirtNoiseMap, params, dirtNoise, wCoords);
        const dirtValueC = terrainNoiseValue({ x: sampleX, z: nextSampleZ }, dirtChange, dirtNoiseMap, params, dirtNoise, wCoords);
        const dirtValueD = terrainNoiseValue({ x: nextSampleX, z: nextSampleZ }, dirtChange, dirtNoiseMap, params, dirtNoise, wCoords);
  
        const dirtValueX = THREE.MathUtils.lerp(dirtValueA, dirtValueB, smoothTX);
        const dirtValueZ = THREE.MathUtils.lerp(dirtValueC, dirtValueD, smoothTX);
        const dirtValue = THREE.MathUtils.lerp(dirtValueX, dirtValueZ, smoothTZ);
        dirtNoiseMap[x + z * size] = dirtValue;

        const mountValueA = terrainNoiseValue({ x: sampleX, z: sampleZ }, mountianChange, mountainNoiseMap, params, mountainNoise, wCoords);
        const mountValueB = terrainNoiseValue({ x: nextSampleX, z: sampleZ }, mountianChange, mountainNoiseMap, params, mountainNoise, wCoords);
        const mountValueC = terrainNoiseValue({ x: sampleX, z: nextSampleZ }, mountianChange, mountainNoiseMap, params, mountainNoise, wCoords);
        const mountValueD = terrainNoiseValue({ x: nextSampleX, z: nextSampleZ }, mountianChange, mountainNoiseMap, params, mountainNoise, wCoords);
  
        const mountValueX = THREE.MathUtils.lerp(mountValueA, mountValueB, smoothTX);
        const mountValueZ = THREE.MathUtils.lerp(mountValueC, mountValueD, smoothTX);
        const mountValue = THREE.MathUtils.lerp(mountValueX, mountValueZ, smoothTZ);
        mountainNoiseMap[x + z * size] = mountValue;

        const snowValueA = terrainNoiseValue({ x: sampleX, z: sampleZ }, snowChange, snowNoiseMap, params, snowNoise, wCoords);
        const snowValueB = terrainNoiseValue({ x: nextSampleX, z: sampleZ }, snowChange, snowNoiseMap, params, snowNoise, wCoords);
        const snowValueC = terrainNoiseValue({ x: sampleX, z: nextSampleZ }, snowChange, snowNoiseMap, params, snowNoise, wCoords);
        const snowValueD = terrainNoiseValue({ x: nextSampleX, z: nextSampleZ }, snowChange, snowNoiseMap, params, snowNoise, wCoords);
  
        const snowValueX = THREE.MathUtils.lerp(snowValueA, snowValueB, smoothTX);
        const snowValueZ = THREE.MathUtils.lerp(snowValueC, snowValueD, smoothTX);
        const snowValue = THREE.MathUtils.lerp(snowValueX, snowValueZ, smoothTZ);
        snowNoiseMap[x + z * size] = snowValue;

        const sandValueA = terrainNoiseValue({ x: sampleX, z: sampleZ }, sandChange, sandNoiseMap, params, sandNoise, wCoords);
        const sandValueB = terrainNoiseValue({ x: nextSampleX, z: sampleZ }, sandChange, sandNoiseMap, params, sandNoise, wCoords);
        const sandValueC = terrainNoiseValue({ x: sampleX, z: nextSampleZ }, sandChange, sandNoiseMap, params, sandNoise, wCoords);
        const sandValueD = terrainNoiseValue({ x: nextSampleX, z: nextSampleZ }, sandChange, sandNoiseMap, params, sandNoise, wCoords);
  
        const sandValueX = THREE.MathUtils.lerp(sandValueA, sandValueB, smoothTX);
        const sandValueZ = THREE.MathUtils.lerp(sandValueC, sandValueD, smoothTX);
        const sandValue = THREE.MathUtils.lerp(sandValueX, sandValueZ, smoothTZ);
        sandNoiseMap[x + z * size] = sandValue;
      }
    }
  }

  let solidExternal = [true, true, true, true, true, true];
  let voxelCount = 0;

  for (let z = 0; z < size; z++) {
    const zOffset = z * size;
    const wz = wCoords.z + z;
    
    for (let x = 0; x < size; x++) {
      const wx = wCoords.x + x;
      const mapIndex = x + zOffset;
      let terrainHeight = heightMap[mapIndex];
      const dirtDepth = dirtNoiseMap[mapIndex];
      const mountainHeight = mountainNoiseMap[mapIndex];
      const snowValue = snowNoiseMap[mapIndex];
      const sandDepth = sandNoiseMap[mapIndex];
      
      for (let y = 0; y < size; y++) {
        const wy = wCoords.y + y;
        const blockId = getTerrainXYZ(
          {x: wx, y: wy, z: wz},
          terrainHeight,
          dirtDepth,
          mountainHeight + mountainOffset,
          snowValue + snowOffset,
          sandDepth,
          waterLevel,
        );
        
        // todo: add resorces generation

        // todo: add tree spawns
        
        // todo: add support for block chnages by players via the diffs map

        const index = x + (y * size) + (z * size * size);
        voxelData[index] = blockId;
  
        if (blockId !== BLOCKS.air.id) {
          voxelCount++;
          binaryData[z + (y * size) + (size * size * 0)] |= 1 << x;
          binaryData[x + (z * size) + (size * size * 1)] |= 1 << y;
          binaryData[x + (y * size) + (size * size * 2)] |= 1 << z;
        } else {
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
      type: 'genChunkVoxelData',
      data: {
        chunkKey,
        solidExternal,
        voxelCount,
        voxelDataBuffer: voxelData.buffer,
        binaryDataBuffer: binaryData.buffer,
      },
      buffers: [voxelData.buffer, binaryData.buffer]
    },
  };

  self.postMessage(returnData, [voxelData.buffer, binaryData.buffer]);
}

function genMeshData(message: WorkerPostMessage) {
  const workerId = message.workerId
  const { chunkKey, params, voxelDataBuffer, binaryDataBuffer } = message.request.data as RequestGeometryData

  const size = params.chunkSize
  const voxelData = new Uint16Array(voxelDataBuffer)
  const binaryData = new Uint32Array(binaryDataBuffer)

  let vertices = binaryGreedyMesher(voxelData, binaryData, size)
  // let vertices = culledMesher(voxelData, binaryData, size)

  const verticesBuffer = new Float32Array(vertices).buffer

  const returnData: WorkerPostMessage = {
    id: message.id,
    workerId,
    request: {
      id: message.id,
      type: 'genChunkMeshData',
      data: {
        chunkKey,
        verticesBuffer,
      },
      buffers: [verticesBuffer]
    },
  };

  self.postMessage(returnData, [verticesBuffer]);
}