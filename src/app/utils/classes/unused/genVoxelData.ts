import { BLOCKS } from "../../BlocksData";
import { TerrainGenParams } from "../../../components/TerrainManager";
import { applyChunkDiffs } from "../../chunkGenFunctions";
import {
  coordsXYZFromKey,
  indexFromXYZCoords,
  keyFromXZCoords,
  lerp,
  measureTime,
} from "../../generalUtils";
import { WorkerPostMessage } from "../WorkerQueue";
import { VoxelGenXYZ } from "../classes/VoxelGenXYZ";
import { BitArray } from "./BitArray";

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
    measureTime(() => getVoxelTypes(e.data), "processChunk");
  }
  if (e.data.request.type === "generateChunkMesh") {
    measureTime(() => processGeometryData(e.data), "processGeometry");
  }
};

// function getBinaryVoxelData(message: WorkerPostMessage) {
//   const workerId = message.workerId;
//   const data = message.request.data as RequestVoxelData;
//   const { chunkKey, params, diffs } = data
//   const { width, height } = params.chunkSize;

//   const binaryVoxelData = new BigUint64Array((width * height)).fill(BigInt(0));
//   const heightMapData = new Uint8Array((width * width)).fill(0);

//   for (let z = 0; z < width; z++) {
//     for (let y = 0; y < height; y++) {

//     }
//   }
// }

function getVoxelTypes(message: WorkerPostMessage) {
  const workerId = message.workerId;
  const data = message.request.data as RequestVoxelData;
  const { chunkKey, params, diffs } = data;
  const voxelGenXYZ = new VoxelGenXYZ(params);
  const { x: chunkX, y: chunkY, z: chunkZ } = coordsXYZFromKey(chunkKey);
  const size = params.chunkSize;
  const voxelData = new Uint8Array(size * size * size + size * size);
  const binaryData = new BitArray(size * size);
  const gx = chunkX * (size - 2);
  const gy = chunkY * size;
  const gz = chunkZ * (size - 2);
  const heightMap: Record<string, number> = {};
  const sampleRate = 7;

  for (let x = 0; x <= size; x += sampleRate) {
    for (let z = 0; z <= size; z += sampleRate) {
      const surfaceHeight = voxelGenXYZ.getHeightsXZ(
        x + gx,
        z + gz
      ).surfaceHeight;
      heightMap[keyFromXZCoords(x, z)] = surfaceHeight;
    }
  }

  for (let x = 0; x < size; x++) {
    const xLow = Math.floor(x / sampleRate) * sampleRate;
    const xHigh = xLow + sampleRate >= size - 1 ? size - 1 : xLow + sampleRate;
    const xPercent = (1 / sampleRate) * (x % sampleRate);

    for (let z = 0; z < size; z++) {
      if (x % sampleRate === 0 && z % sampleRate === 0) continue;
      const zLow = Math.floor(z / sampleRate) * sampleRate;
      const zHigh =
        zLow + sampleRate >= size - 1 ? size - 1 : zLow + sampleRate;
      const zPercent = (1 / sampleRate) * (z % sampleRate);

      const xHeightLow = heightMap[keyFromXZCoords(xLow, z)];
      const xHeightHigh = heightMap[keyFromXZCoords(xHigh, z)];
      const xLerp = lerp(xPercent, xHeightLow, xHeightHigh);

      const zHeightLow = heightMap[keyFromXZCoords(x, zLow)];
      const zHeightHigh = heightMap[keyFromXZCoords(x, zHigh)];
      const zLerp = lerp(zPercent, zHeightLow, zHeightHigh);

      heightMap[keyFromXZCoords(x, z)] = Math.floor((xLerp + zLerp) / 2);
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const surfaceHeight = heightMap[keyFromXZCoords(x, z)];
        const heightIndex = x + z * size + size * size * size;
        voxelData[heightIndex] = surfaceHeight;
        const i = indexFromXYZCoords(x, y, z, size);
        if (voxelData[i] !== 0) continue;
        const voxel: number = voxelGenXYZ.getBlockIdXYZ(x + gx, y + gy, z + gz);
        if (!voxel) continue;
        binaryData.setBit(x + y * size);
        voxelData[i] = voxel;
      }
    }
  }

  // applyChunkDiffs(chunkX, chunkZ, diffs, voxelData, size);

  const returnData: WorkerPostMessage = {
    id: message.id,
    workerId,
    request: {
      id: message.id,
      type: "voxelData",
      data: {
        chunkKey,
        voxelDataBuffer: voxelData.buffer,
      },
    },
  };

  self.postMessage(returnData, [voxelData.buffer]);
}

function processGeometryData(message: WorkerPostMessage) {
  const workerId = message.workerId;
  const data = message.request.data as RequestGeometryData;
  const { chunkKey, params, voxelDataBuffer } = data;
  const size = params.chunkSize;
  const worldHeight = params.worldHeight;
  const height = params.worldHeight;

  let positions = [];
  let normals = [];
  let indices = [];
  let voxelData: Uint16Array | null = new Uint16Array(voxelDataBuffer);

  for (let z = 1; z < size - 1; z++) {
    for (let x = 1; x < size - 1; x++) {
      for (let y = 0; y < size; y++) {
        const index = x + z * size + size * size * y;
        if (voxelData[index] === BLOCKS.air.id) continue;
        for (const { dir, corners } of VoxelFaces) {
          let nX = x + dir[0];
          let nY = y + dir[1];
          let nZ = z + dir[2];

          let neighborVoxelId: number = 0;
          const neighborInChunk =
            nX >= 0 &&
            nX < size &&
            nY >= 0 &&
            nY < size &&
            nZ >= 0 &&
            nZ < size;

          if (neighborInChunk) {
            const neighborIndex = nX + nZ * size + size * size * nY;
            neighborVoxelId = voxelData[neighborIndex];
          }

          if (neighborVoxelId === BLOCKS.air.id) {
            const ndx = positions.length / 3;
            for (const pos of corners) {
              positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
              normals.push(...dir);
            }
            indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
          }
        }
      }
    }
  }

  // for (let z = 1; z < size - 1; z++) {
  //   for (let x = 1; x < size - 1; x++) {
  //     const surfaceHeight: number =
  //       voxelData[x + (z * size) + (size * size * height)];
  //     for (let y = 0; y < size; y++) {
  //       const index = x + z * size + size * size * y;
  //       if (voxelData[index] === BLOCKS.air.id) continue;
  //       for (const { dir, corners } of VoxelFaces) {
  //         let nX = x + dir[0];
  //         let nY = y + dir[1];
  //         let nZ = z + dir[2];

  //         let neighborVoxelId: number | boolean = false;
  //         const neighborInChunk =
  //           nX >= 0 &&
  //           nX < size &&
  //           nY >= 0 &&
  //           nY < size &&
  //           nZ >= 0 &&
  //           nZ < size;

  //         if (neighborInChunk) {
  //           const neighborIndex = nX + nZ * size + size * size * nY;
  //           neighborVoxelId = voxelData[neighborIndex];
  //         }

  //         if (neighborVoxelId === BLOCKS.air.id) {
  //           const ndx = positions.length / 3;
  //           for (const pos of corners) {
  //             positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
  //             normals.push(...dir);
  //           }
  //           indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
  //         }
  //       }
  //     }
  //     // for (let y = surfaceHeight + 1; y < height; y++) {
  //     //   const index = x + z * size + size * size * y;
  //     //   const voxel = voxelData[index];
  //     //   if (voxel === BLOCKS.air.id) continue;
  //     //   for (const { dir, corners } of VoxelFaces) {
  //     //     let nX = x + dir[0];
  //     //     let nY = y + dir[1];
  //     //     let nZ = z + dir[2];

  //     //     const neighborInChunk =
  //     //       nX >= 0 &&
  //     //       nX < size &&
  //     //       nY >= 0 &&
  //     //       nY < size &&
  //     //       nZ >= 0 &&
  //     //       nZ < size;

  //     //     if (!neighborInChunk) continue;
  //     //     const neighborIndex = nX + (nZ * size) + (size * size * nY);
  //     //     const neighborVoxel = voxelData[neighborIndex];
  //     //     if (neighborVoxel === BLOCKS.air.id) {
  //     //       const ndx = positions.length / 3;
  //     //       for (const pos of corners) {
  //     //         positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
  //     //         normals.push(...dir);
  //     //       }
  //     //       indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
  //     //     }
  //     //   }
  //     // }
  //   }
  // }

  const positionsBuffer = new Float32Array(positions);
  const normalsBuffer = new Int8Array(normals);
  const indicesBuffer = new Uint32Array(indices);
  positions = [];
  normals = [];
  indices = [];
  voxelData = null;

  const returnData: WorkerPostMessage = {
    id: message.id,
    workerId,
    request: {
      id: message.id,
      type: "meshData",
      data: {
        chunkKey,
        positionsBuffer: positionsBuffer.buffer,
        normalsBuffer: normalsBuffer.buffer,
        indicesBuffer: indicesBuffer.buffer,
      },
    },
  };

  self.postMessage(returnData, [
    positionsBuffer.buffer,
    normalsBuffer.buffer,
    indicesBuffer.buffer,
  ]);
}
