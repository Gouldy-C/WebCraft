import { TerrainGenParams } from "../components/TerrainManager";
import { blockIDToBlock, BLOCKS, Resource} from "./BlocksData";
import * as SimplexNoise from "simplex-noise";
import { FractalNoise } from "./classes/FractalNoise";
import * as THREE from "three";
import { normalizeZeroBased } from "./generalUtils";

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
    const res = normalizeZeroBased(noiseValue, -1, 1) * params.maxWorldHeight;
    heightMap[pos.x + pos.z * params.chunkSize] = res;
    return res;
  }
  return value;
}

export function noiseValue2D(
  params: TerrainGenParams,
  noiseArray: Float32Array,
  noiseFunc: SimplexNoise.NoiseFunction2D,
  voxelPos: { x: number; z: number },
  chunkPos: { x: number; y: number; z: number },
  scale: { x: number; z: number }

) {
  const value = noiseArray[voxelPos.x + voxelPos.z * params.chunkSize];
  if (value === 0) {
    const noiseValue = noiseFunc((voxelPos.x + chunkPos.x) / scale.x, (voxelPos.z + chunkPos.z) / scale.z);
    noiseArray[voxelPos.x + voxelPos.z * params.chunkSize] = noiseValue;
    return noiseValue;
  }
  return value;
}

export function noise2DBiLerp(
  params: TerrainGenParams,
  cacheArray: Float32Array,
  noiseFn: SimplexNoise.NoiseFunction2D,
  voxelPos: { x: number, z: number },
  chunkPos: { x: number, y: number, z: number },
  scale: { x: number, z: number }
) {
  const sampleRate: number = params.terrainSampleRate;
  const size = params.chunkSize;
  const x = voxelPos.x
  const z = voxelPos.z

  const sampleX = Math.floor(x  / sampleRate) * sampleRate;
  const sampleZ = Math.floor(z / sampleRate) * sampleRate;

  const nextSampleX = Math.min(sampleX + sampleRate, size - 1);
  const nextSampleZ = Math.min(sampleZ + sampleRate, size - 1);

  const intervalX = nextSampleX - sampleX;
  const intervalZ = nextSampleZ - sampleZ;
  const tX = intervalX === 0 ? 0 : (x - sampleX) / intervalX;
  const tZ = intervalZ === 0 ? 0 : (z - sampleZ) / intervalZ;

  const smoothTX = THREE.MathUtils.smootherstep(tX, 0, 1);
  const smoothTZ = THREE.MathUtils.smootherstep(tZ, 0, 1);

  const heightValueA = noiseValue2D( params, cacheArray, noiseFn, { x: sampleX, z: sampleZ }, chunkPos, scale);
  const heightValueB = noiseValue2D(params, cacheArray, noiseFn, { x: nextSampleX, z: sampleZ }, chunkPos, scale);
  const heightValueC = noiseValue2D(params, cacheArray, noiseFn, { x: sampleX, z: nextSampleZ }, chunkPos, scale);
  const heightValueD = noiseValue2D(params, cacheArray, noiseFn, { x: nextSampleX, z: nextSampleZ }, chunkPos, scale);

  const heightValueX = THREE.MathUtils.lerp(heightValueA, heightValueB, smoothTX);
  const heightValueZ = THREE.MathUtils.lerp(heightValueC, heightValueD, smoothTX);
  const heightValue = THREE.MathUtils.lerp(heightValueX, heightValueZ, smoothTZ);

  cacheArray[x + z * size] = heightValue;
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

// export function culledMesher(voxelArray: Uint16Array, binaryData: Uint32Array, size: number) {
//   const packedVertices: number[] = []
//   for (let y = 0; y < size; y++) {
//     for (let z = 0; z < size; z++) {
//       for (let x = 0; x < size; x++) {
//         const index = x + y * size + z * size * size
//         const voxel = voxelArray[index]
        
//         if (voxel === 0) continue;
//         const blockData = blockIDToBlock[voxel]
        
//         const adjacentCoords = getCoordsForAdjacentVoxel(x, y, z, size)
//         for (let axis = 0; axis < adjacentCoords.length; axis++) {
//           let depth = 0, u = 0, v = 0
//           if (axis === 0 || axis === 1) {
//             depth = x
//             u = z
//             v = y
//           }
//           if (axis === 2 || axis === 3) {
//             depth = y
//             u = x
//             v = z
//           }
//           if (axis === 4 || axis === 5) {
//             depth = z
//             u = x
//             v = y
//           }

//           const [ax, ay, az] = adjacentCoords[axis]
//           const chunkBoundsFlag = az >= size || az < 0 || ay >= size || ay < 0 || ax >= size || ax < 0
//           if (chunkBoundsFlag) {
//             const vertices = getQuadPoints(axis, depth, u, v, 1, 1)
//             const packedQuad = packVertices(vertices, voxel, axis, 1, 1)
//             packedVertices.push(...packedQuad)
//             continue
//           }

//           const aIndex = ax + ay * size + az * size * size
//           const aVoxel = voxelArray[aIndex]
//           const aBlockData = blockIDToBlock[aVoxel]
//           if (aVoxel === 0 || (aBlockData.transparent && !blockData.transparent)) {
//             const vertices = getQuadPoints(axis, depth, u, v, 1, 1)
//             const packedQuad = packVertices(vertices, voxel, axis, 1, 1)
//             packedVertices.push(...packedQuad)
//           }
//         }
//       }
//     }
//   }
  
//   packedVertices.push(0, 0, 0)
//   return packedVertices
// }


export function binaryGreedyMesher(voxelArray: Uint16Array, binaryData: Uint32Array, size: number) {
  const vertices: number[] = []
  const indices: number[] = []
  const voxelInfo: number[] = []


  const throughAxisFaces = genThroughAxisFaces(binaryData, size)
  const crossAxisPlanes = genCrossAxisFacePlanes(throughAxisFaces, size)

  for (const [axis, planes] of crossAxisPlanes.entries()) {
    for (let depth = 0; depth < size; depth++) {
      const plane = planes[depth]
      if (!plane) continue;

      for (let v = 0; v < size; v++) {
        if (!plane[v]) continue;

        let width = 0
        let height = 0
        let startU = 0
        let quadMask = 0 >>> 0
        let currentVoxelType = 0

        for (let u = 0; u < size; u++) {
          const bitMask = (1 << u) >>> 0;
          if (!(plane[v] & bitMask)) continue;
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
            const nextBit = (plane[v] & nextBitMask) >>> 0

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
              plane[h] = (plane[h] & wipeMask) >>> 0
            } else {
              break
            }
          }

          const quadPoints = getQuadPoints(axis, depth, startU, v, width, height)
          const { verts, inds, voxel } = packVertices(quadPoints, currentVoxelType, axis, width, height, vertices.length)
          vertices.push(...verts)
          indices.push(...inds)
          voxelInfo.push(...voxel)

          width = 0
          height = 0
          quadMask = 0 >>> 0
        }
      }
    }
  }
  return { vertices, indices, voxelInfo }
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

export function packVertices(quadPoints: number[][], voxelType: number, axisIndex: number, width: number, height: number, verticesCount: number) {
  const verts: number[] = []
  const inds: number[] = []
  const voxel: number[] = []
  const verticesOrder = [0, 1, 2, 0, 2, 3]
  const count = verticesCount / 3
  const normal = axisIndex
  
  for (let i = 0; i < 4; i++) {
    verts.push(...quadPoints[i])
    const uv = i
    const packed1 = ((uv << 25) | (normal << 22) | ((height - 1) << 17) | ((width - 1) << 12) | voxelType) >>> 0
    const packed2 = 0
    voxel.push(packed1)
    voxel.push(packed2)
  }
  for (let n = 0; n < 6; n++) {
    inds.push(count + verticesOrder[n])
  }
  return { verts, inds, voxel }
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