import { TerrainGenParams } from "../components/TerrainManager";
import { BLOCKS, Resource} from "./BlocksData";
import * as SimplexNoise from "simplex-noise";
import { indexFromXYZCoords} from "./generalUtils";
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
  pos: { x: number; z: number },
  heightMap: Uint8Array,
  params: TerrainGenParams,
  fractalNoise: FractalNoise, 
  wCoords: { x: number; y: number; z: number }
) {
  const value = heightMap[pos.x + pos.z * params.chunkSize];
  if (value === 0) {
    const noiseValue = fractalNoise.fractal2D(pos.x + wCoords.x, pos.z + wCoords.z);
    const heightValue = (noiseValue + 1) / 2;
    const blockHeight = Math.floor(heightValue * params.maxWorldHeight - 1);
    heightMap[pos.x + pos.z * params.chunkSize] = blockHeight;
    return blockHeight;
  }
  return value;
}

export function dirtDepth(
  pos: { x: number; z: number },
  maxDirtDepth: number,
  dirtDepthMap: Uint8Array,
  params: TerrainGenParams,
  noiseFunc: SimplexNoise.NoiseFunction2D,
  wCoords: { x: number; y: number; z: number }
) {
  const value = dirtDepthMap[pos.x + pos.z * params.chunkSize];
  if (value === 0) {
    const noiseValue = noiseFunc((pos.x + wCoords.x) / 30, (pos.z + wCoords.z) / 30);
    const heightValue = (noiseValue + 1) / 2;
    const dirtDepth = Math.floor(heightValue * maxDirtDepth);
    dirtDepthMap[pos.x + pos.z * params.chunkSize] = dirtDepth;
    return dirtDepth;
  }
  return value;
}

export function getTerrainXYZ(
  pos: { x: number; y: number; z: number },
  terrainHeight: number,
  dirtDepth: number,
  params: TerrainGenParams
) {
  if (pos.y > terrainHeight) return BLOCKS.air.id;

  // const resource = getResourceXYZ({x: pos.x, y: pos.y, z: pos.z}, resources);
  // if (resource && pos.y <= terrainHeight) return resource;

  if (pos.y === terrainHeight && pos.y < 200) return BLOCKS.grass.id;
  if (pos.y < terrainHeight && pos.y > terrainHeight - dirtDepth)
    return BLOCKS.dirt.id;
  if (pos.y < terrainHeight) return BLOCKS.stone.id;

  return BLOCKS.air.id;
}



// export function getResourceXYZ(
//   pos: { x: number; y: number; z: number },
//   resources: ResourceGenerator[]
// ) {
//   for (let i = 0; i < resources.length; i++) {
//     const resource = resources[i];
//     const scaleY = resource.scaleY;
//     const scaleZ = resource.scaleZ;
//     const scaleX = resource.scaleX;
//     const scarcity = resource.scarcity;

//     const yS = pos.y / scaleY;
//     const zS = pos.z / scaleZ;
//     const xS = pos.x / scaleX;

//     const value = resource.noise3D(xS, yS, zS);

//     if (value > scarcity) {
//       return resource.resource.id;
//     }
//   }
//   return null;
// }

// export function generateResources(params: TerrainGenParams) {
//   return RESOURCES.map((resource) => {
//     return {
//       noise3D: SimplexNoise.createNoise3D(RNG(params.seed + resource.name)),
//       resource,
//       scaleX: resource.scale.x,
//       scaleY: resource.scale.y,
//       scaleZ: resource.scale.z,
//       scarcity: resource.scarcity,
//     };
//   });
// }

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

export function greedyMesher(volume: Uint16Array, size: number) {
  let mask = new Int32Array(size * size);
  
  const vertices: number[] = [];
  for(let axis = 0; axis < 3; ++axis) {
    let x, y, w
    let length, width, height
    const altAxis1 = (axis + 1) % 3
    const altAxis2 = (axis + 2) % 3
    const dIndex = [0,0,0]

    const step = [0,0,0];
    step[axis] = 1;

    mask = new Int32Array(size * size)

    for(dIndex[axis] = -1; dIndex[axis] < size; ) {
      let maskIndex = 0;

      for(dIndex[altAxis2] = 0; dIndex[altAxis2] < size; dIndex[altAxis2]++) {
        for(dIndex[altAxis1] = 0; dIndex[altAxis1] < size; dIndex[altAxis1]++, maskIndex++) {
          let voxel1 = (0 <= dIndex[axis] ? volume[indexFromXYZCoords(dIndex[0], dIndex[1], dIndex[2], size)] : 0)
          const v2Pos = [dIndex[0] + step[0], dIndex[1] + step[1], dIndex[2] + step[2]]
          let voxel2 = (dIndex[axis] <  size - 1 ? volume[indexFromXYZCoords(v2Pos[0], v2Pos[1], v2Pos[2], size)] : 0);
          if((!!voxel1) === (!!voxel2)) {
            mask[maskIndex] = 0;
          }
          else if(!!voxel1) {
            mask[maskIndex] = voxel1;
          }
          else {
            mask[maskIndex] = -voxel2;
          }
        }
      }

      dIndex[axis]++;
      maskIndex = 0;

      for(y = 0; y < size; y++) {
        for(x = 0; x < size;) {
          let voxelType = mask[maskIndex];
          if(!!voxelType) {
            for(width = 1; voxelType === mask[maskIndex + width] && x + width < size; width++) {}
            
            let done = false;
            for(height = 1; y + height < size; height++) {
              for(w = 0; w < width; w++) {
                if(voxelType !== mask[maskIndex + w + height * size]) {
                  done = true;
                  break;
                }
              }
              if(done) {
                break;
              }
            }

            dIndex[altAxis1] = x;  dIndex[altAxis2] = y;
            let du = [0,0,0]
            let dv = [0,0,0]; 
            let normal
            let uv
            if(voxelType > 0) {
              normal = axis * 2
              uv = [1, 2, 3, 1, 3, 0]
              dv[altAxis2] = height;
              du[altAxis1] = width;
            } else {
              normal = axis * 2 + 1
              uv = [1, 3, 0, 1, 2, 3]
              voxelType = -voxelType
              du[altAxis2] = height;
              dv[altAxis1] = width;
            }

            const vPosA = [dIndex[0], dIndex[1], dIndex[2]]
            const vPosB = [dIndex[0] + du[0], dIndex[1] + du[1], dIndex[2] + du[2]]
            const vPosC = [dIndex[0] + du[0] + dv[0], dIndex[1] + du[1] + dv[1], dIndex[2] + du[2] + dv[2]]
            const vPosD = [dIndex[0] + dv[0], dIndex[1] + dv[1], dIndex[2] + dv[2]]
            const points = [vPosA, vPosB, vPosC, vPosA, vPosC, vPosD]

            // vertexData(x):  5 height | 5 width | 2 uv | 3 normal | 5 z | 5 y | 5 x
            // (height << 26) | (width << 20) | (uv << 18) | (normal << 15) | (z << 10)| (y << 5) | x
            // blockData(y):  20 unused bits | 12 block id
            // blockData(z):  unused

            for (let v = 0; v < 6; v++) {
              const packedX = (uv[v] << 18) | (normal << 15) | (points[v][2] << 10) | (points[v][1] << 5) | points[v][0];
              const packedY = voxelType 
              const packedZ = 0
              vertices.push(packedX, packedY, packedZ)
            }

            for(length = 0; length < height; length++) {
              for(w = 0; w < width; w++) {
                mask[maskIndex + w + length * size] = 0;
              }
            }

            x += width; maskIndex += width;
          } else {
            x++;    maskIndex++;
          }
        }
      }
    }
  }
  return vertices;
}
