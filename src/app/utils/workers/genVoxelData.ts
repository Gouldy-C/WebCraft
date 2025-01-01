import { BLOCKS } from "../BlocksData";
import { TerrainGenParams } from "../../components/unused/Terrain";
import {
  applyChunkDiffs,
} from "../chunkGenFunctions";
import { coordsXYZFromKey, indexFromXYZCoords, measureTime } from "../helpers";
import { WorkerPostMessage } from "../WorkerQueue";
import { BlockGenXYZ } from "../BlockGenXYZ";


export interface ReturnVoxelData {
  chunkKey: string;
  voxelDataBuffer: ArrayBuffer;
}

export interface ReturnGeometryData {
  chunkKey: string;
  positionsBuffer: ArrayBuffer;
  normalsBuffer: ArrayBuffer;
  uvsBuffer: ArrayBuffer;
  indicesBuffer: ArrayBuffer;
}

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


const VoxelFaces = [
  {
    // left
    uvRow: 0,
    dir: [-1, 0, 0],
    corners: [
      [0, 1, 0],
      [0, 0, 0],
      [0, 1, 1],
      [0, 0, 1],
    ],
  },
  {
    // right
    uvRow: 0,
    dir: [1, 0, 0],
    corners: [
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
      [1, 0, 0],
    ],
  },
  {
    // bottom
    uvRow: 1,
    dir: [0, -1, 0],
    corners: [
      [1, 0, 1],
      [0, 0, 1],
      [1, 0, 0],
      [0, 0, 0],
    ],
  },
  {
    // top
    uvRow: 2,
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [0, 1, 0],
      [1, 1, 0],
    ],
  },
  {
    // back
    uvRow: 0,
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  {
    // front
    uvRow: 0,
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
    ],
  },
];

self.onmessage = (e: MessageEvent) => {
  if (e.data.request.type === "generateChunkVoxelData") {
    measureTime(() => processChunkData(e.data), "processChunk");
  }
  if (e.data.request.type === "generateChunkMesh") {
    measureTime(() => processGeometryData(e.data), "processGeometry");
  }
};

function processChunkData(message: WorkerPostMessage) {

  const workerId = message.workerId;
  const data = message.request.data as RequestVoxelData;
  const { chunkKey, params, diffs } = data
  const blockGenXYZ = new BlockGenXYZ(params);
  const { x: chunkX, z: chunkZ } = coordsXYZFromKey(chunkKey);
  const size = params.chunkSize;
  const { width, height } = size;
  const voxelData = new Uint16Array(width * height * width).fill(0);
  const gx = chunkX * width;
  const gz = chunkZ * width

  for (let z = 0; z < width; z++) {
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const i = indexFromXYZCoords(x, y, z, size);
        if (voxelData[i] !== 0) continue
        const voxels: number | null = blockGenXYZ.getBlockIdXYZ(x + gx, y, z + gz);
        if (!voxels) continue
        voxelData[i] = voxels;
      }
    }
  }

  // generateTrees(chunkX, chunkZ, params, voxelData)
  // applyChunkDiffs(chunkX, chunkZ, diffs, voxelData, size)

  const returnData: WorkerPostMessage = {
    id: message.id,
    workerId, 
    request: {
      data: { 
        chunkKey,
        voxelDataBuffer: voxelData.buffer
      }
    }
  }

  self.postMessage(returnData, [voxelData.buffer]);
}


function processGeometryData(message: WorkerPostMessage) {
  const workerId = message.workerId;
  const data = message.request.data as RequestGeometryData;
  const { chunkKey, params, voxelDataBuffer, currentChunk } = data;

  const blockGenXYZ = new BlockGenXYZ(params);
  const { width, height } = params.chunkSize;
  const { x: chunkX, z: chunkZ } = coordsXYZFromKey(chunkKey);
  const gx = chunkX * width;
  const gz = chunkZ * width
  const distance = Math.max(
    Math.abs(chunkX - currentChunk.x),
    Math.abs(chunkZ - currentChunk.z)
  );
  
  let LOD = 1;
  if (distance > params.lodDistance) {
    LOD = params.lod * Math.floor((distance - params.lodDistance) / 2)
    LOD = Math.max(LOD, params.lod)
  }
  const positions = [];
  const normals = [];
  const uvs: number[] = [];
  const indices = [];
  const voxelData = new Uint16Array(voxelDataBuffer);

  for (let z = 0; z < width; z+= LOD) {
    for (let x = 0; x < width; x+= LOD) {
      const surfaceHeight = blockGenXYZ.getHeightsXYZ(x + gx, 0, z + gz).surfaceHeight
      let y = surfaceHeight
      let downFlag = true
      
      while (downFlag) {
        let movementFlags = new Set();
        
        const index = indexFromXYZCoords(x, y, z, params.chunkSize);
        let representativeVoxel = voxelData[index];
        if (LOD > 1) { 
          const samples = [];
          for (let dz = 0; dz <= LOD && (z + dz) < width; dz++) {
            for (let dx = 0; dx <= LOD && (x + dx) < width; dx++) {
              const sampleIndex = indexFromXYZCoords(
                x + dx, 
                y, 
                z + dz, 
                params.chunkSize
              );
              samples.push(voxelData[sampleIndex]);
            }
          }
  
          const nonAirSamples = samples.filter(v => v > BLOCKS.air.id);
          if (nonAirSamples.length > 0) {
            const counts = new Map();
            nonAirSamples.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
            representativeVoxel = Array.from(counts.entries())
              .reduce((a, b) => a[1] > b[1] ? a : b)[0];
          } else {
            representativeVoxel = BLOCKS.air.id;
          }
        }

        if (representativeVoxel !== BLOCKS.air.id) {
          for (const { dir, corners, uvRow } of VoxelFaces) {
            let neighborX = x + dir[0] * LOD
            let neighborY = y + dir[1];
            let neighborZ = z + dir[2] * LOD
            let neighborHeights
          
            let neighborVoxelId = 0;
            const neighborInChunk = 
              neighborX >= 0 && neighborX < width &&
            neighborY >= 0 && neighborY < height &&
            neighborZ >= 0 && neighborZ < width

          if (neighborInChunk) {
            const neighborIndex = indexFromXYZCoords(neighborX, neighborY, neighborZ, params.chunkSize);
            neighborVoxelId = voxelData[neighborIndex];
          } else {
            neighborHeights = blockGenXYZ.getHeightsXYZ(
              neighborX + gx, 
              neighborY, 
              neighborZ + gz
            );
            if (neighborHeights.surfaceHeight - LOD < y) neighborVoxelId = BLOCKS.air.id
            else {
              neighborVoxelId = 3
            } 
          }
          neighborVoxelId = neighborVoxelId === BLOCKS.oak_log.id ? 0 : neighborVoxelId

          if (!neighborVoxelId) {
            const ndx = positions.length / 3;
            for (const pos of corners) {
              positions.push(
                pos[0] * LOD + x,
                pos[1] + y, 
                pos[2] * LOD + z
              );
              normals.push(...dir);
              // uvs.push(
              //   ((uvVoxel + uv[0]) * 16) / 16,
              //   1 - ((uvRow + 1 - uv[1]) * 16) / 16
              // );
            }
            indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
            movementFlags.add(true)
          } else {
            movementFlags.add(false)
          }
        }
      y = y - 1
      downFlag = movementFlags.has(true)
      }
    }
      y = surfaceHeight + 1
      while (y < height) {
        const index = indexFromXYZCoords(x, y, z, params.chunkSize);
        const voxel = voxelData[index];
        if (voxel !== BLOCKS.air.id) {
          for (const { dir, corners, uvRow } of VoxelFaces) {
            let neighborX = x + dir[0];
            let neighborY = y + dir[1];
            let neighborZ = z + dir[2];

            const neighborInChunk = 
            neighborX >= 0 && neighborX < width &&
            neighborY >= 0 && neighborY < height &&
            neighborZ >= 0 && neighborZ < width

            if (!neighborInChunk) continue
            const neighborIndex = indexFromXYZCoords(neighborX, neighborY, neighborZ, params.chunkSize);
            const neighborVoxel = voxelData[neighborIndex];
            if (neighborVoxel === BLOCKS.air.id) {
              const ndx = positions.length / 3;
              for (const pos of corners) {
                positions.push(
                  pos[0] + x, 
                  pos[1] + y, 
                  pos[2] + z
                );
                normals.push(...dir);
                // uvs.push(
                //   ((uvVoxel + uv[0]) * 16) / 16,
                //   1 - ((uvRow + 1 - uv[1]) * 16) / 16
                // );
              }
              indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
            }
          }
        }
        y++
      }
    }
  }

  const positionsBuffer = new Float32Array(positions);
  const normalsBuffer = new Int8Array(normals);
  const uvsBuffer = new Int16Array(uvs);
  const indicesBuffer = new Uint32Array(indices);

  const returnData: WorkerPostMessage = {
    id: message.id,
    workerId,
    request: {
      data: {
        chunkKey,
        positionsBuffer: positionsBuffer.buffer,
        normalsBuffer: normalsBuffer.buffer,
        uvsBuffer: uvsBuffer.buffer,
        indicesBuffer: indicesBuffer.buffer
      }
    }
  };

  self.postMessage(returnData, [
    positionsBuffer.buffer, 
    normalsBuffer.buffer, 
    uvsBuffer.buffer, 
    indicesBuffer.buffer
  ]);
}