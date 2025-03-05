import alea from "alea";
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

// RNG
export function RNG(seed: string | number) {
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
  chunkSize: number
): number {
  const voxelX = ((x % chunkSize) + chunkSize) % chunkSize | 0;
  const voxelZ = ((z % chunkSize) + chunkSize) % chunkSize | 0;
  const voxelY = ((y % chunkSize) + chunkSize) % chunkSize | 0;
  return voxelX + (voxelY * chunkSize) + (voxelZ * chunkSize * chunkSize)
}

export function coordsFromIndex(
  index: number,
  chunkSize: number
): { x: number; y: number; z: number } {
  const x = index % chunkSize;
  const y = Math.floor(index / chunkSize) % chunkSize;
  const z = Math.floor(index / (chunkSize * chunkSize)) % chunkSize;
  return { x, y, z };
}

// Getting Keys/ Ids and parsing Keys/ Ids
export function chunkKeyFromXYZ(
  x: number,
  y: number,
  z: number,
  chunkSize: number
): string {
  const {
    x: chunkX,
    y: chunkY,
    z: chunkZ,
  } = worldToChunkCoords(x, y, z, chunkSize).chunk;
  return `${chunkX},${chunkY},${chunkZ}`;
}

export function keyFromXZCoords(x: number, z: number): string {
  return `${x},${z}`;
}

export function keyFromXYZCoords(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function coordsXYZFromKey(key: string): {x: number, y: number, z: number} {
  const [x, y, z] = key.split(",");
  return { x: +x, y: +y, z: +z };
}

export function coordsXZFromKey(key: string): { x: number, z: number } {
  const [x, z] = key.split(",");
  return { x: +x, z: +z };
}

export function chunkKeyWithResolution(
  x: number,
  y: number,
  z: number,
  resolution: number
): string {
  return keyFromXYZCoords(x, y, z) + "," + resolution.toString();
}

export function chunkCoordsWithResolutionFromKey(key: string): {
  x: number;
  y: number;
  z: number;
  resolution: number;
} {
  const [x, y, z, resolution] = key.split(",");
  return { x: +x, y: +y, z: +z, resolution: +resolution };
}

export function generateUniquePlayerID() {
  return `player_${crypto.randomUUID()}`;
}

// Coordinates Conversions

export function worldToChunkCoords(
  x: number,
  y: number,
  z: number,
  chunkSize: number
): {
  chunk: THREE.Vector3;
  voxel: THREE.Vector3;
} {
  const chunkCoords = new THREE.Vector3(
    Math.floor(x / chunkSize),
    Math.floor(y / chunkSize),
    Math.floor(z / chunkSize),
  );
  const voxelX = ((x % chunkSize) + chunkSize) % chunkSize | 0;
  const voxelY = ((y % chunkSize) + chunkSize) % chunkSize | 0;
  const voxelZ = ((z % chunkSize) + chunkSize) % chunkSize | 0;
  const voxelCoords = new THREE.Vector3(
    voxelX,
    voxelY,
    voxelZ,
  );
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

export function spiralChunkKeys(
  startCoords: { x: number; y: number; z: number },
  hDrawDist: number,
  vDrawDist: number,
  vertChunks: number
) {
  const keys: Set<string> = new Set();
  
  function addYVariants(x: number, z: number) {
    let maxY = vertChunks
    let minY = 0
    if (startCoords.y < 0) {
      maxY = startCoords.y + vDrawDist
      minY = startCoords.y - vDrawDist
    }
    for (let y = minY; y <= maxY; y++) {
      keys.add(
        keyFromXYZCoords(
          startCoords.x + x,
          y,
          startCoords.z + z
        )
      );
    }
  }

  addYVariants(0, 0);

  // Process each ring from 1 to hDrawDist
  for (let ring = 1; ring <= hDrawDist; ring++) {
    for (let x = -ring; x <= ring; x++) {
      if (x === ring || x === -ring) {
        // Add entire row for x = ring and x = -ring
        for (let z = -ring; z <= ring; z++) {
          addYVariants(x, z);
        }
      } else {
        // Add top and bottom edges (z = ring and z = -ring)
        addYVariants(x, ring);
        addYVariants(x, -ring);
      }
    }
  }
  return keys;
}

// Object Utils
export function objectDifference(
  objA: Record<string, any>,
  objB: Record<string, any>
) {
  // Return the difference objA that is not in objB
  const _difference: Record<string, any> = {};
  for (let k in objA) {
    if (k in objB) continue;
    _difference[k] = objA[k];
  }
  return _difference;
}

export function objectIntersection(
  objA: Record<string, any>,
  objB: Record<string, any>
) {
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
export function normalizeNegOneBased(
  currentValue: number,
  minValue: number,
  maxValue: number
) {
  if (maxValue === minValue) return 0.5
  const normalized = 2 * ((currentValue - minValue) / (maxValue - minValue)) - 1;
  return Math.max(-1, Math.min(1, normalized))
}

export function normalizeZeroBased(
  currentValue: number,
  minValue: number,
  maxValue: number
) {
  if (maxValue === minValue) return 0.5
  const normalized = (currentValue - minValue) / (maxValue - minValue);
  return Math.max(0, Math.min(1, normalized))
}
