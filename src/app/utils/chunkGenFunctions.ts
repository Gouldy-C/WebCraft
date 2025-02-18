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
    const noiseValue = noiseFunc((pos.x + wCoords.x) / 40, (pos.z + wCoords.z) / 40);
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
  if (pos.y < terrainHeight && pos.y > terrainHeight - dirtDepth) return BLOCKS.dirt.id;
  if (pos.y < terrainHeight) return BLOCKS.stone.id;

  return BLOCKS.air.id;
}

// isTreeAtXYZ(
  //   x: number,
  //   y: number,
  //   z: number,
  //   params: TerrainGenParams,
  //   heights?: { surfaceHeight: number; heightValue: number }
  // ) {
  //   const { surfaceHeight } = heights ? heights : this.getHeightsXYZ(x, y, z);
  //   if (y <= surfaceHeight || y > surfaceHeight + params.trees.trunk.maxHeight)
  //     return false;
  //   const width = params.chunkSize.width;
  //   const treeBuffer = params.trees.buffer;
  //   const density = params.trees.density;
  //   if (
  //     Math.abs(x % width) < treeBuffer ||
  //     Math.abs(x % width) > width - treeBuffer
  //   )
  //     return false;
  //   if (
  //     Math.abs(z % width) < treeBuffer ||
  //     Math.abs(z % width) > width - treeBuffer
  //   )
  //     return false;
  //   const rng = RNG(params.seed + "tree" + keyFromXZCoords(x, z));
  //   if (rng.fract53() < density) return true;
  //   return false;
  // }

  // generateTreeXYZ(
  //   x: number,
  //   y: number,
  //   z: number,
  //   heights?: { surfaceHeight: number; heightValue: number }
  // ) {
  //   const { surfaceHeight } = heights ? heights : this.getHeightsXYZ(x, y, z);
  //   if (y <= surfaceHeight) return null;
  //   const { maxHeight, minHeight } = this.params.trees.trunk;
  //   const trunkHeight = Math.round(
  //     RNG(this.params.seed + "tree" + keyFromXZCoords(x, z)).fract53() *
  //       (maxHeight - minHeight) +
  //       minHeight
  //   );
  //   if (y > trunkHeight + surfaceHeight) return null;
  //   return BLOCKS.oak_log.id;
  // }

  // generateCanopyXYZ(x: number, y: number, z: number, trunkHeight: number) {
  //   const offsets = 0;
  //   const { maxRadius, minRadius } = this.params.trees.canopy;
  //   const radius = Math.round(
  //     RNG(this.params.seed + "tree" + x + z).fract53() *
  //       (maxRadius - minRadius) +
  //       minRadius
  //   );
  //   const canopyMinY = y + trunkHeight - radius + offsets;
  //   const canopyMaxY = y + trunkHeight + radius * 2 + offsets;
  //   const canopyCoords: { x: number; y: number; z: number }[] = [];

  //   for (let dy = canopyMinY; dy <= canopyMaxY; dy++) {
  //     for (let dx = -radius; dx <= radius; dx++) {
  //       for (let dz = -radius; dz <= radius; dz++) {
  //         const distance = dx * dx + dy * dy + dz * dz <= radius * radius;
  //         if (
  //           distance &&
  //           RNG(
  //             this.params.seed + "tree" + keyFromXZCoords(x + dx, z + dz)
  //           ).fract53() < 0.75
  //         ) {
  //           canopyCoords.push({ x: x + dx, y: y + dy, z: z + dz });
  //         }
  //       }
  //     }
  //   }
  //   return canopyCoords;
  // }



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

// export function greedyMesher(volume: Uint16Array, size: number) {
//   let mask = new Int32Array(size * size);
  
//   const vertices: number[] = [];
//   for(let axis = 0; axis < 3; ++axis) {
//     let x, y, w
//     let length, width, height
//     const altAxis1 = (axis + 1) % 3
//     const altAxis2 = (axis + 2) % 3
//     const dIndex = [0,0,0]

//     const step = [0,0,0];
//     step[axis] = 1;

//     // mask = new Int32Array(size * size)

//     for(dIndex[axis] = -1; dIndex[axis] < size; ) {
//       let maskIndex = 0;

//       for(dIndex[altAxis2] = 0; dIndex[altAxis2] < size; dIndex[altAxis2]++) {
//         for(dIndex[altAxis1] = 0; dIndex[altAxis1] < size; dIndex[altAxis1]++, maskIndex++) {
//           let voxel1 = (0 <= dIndex[axis] ? volume[indexFromXYZCoords(dIndex[0], dIndex[1], dIndex[2], size)] : 0)
//           const v2Pos = [dIndex[0] + step[0], dIndex[1] + step[1], dIndex[2] + step[2]]
//           let voxel2 = (dIndex[axis] <  size ? volume[indexFromXYZCoords(v2Pos[0], v2Pos[1], v2Pos[2], size)] : 0);
//           if((voxel1 !== 0) === (voxel2 !== 0) ) {
//             mask[maskIndex] = 0;
//           }
//           else if(!!voxel1) {
//             mask[maskIndex] = voxel1;
//           }
//           else {
//             mask[maskIndex] = -voxel2;
//           }
//         }
//       }

//       dIndex[axis]++;
//       maskIndex = 0;

//       for(y = 0; y < size; y++) {
//         for(x = 0; x < size;) {
//           let voxelType = mask[maskIndex];
//           if(!!voxelType) {
//             for(width = 1; voxelType === mask[maskIndex + width] && x + width < size; width++) {}
            
//             let done = false;
//             for(height = 1; y + height < size; height++) {
//               for(w = 0; w < width; w++) {
//                 if(voxelType !== mask[maskIndex + w + height * size]) {
//                   done = true;
//                   break;
//                 }
//               }
//               if(done) {
//                 break;
//               }
//             }

//             dIndex[altAxis1] = x;  dIndex[altAxis2] = y;
//             let du = [0,0,0]
//             let dv = [0,0,0]; 
//             let normal
//             let uv
//             if(voxelType > 0) {
//               normal = axis * 2
//               uv = [1, 2, 3, 1, 3, 0]
//               dv[altAxis2] = height;
//               du[altAxis1] = width;
//             } else {
//               normal = axis * 2 + 1
//               uv = [1, 3, 0, 1, 2, 3]
//               voxelType = -voxelType
//               du[altAxis2] = height;
//               dv[altAxis1] = width;
//             }

//             const vPosA = [dIndex[0], dIndex[1], dIndex[2]]
//             const vPosB = [dIndex[0] + du[0], dIndex[1] + du[1], dIndex[2] + du[2]]
//             const vPosC = [dIndex[0] + du[0] + dv[0], dIndex[1] + du[1] + dv[1], dIndex[2] + du[2] + dv[2]]
//             const vPosD = [dIndex[0] + dv[0], dIndex[1] + dv[1], dIndex[2] + dv[2]]
//             const points = [vPosA, vPosB, vPosC, vPosA, vPosC, vPosD]

//             // vertexData(x):  5 height | 5 width | 2 uv | 3 normal | 5 z | 5 y | 5 x
//             // (height << 26) | (width << 20) | (uv << 18) | (normal << 15) | (z << 10)| (y << 5) | x
//             // blockData(y):  20 unused bits | 12 block id
//             // blockData(z):  unused

//             for (let v = 0; v < 6; v++) {
//               const packedX = (uv[v] << 18) | (normal << 15) | (points[v][2] << 10) | (points[v][1] << 5) | points[v][0];
//               const packedY = voxelType 
//               const packedZ = 0
//               vertices.push(packedX, packedY, packedZ)
//             }

//             for(length = 0; length < height; length++) {
//               for(w = 0; w < width; w++) {
//                 mask[maskIndex + w + length * size] = 0;
//               }
//             }

//             x += width; maskIndex += width;
//           } else {
//             x++;    maskIndex++;
//           }
//         }
//       }
//     }
//   }
//   return vertices;
// }

function getCoordsForAdjacentVoxel(x: number, y: number, z: number, size: number) {
  const adjacentCoords = [
    [x + 1, y, z],
    [x - 1, y, z],
    [x, y + 1, z],
    [x, y - 1, z],
    [x, y, z + 1],
    [x, y, z - 1],
  ];

  return adjacentCoords;
}

export function culledMesher(voxelArray: Uint16Array, binaryData: Uint32Array, size: number) {
  const packedVertices: number[] = []
  for (let y = 0; y < size; y++) {
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const index = x + y * size + z * size * size
        const voxel = voxelArray[index]
        if (voxel === 0) continue;
        
        const adjacentCoords = getCoordsForAdjacentVoxel(x, y, z, size)
        for (let i = 0; i < adjacentCoords.length; i++) {
          const axis = Math.floor(i / 2)
          const direction = i % 2 === 0 ? 1 : 0
          let depth = 0, u = 0, v = 0
          if (axis === 0) {
            depth = x
            u = z
            v = y
          }
          if (axis === 1) {
            depth = y
            u = x
            v = z
          }
          if (axis === 2) {
            depth = z
            u = x
            v = y
          }

          const [ax, ay, az] = adjacentCoords[i]
          const flag = az >= size || az < 0 || ay >= size || ay < 0 || ax >= size || ax < 0
          if (flag) {
            const vertices = getQuadPoints(axis, direction, depth, u, v, 1, 1)
            const packedQuad = packVertices(vertices, voxel, axis, direction, 0, 0)
            packedVertices.push(...packedQuad)
            continue
          }

          const aIndex = ax + ay * size + az * size * size
          const aVoxel = voxelArray[aIndex]
          if (aVoxel === 0) {
            const vertices = getQuadPoints(axis, direction, depth, u, v, 1, 1)
            const packedQuad = packVertices(vertices, voxel, axis, direction, 0, 0)
            packedVertices.push(...packedQuad)
          }
        }
      }
    }
  }
  
  packedVertices.push(0, 0, 0)
  return packedVertices
}


export function binaryGreedyMesher(voxelArray: Uint16Array, binaryData: Uint32Array, size: number) {
  const packedVertices: number[] = []

  const throughAxisFaces = genThroughAxisFaces(binaryData, size)
  const crossAxisPlanes = genCrossAxisFacePlanes(throughAxisFaces, size)

  for (const [index, planes] of crossAxisPlanes.entries()) {
    const axis = Math.floor(index / 2)
    const direction = index % 2 === 0 ? 1 : 0

    for (let depth = 0; depth < size; depth++) {
      const plane = planes[depth]
      if (!plane) continue;

      for (let v = 0; v < size; v++) {
        const binary = plane[v]
        if (binary === 0) continue;

        let width = 0
        let height = 0
        let quadMask = 0
        let voxelType = 1

        for (let u = 0; u <= size; u++) {  // Note: changed to <= to handle edge
          const isEdge = u === size
          const bit = isEdge ? 0 : (binary & (1 << u))
          
          let index = 0
          if (!isEdge) {
            if (axis === 0) {
              index = depth + v * size + (u * size * size);
            }
            if (axis === 1) {
              index = u + depth * size + (v * size * size);
            }
            if (axis === 2) {
              index = u + v * size + (depth * size * size);
            }
          }
          
          const newVoxelType = isEdge ? 0 : voxelArray[index]
          const reachedAir = (!bit && quadMask) || isEdge
          const voxelSame = newVoxelType === voxelType

          if (reachedAir || (!voxelSame && quadMask)) {
            // Measure height
            let maxHeight = 0
            for (let h = v; h < size; h++) {
              const bitMask = plane[h] & quadMask
              if (bitMask === quadMask) {
                maxHeight++
                plane[h] = plane[h] & ((~quadMask) >>> 0)
              } else {
                break
              }
            }

            if (width > 0 && maxHeight > 0) {
              const vertices = getQuadPoints(axis, direction, depth, u - width, v, width, maxHeight)
              const packedQuad = packVertices(vertices, voxelType, axis, direction, width - 1, maxHeight - 1)
              packedVertices.push(...packedQuad)
            }

            width = 0
            height = 0
            quadMask = 0
            
            if (!isEdge && bit) {
              voxelType = newVoxelType
              quadMask |= 1 << u
              width++
            }
          } else if (bit) {
            voxelType = newVoxelType
            quadMask |= 1 << u
            width++
          }
        }
      }
    }
  }
  packedVertices.push(0, 0, 0)
  return packedVertices
}

export function getQuadPoints(axisIndex: number, direction: number, depth: number, u: number, v: number, width: number, height: number) {
  const points: number[][] = []
  const offsets = ((axisIndex: number, direction: number) =>{
    if (axisIndex === 0) {
      return direction 
        ? [[width, 0], [0, 0], [0, height], [width, height]] // pos x
        : [[0, 0], [width, 0], [width, height], [0, height]] // neg x
    }
    else if (axisIndex === 1) {
      return direction 
        ? [[0, 0], [0, height], [width, height], [width, 0]] // pos y
        : [[0, height], [0, 0], [width, 0], [width, height]] // neg y
    }
    else {
      return direction 
        ? [[0, 0], [width, 0], [width, height], [0, height]] // pos z
        : [[width, 0], [0, 0], [0, height], [width, height]] // neg z
    }
  })(axisIndex, direction)
    
  for (let i = 0; i < 4; i++) {
    let x = 0, y = 0, z = 0
    if (axisIndex === 0) {
      x = depth + direction
      y = v + offsets[i][1] 
      z = u + offsets[i][0]
    }
    if (axisIndex === 1) {
      x = u + offsets[i][0]
      y = depth + direction
      z = v + offsets[i][1]
    }
    if (axisIndex === 2) {
      x = u + offsets[i][0]
      y = v + offsets[i][1]
      z = depth + direction
    }

    points.push([x, y, z])
  }
  return points
}

export function packVertices(vertices: number[][], voxelType: number, axisIndex: number, direction: number, width: number, height: number) {
  const packedVertices: number[][] = []
  const packedQuad: number[] = []
  const normal = direction ? axisIndex * 2 : axisIndex * 2 + 1
  const vertexOrder = [0, 1, 2, 0, 2, 3]

  // x = (uv << 21) | (normal << 18) | (z << 12) | (y << 6) | x
  // y =  (height << 17) | (width << 12) | blockId
  // z = unused

  for (let i = 0; i < 4; i++) {
    const [x, y, z] = vertices[i]
    const uv = i
    const packedX = ((uv << 21) | (normal << 18) | (z << 12) | (y << 6) | x) >>> 0
    const packedY = ((height << 17) | (width << 12) | voxelType) >>> 0
    const packedZ = 0
    packedVertices.push([packedX, packedY, packedZ])
  }
  for (let i = 0; i < 6; i++) {
    packedQuad.push(...packedVertices[vertexOrder[i]])
  }
  return packedQuad
}

export function genThroughAxisFaces(binaryVoxelArray: Uint32Array, chunkSize: number): Uint32Array {
  const binaryAxisRows = new Uint32Array(chunkSize * chunkSize * 6)
  for (let v = 0; v < chunkSize; v++) {
    for (let u = 0; u < chunkSize; u++) {
      const xBinary = binaryVoxelArray[u + v * chunkSize + (chunkSize * chunkSize * 0)];
      const yBinary = binaryVoxelArray[u + v * chunkSize + (chunkSize * chunkSize * 1)];
      const zBinary = binaryVoxelArray[u + v * chunkSize + (chunkSize * chunkSize * 2)];

      const { PosFaces: xPos, NegFaces: xNeg } = posNegFacesThroughAxis(xBinary);
      const { PosFaces: yPos, NegFaces: yNeg } = posNegFacesThroughAxis(yBinary); 
      const { PosFaces: zPos, NegFaces: zNeg } = posNegFacesThroughAxis(zBinary);

      binaryAxisRows[u + v * chunkSize + (chunkSize * chunkSize * 0)] = xPos
      binaryAxisRows[u + v * chunkSize + (chunkSize * chunkSize * 1)] = xNeg
      binaryAxisRows[u + v * chunkSize + (chunkSize * chunkSize * 2)] = yPos
      binaryAxisRows[u + v * chunkSize + (chunkSize * chunkSize * 3)] = yNeg
      binaryAxisRows[u + v * chunkSize + (chunkSize * chunkSize * 4)] = zPos
      binaryAxisRows[u + v * chunkSize + (chunkSize * chunkSize * 5)] = zNeg
    }
  }
  return binaryAxisRows
}

export function posNegFacesThroughAxis(binaryRow: number) {
  const NegShift = (binaryRow << 1) >>> 0;
  const PosShift = (binaryRow >>> 1) >>> 0;

  const NegAir = (~NegShift) >>> 0;
  const PosAir = (~PosShift) >>> 0;

  const NegFaces = (binaryRow & NegAir) >>> 0;
  const PosFaces = (binaryRow & PosAir) >>> 0;

  return { PosFaces, NegFaces };
}

function createAxis(chunkSize: number): Uint32Array[][] {
  return [
    Array.from({ length: chunkSize }, () => new Uint32Array(chunkSize)),
    Array.from({ length: chunkSize }, () => new Uint32Array(chunkSize)),
    Array.from({ length: chunkSize }, () => new Uint32Array(chunkSize)),
    Array.from({ length: chunkSize }, () => new Uint32Array(chunkSize)),
    Array.from({ length: chunkSize }, () => new Uint32Array(chunkSize)),
    Array.from({ length: chunkSize }, () => new Uint32Array(chunkSize)),
  ]
}

export function genCrossAxisFacePlanes(
  binaryAxisRows: Uint32Array,
  chunkSize: number
): Uint32Array[][] {
  const planes: Uint32Array[][] = createAxis(chunkSize)
  const axisOffset = chunkSize * chunkSize

  for (let axis = 0; axis < 6; axis++) {
    const direction = axis % 2 === 0 ? 1 : 0
    const dataOffset = axis * axisOffset

    for (let v = 0; v < chunkSize; v++) {
      for (let u = 0; u < chunkSize; u++) {
        const idx = u + v * chunkSize + dataOffset
        const depthRow = binaryAxisRows[idx]

        if (depthRow === 0) continue
        
        if (direction) {
          for (let depth = 0; depth < chunkSize; depth++) {
            const bitPos = chunkSize - 1 - depth
            const mask = (1 << bitPos) >>> 0
            const check = (mask & depthRow) >>> 0
            if (check) {
              planes[axis][depth][v] |= 1 << u
            }
          }
        } else {
          for (let depth = 0; depth < chunkSize; depth++) {
            const mask = (1 << depth) >>> 0
            const check = (mask & depthRow) >>> 0
            if (check) {
              planes[axis][depth][v] |= 1 << u
            }
          }
        }
      }
    }
  }
  return planes
}