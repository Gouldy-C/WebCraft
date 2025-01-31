import { ChunkSize, TerrainGenParams } from "../components/TerrainManager";
import { BLOCKS } from "./BlocksData";
import {
  coordsXYZFromKey,
  indexFromXYZCoords,
  RNG
} from "./generalUtils";


export function applyChunkDiffs(
  chunkX: number,
  chunkZ: number,
  diffs: Record<string, { blockId: number }>,
  blocksData: Uint8Array,
  size: number
) {
  if (!diffs) return blocksData;
  const minX = chunkX * size;
  const minZ = chunkZ * size;
  const maxX = minX + size;
  const maxZ = minZ + size;

  for (const [key, diff] of Object.entries(diffs)) {
    const coords = coordsXYZFromKey(key);
    if (coords.x < minX || coords.x >= maxX) continue;
    if (coords.z < minZ || coords.z >= maxZ) continue;
    const index = indexFromXYZCoords(coords.x, coords.y, coords.z, size)
    blocksData[index] = diff.blockId;
  }
}

// export async function generateTrees(
//   chunkX: number,
//   chunkZ: number,
//   params: TerrainGenParams,
//   blocksData: Uint16Array
// ) {
//   const treeBuffer = 3
//   let surfaceY = 0
//   let trunkHeight = 0
//   function generateTrunk(x: number, z: number) {
//     const random = RNG(params.seed + `${keyFromXZCoords(chunkX, chunkZ)}<>${keyFromXZCoords(x, z)}-trunk`).fract53();
//     trunkHeight = Math.round(random * (params.trees.trunk.maxHeight - params.trees.trunk.minHeight) + params.trees.trunk.minHeight)
//     for (let y = 0; y < params.chunkSize.height; y++) {
//       const index = indexFromXYZCoords(x, y, z, params.chunkSize.width, params.chunkSize.height);
//       if (blocksData[index] === BLOCKS.grass.id || blocksData[index] === BLOCKS.snow_dirt.id) {
//         surfaceY = y
//         break
//       }
//     }
//     for (let y = surfaceY; y < surfaceY + trunkHeight; y++) {
//       const index = indexFromXYZCoords(x, y, z, params.chunkSize.width, params.chunkSize.height);
//       blocksData[index] = BLOCKS.oak_log.id;
//     }
//   }
//   function generateCanopy(x: number, z: number) {
//     const random = RNG(params.seed + `${keyFromXZCoords(chunkX, chunkZ)}<>${keyFromXZCoords(x, z)}-canopy`).fract53();
//     const radius = Math.round(random * (params.trees.canopy.maxRadius - params.trees.canopy.minRadius) + params.trees.canopy.minRadius);
//     for (let dx = -radius; dx <= radius; dx++) {
//       for (let dy = 0; dy <= radius; dy++) {
//         for (let dz = -radius; dz <= radius; dz++) {
//           const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
//           if (distance <= radius && Math.random() < 0.6) {
//             const y = surfaceY + trunkHeight + dy -1;
//             const index = indexFromXYZCoords(x + dx, y, z + dz, params.chunkSize.width, params.chunkSize.height);
//             if (blocksData[index] === BLOCKS.air.id) {
//               blocksData[index] = BLOCKS.oak_leaves.id;
//             }
//           }
//         }
//       }
//     }
//   }

//   for (let x = treeBuffer; x < params.chunkSize.width - treeBuffer; x++) {
//     for (let z = treeBuffer; z < params.chunkSize.width - treeBuffer; z++) {
//       if (RNG(params.seed + `${keyFromXZCoords(chunkX, chunkZ)}<>${keyFromXZCoords(x, z)}-tree`).fract53() < params.trees.density) {
//         generateTrunk(x, z);
//         generateCanopy(x, z);
//       }
//     }
//   }
// }