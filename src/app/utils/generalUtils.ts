import { TerrainGenParams } from "../components/TerrainManager";
import { FractalNoise } from "./classes/FractalNoise";
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
  chunkSize: number,
): number {
  const voxelX = ((x % chunkSize) + chunkSize) % chunkSize | 0;
  const voxelZ = ((z % chunkSize) + chunkSize) % chunkSize | 0;
  const voxelY = ((y % chunkSize) + chunkSize) % chunkSize | 0;
  return (
    voxelY * (chunkSize * chunkSize) +
    voxelZ * chunkSize +
    voxelX
  );
}

export function coordsFromIndex(
  index: number,
  chunkSize: number,
): { x: number; y: number; z: number } {
  const x = index % chunkSize;
  const z = Math.floor(index / chunkSize) % chunkSize;
  const y = Math.floor(index / (chunkSize * chunkSize)) % chunkSize;
  return { x, y, z };
}


// Getting Keys/ Ids and parsing Keys/ Ids

export function chunkKeyFromXYZ(x: number, y: number, z: number, chunkSize: number): string {
  const { x:chunkX, y: chunkY, z:chunkZ } = worldToChunkCoords(x, y, z, chunkSize).chunk
  return `${chunkX},${chunkY},${chunkZ}`;
}

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
// export function getHeightOfBlock(x: number, z: number, params: TerrainGenParams): number {
//   const fractalNoise = new FractalNoise(params.fractalNoise, params.seed);
//   const value = fractalNoise.fractal2D(x, z);
//   const adjustedHeight = Math.min(
//     Math.floor(params.chunkSize * value),
//     params.chunkSize - 1
//   );
//   const height = Math.max(0, adjustedHeight);
//   return height;
// }


// Coordinates Conversions

export function worldToChunkCoords(
  x: number,
  y: number,
  z: number,
  chunkSize: number
): {
  chunk: { x: number; y: number; z: number };
  voxel: { x: number; y: number; z: number };
} {
  const chunkCoords = {
    x: Math.floor(x / chunkSize),
    y: Math.floor(y / chunkSize),
    z: Math.floor(z / chunkSize),
  };
  const voxelX = ((x % chunkSize) + chunkSize) % chunkSize | 0;
  const voxelY = ((y % chunkSize) + chunkSize) % chunkSize | 0;
  const voxelZ = ((z % chunkSize) + chunkSize) % chunkSize | 0;
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
  const keys: Set<string> = new Set();
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
    keys.add(keyFromXYZCoords(currentX + startCoords.x, 0, currentZ + startCoords.z));

    if (dirCounter >= 3) ring++;
    if (Math.abs(currentX + directions[direction].dx) < ring && Math.abs(currentZ + directions[direction].dz) < ring) {
      currentX += directions[direction].dx;
      currentZ += directions[direction].dz;
      dirCounter = 0;
      if (keys.has(keyFromXYZCoords(currentX + startCoords.x, 0, currentZ + startCoords.z))) {
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
  const _difference: Record<string, any> = {};
  for (let k in objA) {
    if (k in objB) continue;
    _difference[k] = objA[k];
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
  const _difference = new Set<T>();
  for (const elem of setA) {
      if (setB.has(elem)) continue;
      _difference.add(elem);
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


// Math Utils

export function clamp(value: number, lowerBound: number, upperBound: number) {
  return Math.min(Math.max(value, lowerBound), upperBound);
}

export function normalize(currentValue: number, minValue: number, maxValue: number) {
  return (currentValue - minValue) / (maxValue - minValue);
}

export function randRange(minValue: number, maxValue: number) {
  return Math.random() * (maxValue - minValue) + minValue;
}

export function randInt(minValue: number, maxValue: number) {
  return Math.round(Math.random() * (maxValue - minValue) + minValue);
}

export function lerp(t: number, start: number, end: number) {
  return t * (end - start) + start;
}

export function smoothStep(t: number, start: number, end: number) {
  t = t * t * (3.0 - 2.0 * t);
  return t * (end - start) + start;
}

export function smootherStep(t: number, start: number, end: number) {
  t = t * t * t * (t * (t * 6 - 15) + 10);
  return t * (end - start) + start;
}
