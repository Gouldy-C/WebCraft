import { BLOCKS } from "../BlocksData";
import { ChunkSize, TerrainGenParams } from "../../components/unused/Terrain";
import {
  applyChunkDiffs,
  generateResources,
  generateTerrain,
  generateTrees,
} from "../chunkGenFunctions";
import { coordsXYZFromKey, indexFromXYZCoords, measureTime } from "../helpers";
import { RequestObj, ReturnObj, WorkerPostMessage } from "../WorkerQueue";


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
    processChunkData(e.data);
  }
  if (e.data.request.type === "generateChunkMesh") {
    processGeometryData(e.data);
  }
};

function processChunkData(message: WorkerPostMessage) {
  const workerId = message.workerId;
  const data = message.request.data as RequestVoxelData;
  const { chunkKey, params, diffs } = data
  const { x: chunkX, z: chunkZ } = coordsXYZFromKey(chunkKey);
  const size = params.chunkSize;
  const { width, height } = size;
  const voxelData = new Uint16Array(width * height * height);

  generateResources(chunkX, chunkZ, params, voxelData)
  generateTerrain(chunkX, chunkZ, params, voxelData)
  generateTrees(chunkX, chunkZ, params, voxelData)
  applyChunkDiffs(chunkX, chunkZ, diffs, voxelData, size)

  const returnData: WorkerPostMessage = {
    workerId, 
    request: { 
      id:chunkKey,
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
  const { chunkKey, params, voxelDataBuffer } = data
  const positions = [];
  const normals = [];
  const uvs: number[] = [];
  const indices = [];
  const voxelData = new Uint16Array(voxelDataBuffer);

  for (let y = 0; y < params.chunkSize.height; ++y) {
    for (let z = 0; z < params.chunkSize.width; ++z) {
      for (let x = 0; x < params.chunkSize.width; ++x) {
        const index = indexFromXYZCoords(x, y, z, params.chunkSize);
        const voxel = voxelData[index];
        if (voxel > BLOCKS.air.id) {
          const uvVoxel = voxel - 1;
          for (const { dir, corners, uvRow } of VoxelFaces) {
            let index = indexFromXYZCoords(x + dir[0], y + dir[1], z + dir[2], params.chunkSize);
            if (x + dir[0] < 0 || x + dir[0] >= params.chunkSize.width) index = -1;
            if (z + dir[2] < 0 || z + dir[2] >= params.chunkSize.width) index = -1;
            const neighbor = index === -1 ? BLOCKS.air.id : voxelData[index];
            if (!neighbor) {
              const ndx = positions.length / 3;
              for (const pos of corners) {
                positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
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
      }
    }
  }
  const positionsBuffer = new Float32Array(positions);
  const normalsBuffer = new Int8Array(normals);
  const uvsBuffer = new Int16Array(uvs);
  const indicesBuffer = new Uint32Array(indices);

  const returnData: WorkerPostMessage = {
    workerId, 
    request: { 
      id:chunkKey,
      data: { 
        chunkKey,
        positionsBuffer: positionsBuffer.buffer,
        normalsBuffer: normalsBuffer.buffer,
        uvsBuffer: uvsBuffer.buffer,
        indicesBuffer: indicesBuffer.buffer
      }
    }
  }

  self.postMessage( returnData, [positionsBuffer.buffer, normalsBuffer.buffer, uvsBuffer.buffer, indicesBuffer.buffer]);
}
