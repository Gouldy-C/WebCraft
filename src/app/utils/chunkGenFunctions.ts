import alea from "alea";
import { ChunkSize, TerrainGenParams } from "../components/unused/Terrain";
import { BLOCKS, Resource, RESOURCES } from "./BlocksData";
import * as SimplexNoise from "simplex-noise";
import {
  coordsXYZFromKey,
  indexFromXYZCoords,
  keyFromXZCoords,
  RNG,
} from "./helpers";
import { FractalNoise } from "./FractalNoise";


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

