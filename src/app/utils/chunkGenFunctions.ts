import { TerrainGenParams } from "../components/TerrainManager";
import { blockIDToBlock, BLOCKS, Resource} from "./BlocksData";
import * as SimplexNoise from "simplex-noise";
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
  heightMap: Uint16Array,
  params: TerrainGenParams,
  fractalNoise: FractalNoise, 
  wCoords: { x: number; y: number; z: number }
) {
  const value = heightMap[pos.x + pos.z * params.chunkSize];
  if (value === 0) {
    const noiseValue = fractalNoise.fractal2D(pos.x + wCoords.x, pos.z + wCoords.z);
    const heightValue = (noiseValue + 1) / 2;
    const blockHeight = Math.floor(heightValue * params.maxWorldHeight);
    heightMap[pos.x + pos.z * params.chunkSize] = blockHeight;
    return blockHeight;
  }
  return value;
}

export function terrainNoiseValue(
  pos: { x: number; z: number },
  maxHeight: number,
  noiseMap: Uint16Array,
  params: TerrainGenParams,
  noiseFunc: SimplexNoise.NoiseFunction2D,
  wCoords: { x: number; y: number; z: number }
) {
  const value = noiseMap[pos.x + pos.z * params.chunkSize];
  if (value === 0) {
    const noiseValue = noiseFunc((pos.x + wCoords.x) / 80, (pos.z + wCoords.z) / 80);
    const heightValue = (noiseValue + 1) / 2;
    const res = Math.floor(heightValue * maxHeight);
    return res;
  }
  return value;
}

export function getTerrainXYZ(
  pos: { x: number; y: number; z: number },
  terrainHeight: number,
  dirtDepth: number,
  mountainHeight: number,
  snowHeight: number,
  sandDepth: number,
  waterLevel: number,
) {
  if (pos.y > terrainHeight && pos.y <= waterLevel) return BLOCKS.water.id;
  if (terrainHeight <= waterLevel && pos.y >= terrainHeight - sandDepth && pos.y <= terrainHeight) return BLOCKS.sand.id
  if (terrainHeight > mountainHeight && pos.y <= terrainHeight) return BLOCKS.stone.id;
  if (terrainHeight > snowHeight && pos.y === terrainHeight + 1) return BLOCKS.snow.id;
  if (pos.y >= mountainHeight - dirtDepth && pos.y <= terrainHeight) return BLOCKS.dirt.id;
  if (pos.y >= terrainHeight - dirtDepth && pos.y < terrainHeight) return BLOCKS.dirt.id;
  
  if (pos.y === terrainHeight) return BLOCKS.grass.id;
  if (pos.y > terrainHeight) return BLOCKS.air.id;
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
        const blockData = blockIDToBlock[voxel]
        
        const adjacentCoords = getCoordsForAdjacentVoxel(x, y, z, size)
        for (let axis = 0; axis < adjacentCoords.length; axis++) {
          let depth = 0, u = 0, v = 0
          if (axis === 0 || axis === 1) {
            depth = x
            u = z
            v = y
          }
          if (axis === 2 || axis === 3) {
            depth = y
            u = x
            v = z
          }
          if (axis === 4 || axis === 5) {
            depth = z
            u = x
            v = y
          }

          const [ax, ay, az] = adjacentCoords[axis]
          const chunkBoundsFlag = az >= size || az < 0 || ay >= size || ay < 0 || ax >= size || ax < 0
          if (chunkBoundsFlag) {
            const vertices = getQuadPoints(axis, depth, u, v, 1, 1)
            const packedQuad = packVertices(vertices, voxel, axis, 1, 1)
            packedVertices.push(...packedQuad)
            continue
          }

          const aIndex = ax + ay * size + az * size * size
          const aVoxel = voxelArray[aIndex]
          const aBlockData = blockIDToBlock[aVoxel]
          if (aVoxel === 0 || (aBlockData.transparent && !blockData.transparent)) {
            const vertices = getQuadPoints(axis, depth, u, v, 1, 1)
            const packedQuad = packVertices(vertices, voxel, axis, 1, 1)
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

  for (const [axis, planes] of crossAxisPlanes.entries()) {
    for (let depth = 0; depth < size; depth++) {
      const plane = planes[depth]
      if (!plane) continue;

      for (let v = 0; v < size; v++) {
        const binary = plane[v]
        if (!binary) continue;

        let width = 0
        let height = 0
        let startU = 0
        let quadMask = 0 >>> 0
        let currentVoxelType = 0

        for (let u = 0; u < size; u++) {
          const bitMask = (1 << u) >>> 0
          const bit = (binary & bitMask) >>> 0
          if (!bit) continue
          const reachedEnd = u === size - 1
          
          let currentIndex = 0
          if (axis === 0 || axis === 1) {
            currentIndex = depth + v * size + (u * size * size);
          }
          if (axis === 2 || axis === 3) {
            currentIndex = u + depth * size + (v * size * size);
          }
          if (axis === 4 || axis === 5) {
            currentIndex = u + v * size + (depth * size * size);
          }

          currentVoxelType = voxelArray[currentIndex]
          if (currentVoxelType) {
            if (quadMask === 0) startU = u
            quadMask = (quadMask | bitMask) >>> 0
            width++
          }
          
          if (!reachedEnd) {
            const nextBitMask = (1 << (u + 1)) >>> 0
            const nextBit = binary & nextBitMask

            let nextIndex = 0
            if (axis === 0 || axis === 1) {
              nextIndex = depth + v * size + ((u + 1)  * size * size);
            }
            if (axis === 2 || axis === 3) {
              nextIndex = (u + 1) + depth * size + (v * size * size);
            }
            if (axis === 4 || axis === 5) {
              nextIndex = (u + 1) + v * size + (depth * size * size);
            }

            const nextVoxelType = voxelArray[nextIndex]
            if (nextBit && nextVoxelType === currentVoxelType) continue
          }

          const wipeMask = (~(quadMask >>> 0)) >>> 0

          for (let h = v; h < size; h++) {
            let voxelSameFlag = true
            const bitMask = (plane[h] & (quadMask >>> 0)) >>> 0
            const endU = startU + width

            for (let w = startU; w < endU; w++) {
              const mask = (1 << w) >>> 0
              if (!((quadMask >>> 0) & mask)) continue
              let index = 0
              if (axis === 0 || axis === 1) {
                index = depth + h * size + (w * size * size);
              }
              if (axis === 2 || axis === 3) {
                index = w + depth * size + (h * size * size);
              }
              if (axis === 4 || axis === 5) {
                index = w + h * size + (depth * size * size);
              }
              const vtype = voxelArray[index]
              if (vtype !== currentVoxelType) voxelSameFlag = false
              if (!voxelSameFlag) break
            }

            if (bitMask === (quadMask >>> 0) && voxelSameFlag) {
              height++
              plane[h] &= wipeMask
            } else {
              break
            }
          }

          const vertices = getQuadPoints(axis, depth, startU, v, width, height)
          const packedQuad = packVertices(vertices, currentVoxelType, axis, width, height)
          packedVertices.push(...packedQuad)

          width = 0
          height = 0
          quadMask = 0 >>> 0
        }
      }
    }
  }
  packedVertices.push(0, 0, 0)
  return packedVertices
}

export function getQuadPoints(axisIndex: number, depth: number, u: number, v: number, width: number, height: number) {
  const points: number[][] = []
  let offsets: number[][] = []
  const w = width
  const h = height
  if (axisIndex === 0) offsets = [[w, 0], [0, 0], [0, h], [w, h]] // pos x
  if (axisIndex === 1) offsets = [[0, 0], [w, 0], [w, h], [0, h]] // neg x
  if (axisIndex === 2) offsets = [[w, 0], [0, 0], [0, h], [w, h]] // pos y
  if (axisIndex === 3) offsets = [[0, 0], [w, 0], [w, h], [0, h]] // neg y
  if (axisIndex === 4) offsets = [[0, 0], [w, 0], [w, h], [0, h]] // pos z
  if (axisIndex === 5) offsets = [[w, 0], [0, 0], [0, h], [w, h]] // neg z
    
  for (let i = 0; i < 4; i++) {
    let x = 0, y = 0, z = 0
    if (axisIndex === 0 || axisIndex === 1) {
      x = axisIndex % 2 === 0 ? depth + 1 : depth
      y = v + offsets[i][1]
      z = u + offsets[i][0]
    }
    if (axisIndex === 2 || axisIndex === 3) {
      x = u + offsets[i][0]
      y = axisIndex % 2 === 0 ? depth + 1 : depth
      z = v + offsets[i][1]
    }
    if (axisIndex === 4 || axisIndex === 5) {
      x = u + offsets[i][0]
      y = v + offsets[i][1]
      z = axisIndex % 2 === 0 ? depth + 1 : depth
    }

    points.push([x, y, z])
  }
  return points
}

export function packVertices(vertices: number[][], voxelType: number, axisIndex: number, width: number, height: number) {
  const packedVertices: number[][] = []
  const packedQuad: number[] = []
  const normal = axisIndex
  const vertexOrder = [0, 1, 2, 0, 2, 3]

  // x = (uv << 21) | (normal << 18) | (z << 12) | (y << 6) | x
  // y =  (height << 17) | (width << 12) | blockId
  // z = unused

  for (let i = 0; i < 4; i++) {
    const [x, y, z] = vertices[i]
    const uv = i
    const packedX = ((uv << 21) | (normal << 18) | (z << 12) | (y << 6) | x) >>> 0
    const packedY = (((height - 1) << 17) | ((width - 1) << 12) | voxelType) >>> 0
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

  for (let axis = 0; axis < planes.length; axis++) {
    const dataOffset = axis * axisOffset

    for (let v = 0; v < chunkSize; v++) {
      for (let u = 0; u < chunkSize; u++) {
        const idx = u + v * chunkSize + dataOffset
        const binaryVoxel = binaryAxisRows[idx]

        if (binaryVoxel === 0) continue

        for (let depth = 0; depth < chunkSize; depth++) {
          const mask = (1 << depth) >>> 0
          const check = (mask & binaryVoxel) >>> 0
          if (check) {
            planes[axis][depth][v] |= 1 << u
          }
        }
      }
    }
  }
  return planes
}