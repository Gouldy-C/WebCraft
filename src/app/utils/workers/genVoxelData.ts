import { BLOCKS } from "../BlocksData";
import { ChunkSize, TerrainGenParams } from "../../components/unused/Terrain";
import {
  applyChunkDiffs,
  generateResources,
  generateTerrain,
  generateTrees,
} from "../chunkGenFunctions";
import { coordsXYZFromKey, indexFromXYZCoords, measureTime } from "../helpers";

interface VoxelData {
  chunkKey: string;
  params: TerrainGenParams;
  diffs: Record<string, { blockId: number }>;
}

interface GeometryData {
  chunkKey: string;
  params: TerrainGenParams;
  voxelDataBuffer: ArrayBuffer;
}

type WorkerData = {
  type: string;
  data: VoxelData | GeometryData;
  workerId: number;
};

const VoxelFaces = [
  {
    // left
    uvRow: 0,
    dir: [-1, 0, 0],
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
  },
  {
    // right
    uvRow: 0,
    dir: [1, 0, 0],
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
  },
  {
    // bottom
    uvRow: 1,
    dir: [0, -1, 0],
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  {
    // top
    uvRow: 2,
    dir: [0, 1, 0],
    corners: [
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 0] },
    ],
  },
  {
    // back
    uvRow: 0,
    dir: [0, 0, -1],
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 1] },
    ],
  },
  {
    // front
    uvRow: 0,
    dir: [0, 0, 1],
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
    ],
  },
];

self.onmessage = (e) => {
  if (e.data.type === "generateChunkData") {
    processChunkData(e)
  }
  if (e.data.type === "generateChunkMeshData") {
    processGeometryData(e);
  }
};

function processChunkData(e: MessageEvent<WorkerData>) {
  const workerId = e.data.workerId;
  const data = e.data;
  const { chunkKey, params, diffs } = data.data as VoxelData;
  const { x: chunkX, z: chunkZ } = coordsXYZFromKey(chunkKey);
  const size = params.chunkSize;
  const { width, height } = size;
  const voxelData = new Uint16Array(width * height * height);

  generateResources(chunkX, chunkZ, params, voxelData)
  generateTerrain(chunkX, chunkZ, params, voxelData)
  generateTrees(chunkX, chunkZ, params, voxelData)
  applyChunkDiffs(chunkX, chunkZ, diffs, voxelData, size)

  self.postMessage({
    workerId,
    chunkKey,
    voxelDataBuffer: voxelData.buffer
  }, [voxelData.buffer]);
}

function processGeometryData(e: MessageEvent<WorkerData>) {
  const workerId = e.data.workerId;
  const data = e.data;
  const { chunkKey, params, voxelDataBuffer } = data.data as GeometryData;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const voxelData = new Uint16Array(voxelDataBuffer);

  for (let y = 0; y < params.chunkSize.height; ++y) {
    for (let z = 0; z < params.chunkSize.width; ++z) {
      for (let x = 0; x < params.chunkSize.width; ++x) {
        const index = indexFromXYZCoords(x, y, z, params.chunkSize);
        const voxel = index === -1 ? BLOCKS.air.id : voxelData[index];
        if (voxel > 0) {
          const uvVoxel = voxel - 1;
          for (const { dir, corners, uvRow } of VoxelFaces) {
            let index = indexFromXYZCoords(x + dir[0], y + dir[1], z + dir[2], params.chunkSize);
            if (x + dir[0] < 0 || x + dir[0] >= params.chunkSize.width) index = -1;
            if (z + dir[2] < 0 || z + dir[2] >= params.chunkSize.width) index = -1;
            const neighbor = index === -1 ? BLOCKS.air.id : voxelData[index];
            if (!neighbor) {
              const ndx = positions.length / 3;
              for (const { pos, uv } of corners) {
                positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
                normals.push(...dir);
                uvs.push(
                  ((uvVoxel + uv[0]) * 16) / 16,
                  1 - ((uvRow + 1 - uv[1]) * 16) / 16
                );
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

  self.postMessage({
    workerId,
    chunkKey,
    positionsBuffer: positionsBuffer.buffer,
    normalsBuffer: normalsBuffer.buffer,
    uvsBuffer: uvsBuffer.buffer,
    indicesBuffer: indicesBuffer.buffer,
  }, [positionsBuffer.buffer, normalsBuffer.buffer, uvsBuffer.buffer, indicesBuffer.buffer]);
}
