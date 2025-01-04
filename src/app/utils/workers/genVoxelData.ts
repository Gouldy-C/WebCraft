import { BLOCKS } from "../BlocksData";
import { TerrainGenParams } from "../../components/TerrainManager";
import {
  applyChunkDiffs,
} from "../chunkGenFunctions";
import { coordsXYZFromKey, indexFromXYZCoords, measureTime } from "../generalUtils";
import { WorkerPostMessage } from "../classes/WorkerQueue";
import { VoxelGenXYZ } from "../classes/VoxelGenXYZ";


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
  const voxelGenXYZ = new VoxelGenXYZ(params);
  const { x: chunkX, z: chunkZ } = coordsXYZFromKey(chunkKey);
  const size = params.chunkSize;
  const { width, height } = size;
  const voxelData = new Uint16Array((width * height * width) + (width * width)).fill(0);
  const gx = chunkX * (width - 2)
  const gz = chunkZ * (width - 2)

  for (let z = 0; z < width; z++) {
    for (let x = 0; x < width; x++) {
      const surfaceHeight = voxelGenXYZ.getHeightsXYZ(x + gx, 0, z + gz).surfaceHeight
      const heightIndex = x + (z * width) + (width * width * height)
      voxelData[heightIndex] = surfaceHeight
      for (let y = surfaceHeight; y >= 0; y--) {
        const i = indexFromXYZCoords(x, y, z, size);
        if (voxelData[i] !== 0) continue
        const voxels: number = voxelGenXYZ.getBlockIdXYZ(x + gx, y, z + gz);
        if (!voxels) continue
        voxelData[i] = voxels;
      }
    }
  }

  applyChunkDiffs(chunkX, chunkZ, diffs, voxelData, size)

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
  const { chunkKey, params, voxelDataBuffer } = data;
  const { width, height } = params.chunkSize;
  
  const positions = [];
  const normals = [];
  const uvs: number[] = [];
  const indices = [];
  const voxelData = new Uint16Array(voxelDataBuffer);

  for (let z = 1; z < width - 1; z++) {
    for (let x = 1; x < width - 1; x++) {
      const surfaceHeight = voxelData[x + (z * width) + (width * width * height)]
      let y = surfaceHeight
      let downFlag = true
      
      while (downFlag) {
        let movementFlags = new Set();
        
        const index = indexFromXYZCoords(x, y, z, params.chunkSize);
        
        if (voxelData[index] !== BLOCKS.air.id) {
          for (const { dir, corners, } of VoxelFaces) {
            let neighborX = x + dir[0]
            let neighborY = y + dir[1];
            let neighborZ = z + dir[2]
          
            let neighborVoxelId: number | boolean = false;
            const neighborInChunk = 
              neighborX >= 0 && neighborX < width &&
              neighborY >= 0 && neighborY < height &&
              neighborZ >= 0 && neighborZ < width

          if (neighborInChunk) {
            const neighborIndex = indexFromXYZCoords(neighborX, neighborY, neighborZ, params.chunkSize);
            neighborVoxelId = voxelData[neighborIndex];
          }

          if (!neighborVoxelId) {
            const ndx = positions.length / 3;
            for (const pos of corners) {
              positions.push(
                pos[0] + x,
                pos[1] + y, 
                pos[2] + z
              );
              normals.push(...dir);
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
          for (const { dir, corners } of VoxelFaces) {
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