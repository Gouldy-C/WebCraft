import { TerrainGenParams } from "../components/TerrainManager";
import { BLOCKS, Resource, RESOURCES } from "./BlocksData";
import * as SimplexNoise from "simplex-noise";
import { RNG } from "./generalUtils";
import { FractalNoise } from "./classes/FractalNoise";



export interface ResourceGenerator {
  noise3D: SimplexNoise.NoiseFunction3D;
  resource: Resource;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  scarcity: number;
}

export function terrainHeight(
  pos: { x: number; z: number},
  heightMap: Uint8Array,
  params: TerrainGenParams,
  fractalNoise: FractalNoise,
) {
  const value = heightMap[pos.x + (pos.z * params.chunkSize)]
  if (value === 0) {
    const noiseValue = fractalNoise.fractal2D(pos.x, pos.z)
    const heightValue = (noiseValue + 1) / 2
    const blockHeight = Math.floor(heightValue * params.maxWorldHeight - 1)
    heightMap[pos.x + (pos.z * params.chunkSize)] = blockHeight
    return blockHeight
  }
  return value
}

export function dirtDepth(
  pos: { x: number; z: number},
  maxDirtDepth: number,
  dirtDepthMap: Uint8Array,
  params: TerrainGenParams,
  noiseFunc: SimplexNoise.NoiseFunction2D,
) {
  const value = dirtDepthMap[pos.x + (pos.z * params.chunkSize)]
  if (value === 0) {
    const noiseValue = noiseFunc(pos.x, pos.z)
    const heightValue = (noiseValue + 1) / 2
    const dirtDepth = Math.floor(heightValue * maxDirtDepth)
    dirtDepthMap[pos.x + (pos.z * params.chunkSize)] = dirtDepth
    return dirtDepth
  }
  return value
}

export function getTerrainXYZ(
  pos: {x: number, y: number, z: number},
  terrainHeight: number,
  dirtDepth: number,
  params: TerrainGenParams,
) {
  if (pos.y > terrainHeight) return BLOCKS.air.id;

  // const resource = getResourceXYZ({x: pos.x, y: pos.y, z: pos.z}, resources);
  // if (resource && pos.y <= terrainHeight) return resource;

  if (pos.y === terrainHeight && pos.y < 200) return BLOCKS.grass.id;
  if (pos.y < terrainHeight && pos.y > terrainHeight - dirtDepth) return BLOCKS.dirt.id;
  if (pos.y < terrainHeight) return BLOCKS.stone.id;

  return BLOCKS.air.id;
}

export function getResourceXYZ(
  pos: {x: number, y: number, z: number},
  resources: ResourceGenerator[],
) {
  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i];
    const scaleY = resource.scaleY;
    const scaleZ = resource.scaleZ;
    const scaleX = resource.scaleX;
    const scarcity = resource.scarcity;

    const yS = pos.y / scaleY;
    const zS = pos.z / scaleZ;
    const xS = pos.x / scaleX;

    const value = resource.noise3D(xS, yS, zS);

    if (value > scarcity) {
      return resource.resource.id;
    }
  }
  return null;
}

export function generateResources(params: TerrainGenParams) {
  return RESOURCES.map((resource) => {
    return {
      noise3D: SimplexNoise.createNoise3D(RNG(params.seed + resource.name)),
      resource,
      scaleX: resource.scale.x,
      scaleY: resource.scale.y,
      scaleZ: resource.scale.z,
      scarcity: resource.scarcity,
    };
  });
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