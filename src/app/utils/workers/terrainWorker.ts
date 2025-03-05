import * as THREE from 'three';
import { FractalNoise } from './../classes/FractalNoise';
import { TerrainGenParams } from "../../components/TerrainManager";
import { WorkerPostMessage } from "../classes/WorkerQueue";
import { coordsXYZFromKey, measureTime, normalizeZeroBased, RNG } from "../generalUtils";
import { BLOCKS } from '../BlocksData';
import * as SimplexNoise from "simplex-noise";
import { binaryGreedyMesher, getTerrainXYZ, noise2DBiLerp, terrainHeight } from '../chunkGenFunctions';
import { TerrainMaps } from '../classes/TerrainMaps';

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
    // measureTime(() => genVoxelData(e.data), `processChunk ${e.data.request.id}`);
    genVoxelData(e.data)
  }
  if (e.data.request.type === "genChunkMeshData") {
    // measureTime(() => genMeshData(e.data), `processGeometry ${e.data.request.id}`);
    genMeshData(e.data)
  }
};


function genVoxelData(message: WorkerPostMessage) {
  const workerId = message.workerId
  const { chunkKey, params, diffs } = message.request.data as RequestVoxelData

  const size = params.chunkSize
  const chunkCoords = coordsXYZFromKey(chunkKey);
  const chunkPos = { x: chunkCoords.x * size, y: chunkCoords.y * size, z: chunkCoords.z * size }

  const binaryData = new Uint32Array(size * size * 3)
  const voxelData = new Uint16Array(size * size * size)

  const heightArray = new Uint16Array(size * size)
  const dirtNoiseArray = new Float32Array(size * size)
  const mountainNoiseArray= new Float32Array(size * size)
  const snowNoiseArray = new Float32Array(size * size)
  const sandNoiseArray = new Float32Array(size * size)

  const terrainNoise = measureTime(() => {new TerrainMaps(params)})

  const fractalNoise = new FractalNoise(params.fractalNoise, params.seed);

  const dirtNoise = SimplexNoise.createNoise2D(RNG(params.seed + "dirtLayer"));
  const mountainNoise = SimplexNoise.createNoise2D(RNG(params.seed + "mountainLayer"));
  const snowNoise = SimplexNoise.createNoise2D(RNG(params.seed + "snowLayer"));
  const sandNoise = SimplexNoise.createNoise2D(RNG(params.seed + "sandLayer"));

  const mountainOffset = params.mountainHeight
  const mountainChange = params.surfaceVariance

  const snowOffset = params.snowHeight
  const snowChange = params.surfaceVariance

  const sandChange = params.surfaceVariance * 0.3
  const dirtChange = params.surfaceVariance * 0.70

  const waterLevel = params.seaLevel
  const sampleRate = params.terrainSampleRate


  // 1-6 ms pretty fast, rarely up to 20ms
  if (chunkPos.y >= -size) {
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        // console.log('c', terrainNoise.getContinental(cCoords.x + x, cCoords.z + z))
        // console.log('e', terrainNoise.getErosion(cCoords.x + x, cCoords.z + z))
        // console.log('m', terrainNoise.getMountainous(cCoords.x + x, cCoords.z + z))

        // console.log('t', terrainNoise.getTemperature(cCoords.x + x, cCoords.z + z))
        // console.log('h', terrainNoise.getHumidity(cCoords.x + x, cCoords.z + z))

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
    
        const heightValueA = terrainHeight({ x: sampleX, z: sampleZ }, heightArray, params, fractalNoise, chunkPos);
        const heightValueB = terrainHeight({ x: nextSampleX, z: sampleZ }, heightArray, params, fractalNoise, chunkPos);
        const heightValueC = terrainHeight({ x: sampleX, z: nextSampleZ }, heightArray, params, fractalNoise, chunkPos);
        const heightValueD = terrainHeight({ x: nextSampleX, z: nextSampleZ }, heightArray, params, fractalNoise, chunkPos);
  
        const heightValueX = THREE.MathUtils.lerp(heightValueA, heightValueB, smoothTX);
        const heightValueZ = THREE.MathUtils.lerp(heightValueC, heightValueD, smoothTX);
        const heightValue = THREE.MathUtils.lerp(heightValueX, heightValueZ, smoothTZ);
        heightArray[x + z * size] = heightValue;

        // noise2DBiLerp(params, heightArray, heightNoise , {x, z}, chunkPos, {x: 4000, z: 3000});
        noise2DBiLerp(params, dirtNoiseArray, dirtNoise, {x, z}, chunkPos, {x: 200, z: 200});
        noise2DBiLerp(params, mountainNoiseArray, mountainNoise, {x, z}, chunkPos, {x: 200, z: 200});
        noise2DBiLerp(params, snowNoiseArray, snowNoise, {x, z}, chunkPos, {x: 200, z: 200});
        noise2DBiLerp(params, sandNoiseArray, sandNoise, {x, z}, chunkPos, {x: 200, z: 200});
      }
    }
  }

  let solidExternal = [true, true, true, true, true, true];
  let voxelCount = 0;

  for (let z = 0; z < size; z++) {
    const zOffset = z * size;
    const wz = chunkPos.z + z;
    
    for (let x = 0; x < size; x++) {
      const wx = chunkPos.x + x;
      const mapIndex = x + zOffset;
      let terrainHeight = heightArray[mapIndex]
      const dirtDepth = normalizeZeroBased(dirtNoiseArray[mapIndex], -1, 1) * dirtChange;
      const mountainHeight = normalizeZeroBased(mountainNoiseArray[mapIndex], -1, 1) * mountainChange;
      const snowValue = normalizeZeroBased(snowNoiseArray[mapIndex], -1, 1) * snowChange;
      const sandDepth = normalizeZeroBased(sandNoiseArray[mapIndex], -1, 1) * sandChange;
      
      for (let y = 0; y < size; y++) {
        const wy = chunkPos.y + y;
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