import alea from "alea";
import { ChunkSize, TerrainGenParams } from "../components/unused/Terrain";
import { BLOCKS, Resource, RESOURCES } from "./BlocksData";
import * as SimplexNoise from "simplex-noise";
import {
  coordsXYZFromKey,
  indexFromXYZCoords,
  keyFromXZCoords,
} from "./helpers";
import { FractalNoise } from "./FractalNoise";

export interface NoiseGenerator {
  noise: SimplexNoise.NoiseFunction3D;
  resource: Resource;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  scarcity: number;
}

export function generateResources(
  chunkX: number,
  chunkZ: number,
  params: TerrainGenParams,
  blocksData: Uint16Array
) {
  const { width, height } = params.chunkSize;
  const gx = chunkX * width;
  const gz = chunkZ * width;

  const noiseGenerators: NoiseGenerator[] = RESOURCES.map((resource) => {
    return {
      noise: SimplexNoise.createNoise3D(alea(params.seed + resource.name)),
      resource,
      scaleX: resource.scale.x,
      scaleY: resource.scale.y,
      scaleZ: resource.scale.z,
      scarcity: resource.scarcity,
    };
  });

  for (let i = 0; i < noiseGenerators.length; i++) {
    const gen = noiseGenerators[i];
    const scaleY = gen.scaleY;
    const scaleZ = gen.scaleZ;
    const scaleX = gen.scaleX;
    const scarcity = gen.scarcity;

    for (let y = 0; y < height; y++) {
      const yScaled = y / scaleY;
      for (let z = 0; z < width; z++) {
        const gzScaled = (gz + z) / scaleZ;
        for (let x = 0; x < width; x++) {
          const blockIndex = indexFromXYZCoords(x, y, z, params.chunkSize);
          const value = gen.noise((gx + x) / scaleX, yScaled, gzScaled);

          if (value > scarcity) {
            blocksData[blockIndex] = gen.resource.id;
          }
        }
      }
    }
  } 
}

export function generateTerrain(
  chunkX: number,
  chunkZ: number,
  params: TerrainGenParams,
  blocksData: Uint16Array
) {
  const fractalNoise = new FractalNoise(params.fractalNoise, params.seed);
  const { offset } = params.fractalNoise;
  const { width, height } = params.chunkSize;
  const gx = chunkX * width;
  const gz = chunkZ * width;

  for (let x = 0; x < width; x++) {
    for (let z = 0; z < width; z++) {
      const value = fractalNoise.fractal2D(gx + x, gz + z) + offset;
      const adjustedHeight = Math.min(Math.floor(height * value), height - 1);
      const surfaceY = Math.max(0, adjustedHeight);
      const bedrockHeight = Math.random() > 0.5 ? 0 : 1;

      for (let y = 0; y < height; y++) {
        const index = indexFromXYZCoords(x, y, z, params.chunkSize);

        if (y === surfaceY) {
          blocksData[index] = BLOCKS.grass.id;
        } else if (y <= bedrockHeight) {
          blocksData[index] = BLOCKS.bedrock.id;
        } else if (y < surfaceY && blocksData[index] === BLOCKS.air.id) {
          blocksData[index] = BLOCKS.dirt.id;
        } else if (y > surfaceY) {
          blocksData[index] = BLOCKS.air.id;
        }
      }
    }
  }
}

export function generateTrees(
  chunkX: number,
  chunkZ: number,
  params: TerrainGenParams,
  blocksData: Uint16Array
) {
  const treeBuffer = 3;
  let surfaceY = 0;
  let trunkHeight = 0;
  const random = alea(`${params.seed}-${keyFromXZCoords(chunkX, chunkZ)}-trees`)

  function generateTrunk(x: number, z: number) {
    const { maxHeight, minHeight } = params.trees.trunk;
    trunkHeight = Math.round(random.fract53() * (maxHeight - minHeight) + minHeight);

    for (let y = 0; y < params.chunkSize.height; y++) {
      const index = indexFromXYZCoords(x, y, z, params.chunkSize);
      if (
        blocksData[index] === BLOCKS.grass.id ||
        blocksData[index] === BLOCKS.snow_dirt.id
      ) {
        surfaceY = y;
        break;
      }
    }
    for (let y = surfaceY; y <= surfaceY + trunkHeight; y++) {
      const index = indexFromXYZCoords(x, y, z, params.chunkSize);
      blocksData[index] = BLOCKS.oak_log.id;
    }
  }
  function generateCanopy(x: number, z: number) {
    const { maxRadius, minRadius } = params.trees.canopy;
    const radius = Math.round(random.fract53() * (maxRadius - minRadius) + minRadius);

    for (let dy = 0; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const distance = dx * dx + dy * dy + dz * dz <= radius * radius;
          if (distance && Math.random() < 0.75) {
            if (x + dx < 0 || x + dx >= params.chunkSize.width) continue;
            if (z + dz < 0 || z + dz >= params.chunkSize.width) continue;
            const y = surfaceY + trunkHeight + dy;
            const index = indexFromXYZCoords(x + dx, y, z + dz, params.chunkSize);
            if (blocksData[index] === BLOCKS.air.id) {
              blocksData[index] = BLOCKS.oak_leaves.id;
            }
          }
        }
      }
    }
  }

  for (let x = treeBuffer; x < params.chunkSize.width - treeBuffer; x++) {
    for (let z = treeBuffer; z < params.chunkSize.width - treeBuffer; z++) {
      if (random.fract53() < params.trees.density) {
        generateTrunk(x, z);
        generateCanopy(x, z);
      }
    }
  }
}

export function applyChunkDiffs(
  chunkX: number,
  chunkZ: number,
  diffs: Record<string, { blockId: number }>,
  blocksData: Uint16Array,
  size: ChunkSize
) {
  if (!diffs) return blocksData;
  const minX = chunkX * size.width;
  const minZ = chunkZ * size.width;
  const maxX = minX + size.width;
  const maxZ = minZ + size.width;

  for (const [key, diff] of Object.entries(diffs)) {
    const coords = coordsXYZFromKey(key);
    if (coords.x < minX || coords.x >= maxX) continue;
    if (coords.z < minZ || coords.z >= maxZ) continue;
    const index = indexFromXYZCoords(coords.x, coords.y, coords.z, size)
    blocksData[index] = diff.blockId;
  }
}
