import { Vector2 } from "three";
import { ChunkSize, TerrainGenParams } from "../components/unused/Terrain";
import { FractalNoise } from "./FractalNoise";
import * as THREE from "three";

export function measureTime<T>(fn: () => T, label: string = "Function"): T {
  const start = performance.now();
  try {
    const result = fn();
    const end = performance.now();
    const duration = end - start;
    console.log(`${label}: ${duration.toFixed(2)} ms`);
    return result;
  } catch (error) {
    const end = performance.now();
    const duration = end - start;
    console.log(`${label} failed after ${duration.toFixed(2)} ms`);
    throw error;
  }
}

export function getDirections(num: number) {
  return [
    { dx: num, dy: 0, dz: 0 },
    { dx: -num, dy: 0, dz: 0 },
    { dx: 0, dy: num, dz: 0 },
    { dx: 0, dy: -num, dz: 0 },
    { dx: 0, dy: 0, dz: num },
    { dx: 0, dy: 0, dz: -num },
    { dx: num, dy: num, dz: 0 },
    { dx: -num, dy: num, dz: 0 },
    { dx: 0, dy: num, dz: num },
    { dx: 0, dy: num, dz: -num },
  ];
}

export function indexFromXYZCoords(
  x: number,
  y: number,
  z: number,
  chunkSize: ChunkSize,
): number {
  const voxelX = ((x % chunkSize.width) + chunkSize.width) % chunkSize.width | 0;
  const voxelY = ((y % chunkSize.height) + chunkSize.height) % chunkSize.height | 0;
  const voxelZ = ((z % chunkSize.width) + chunkSize.width) % chunkSize.width | 0;
  return (
    voxelY * (chunkSize.width * chunkSize.width) +
    voxelZ * chunkSize.width +
    voxelX
  );
}

export function coordsFromIndex(
  index: number,
  chunkSize: ChunkSize,
): { x: number; y: number; z: number } {
  const x = index % chunkSize.width;
  const z = Math.floor(index / chunkSize.width) % chunkSize.width;
  const y = Math.floor(index / (chunkSize.width * chunkSize.width)) % chunkSize.height;
  return { x, y, z };
}

export function keyFromXZCoords(x: number, z: number): string {
  return `${x},${z}`;
}

export function keyFromXYZCoords(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function coordsXYZFromKey(key: string): {
  x: number;
  y: number;
  z: number;
} {
  const [x, y, z] = key.split(",").map(Number);
  return { x, y, z };
}

export function coordsXZFromKey(key: string): { x: number; z: number } {
  const [x, z] = key.split(",").map(Number);
  return { x, z };
}

export function getHeightOfBlock(
  chunkX: number,
  chunkZ: number,
  blockX: number,
  blockZ: number,
  params: TerrainGenParams
): number {
  const fractalNoise = new FractalNoise(params.fractalNoise, params.seed);
  const value = fractalNoise.fractal2D(
    chunkX * params.chunkSize.width + blockX,
    chunkZ * params.chunkSize.width + blockZ
  );
  const offset = params.fractalNoise.offset;
  const scaledNoise = value + offset;
  const adjustedHeight = Math.min(
    Math.floor(params.chunkSize.height * scaledNoise),
    params.chunkSize.height - 1
  );
  const height = Math.max(0, adjustedHeight);
  return height;
}

export function worldToChunkCoords(
  x: number,
  y: number,
  z: number,
  chunkSize: { width: number; height: number }
): {
  chunk: { x: number; y: number; z: number };
  voxel: { x: number; y: number; z: number };
} {
  const chunkCoords = {
    x: Math.floor(x / chunkSize.width),
    y: Math.floor(y / chunkSize.height),
    z: Math.floor(z / chunkSize.width),
  };
  const voxelX = ((x % chunkSize.width) + chunkSize.width) % chunkSize.width | 0;
  const voxelY = ((y % chunkSize.height) + chunkSize.height) % chunkSize.height | 0;
  const voxelZ = ((z % chunkSize.width) + chunkSize.width) % chunkSize.width | 0;
  const voxelCoords = {
    x: voxelX,
    y: voxelY,
    z: voxelZ,
  };
  return { chunk: chunkCoords, voxel: voxelCoords };
}

export function generateUniquePlayerID() {
  return `player_${crypto.randomUUID()}`;
}

export const SecureStorage = {
  setItem: (key: string, value: any) => {
    try {
      const encryptedValue = btoa(JSON.stringify(value));
      localStorage.setItem(key, encryptedValue);
    } catch (error) {
      console.error("Storage error:", error);
    }
  },
  getItem: (key: string) => {
    try {
      const encryptedValue = localStorage.getItem(key);
      return encryptedValue ? JSON.parse(atob(encryptedValue)) : null;
    } catch (error) {
      console.error("Retrieval error:", error);
      return null;
    }
  },
};

export function getVisibleChunks(
  pos: { x: number; y: number; z: number },
  chunkSize: ChunkSize,
  drawDistance: number
) {
  const visibleChunks = [];
  const coords = worldToChunkCoords(pos.x, pos.y, pos.z, chunkSize);

  for (
    let x = coords.chunk.x - drawDistance;
    x <= coords.chunk.x + drawDistance;
    x++
  ) {
    for (
      let z = coords.chunk.z - drawDistance;
      z <= coords.chunk.z + drawDistance;
      z++
    ) {
      const dx = x - coords.chunk.x;
      const dz = z - coords.chunk.z;
      if (dx * dx + dz * dz <= drawDistance * drawDistance) {
        visibleChunks.push({ x, y: coords.chunk.y, z });
      }
    }
  }

  return visibleChunks;
}

export function spiralGridCoords(
  startRadius: number,
  endRadius: number,
  startCoords: { x: number; z: number }
): THREE.Vector3[] {
  const startX = startCoords.x;
  const startZ = startCoords.z;
  const coords: THREE.Vector3[] = [];
  const set = new Set<string>();
  let ring = startRadius;
  let direction = 0;
  let dirCounter = 0;
  const directions = [
    { dx: 1, dz: 0 },
    { dx: 0, dz: -1 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
  ];
  let currentX = 0;
  let currentZ = 0;
  while (ring <= endRadius && ring >= startRadius) {
    if (!set.has(keyFromXZCoords(currentX, currentZ))) {
      if (Math.abs(currentX) >= startRadius || Math.abs(currentZ) >= startRadius) {
        coords.push(new THREE.Vector3(currentX + startX, 0, currentZ + startZ));
      }
      set.add(keyFromXZCoords(currentX, currentZ));
    }

    if (dirCounter >= 3) ring++;
    if (Math.abs(currentX + directions[direction].dx) < ring && Math.abs(currentZ + directions[direction].dz) < ring) {
      currentX += directions[direction].dx;
      currentZ += directions[direction].dz;
      dirCounter = 0;
      if (set.has(keyFromXZCoords(currentX, currentZ))) {
        ring++;
        direction = 0;
      }
    } else {
      direction = (direction + 1) % 4;
      dirCounter++;
    }
  }
  return coords;
}


export function objectDifference(objA: Record<string, any>, objB: Record<string, any>) {
  // Return the difference objA that is not in objB
  const diff = { ...objA };
  for (let k in objB) {
    delete diff[k];
  }
  return diff;
}

export function objectIntersection(objA: Record<string, any>, objB: Record<string, any>) {
  const intersection: Record<string, any> = {};
  for (let k in objB) {
    if (k in objA) {
      intersection[k] = objA[k];
    }
  }
  return intersection;
}
