import { ChunkSize, TerrainGenParams } from "../components/unused/Terrain";
import { FractalNoise } from "./FractalNoise";
import alea from "alea";

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


// RNG

export function RNG(seed: string) {
  return alea(seed);
}


// Basic Utils

export function getDirections(num: number) {
  return [
    { dx: num, dy: 0, dz: 0 },
    { dx: -num, dy: 0, dz: 0 },
    { dx: 0, dy: num, dz: 0 },
    { dx: 0, dy: -num, dz: 0 },
    { dx: 0, dy: 0, dz: num },
    { dx: 0, dy: 0, dz: -num },
  ];
}


// Indexing in a Chunk

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


// Getting Keys/ Ids and parsing Keys/ Ids

export function keyFromXZCoords(x: number, z: number): string {
  return `${x},${z}`;
}

export function keyFromXYZCoords(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function coordsXYZFromKey(key: string): {x: number; y: number; z: number } {
  const [x, y, z] = key.split(",")
  return { x: +x, y: +y, z: +z };
}

export function coordsXZFromKey(key: string): { x: number; z: number } {
  const [x, z] = key.split(",")
  return { x: +x, z: +z };
}

export function chunkKeyWithResolution(x: number, y: number, z: number, resolution: number): string {
  return keyFromXYZCoords(x, y, z) + "," + resolution.toString();
}

export function chunkCoordsWithResolutionFromKey(key: string): { x: number; y: number; z: number; resolution: number } {
  const [x, y, z, resolution] = key.split(",")
  return { x: +x, y: +y, z: +z, resolution: +resolution };
}

export function generateUniquePlayerID() {
  return `player_${crypto.randomUUID()}`;
}


// Voxel Utils

export function getHeightOfBlock(x: number, z: number, params: TerrainGenParams): number {
  const fractalNoise = new FractalNoise(params.fractalNoise, params.seed);
  const value = fractalNoise.fractal2D(x, z);
  const adjustedHeight = Math.min(
    Math.floor(params.chunkSize.height * value),
    params.chunkSize.height - 1
  );
  const height = Math.max(0, adjustedHeight);
  return height;
}


// Coordinates Conversions

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


export function spiralGridKeys(
  startRadius: number,
  endRadius: number,
  startCoords: { x: number; z: number }
) {
  const startX = startCoords.x;
  const startZ = startCoords.z;
  const keys: Set<string> = new Set();
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
      const startRadiusBool = Math.abs(currentX) >= startRadius || Math.abs(currentZ) >= startRadius;
      const circular = currentZ * currentZ + currentX * currentX <= endRadius* endRadius;
      if (startRadiusBool && circular) {
        keys.add(keyFromXYZCoords(currentX + startX, 0, currentZ + startZ));
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
  return keys;
}

// Object Utils

export function objectDifference(objA: Record<string, any>, objB: Record<string, any>) {
  // Return the difference objA that is not in objB
  const _difference: Record<string, any> = { ...objA };
  for (let k in objB) {
    delete _difference[k];
  }
  return _difference;
}

export function objectIntersection(objA: Record<string, any>, objB: Record<string, any>) {
  const _intersection: Record<string, any> = {};
  for (let k in objB) {
    if (k in objA) {
      _intersection[k] = objA[k];
    }
  }
  return _intersection;
}


// Set Utils

export function setDifference<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const _difference = new Set<T>(setA);
  for (const elem of setB) {
      _difference.delete(elem);
  }
  return _difference;
}

export function setIntersection<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const _intersection = new Set<T>();
  for (const elem of setB) {
      if (setA.has(elem)) {
          _intersection.add(elem);
      }
  }
  return _intersection;
}


//deprecated
// export function getVisibleChunks(
//   pos: { x: number; y: number; z: number },
//   chunkSize: ChunkSize,
//   drawDistance: number
// ) {
//   const visibleChunks = [];
//   const coords = worldToChunkCoords(pos.x, pos.y, pos.z, chunkSize);

//   for (
//     let x = coords.chunk.x - drawDistance;
//     x <= coords.chunk.x + drawDistance;
//     x++
//   ) {
//     for (
//       let z = coords.chunk.z - drawDistance;
//       z <= coords.chunk.z + drawDistance;
//       z++
//     ) {
//       const dx = x - coords.chunk.x;
//       const dz = z - coords.chunk.z;
//       if (dx * dx + dz * dz <= drawDistance * drawDistance) {
//         visibleChunks.push({ x, y: coords.chunk.y, z });
//       }
//     }
//   }

//   return visibleChunks;
// }
