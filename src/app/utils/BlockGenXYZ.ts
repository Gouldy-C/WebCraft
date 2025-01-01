import { BLOCKS, Resource, RESOURCES } from "../utils/BlocksData";
import { TerrainGenParams } from "../components/unused/Terrain";
import { FractalNoise } from "./FractalNoise";
import { keyFromXZCoords, RNG } from "./helpers";
import * as SimplexNoise from "simplex-noise";


export interface ResourceGenerator {
  noise3D: SimplexNoise.NoiseFunction3D;
  resource: Resource;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  scarcity: number;
}

export class BlockGenXYZ {
  params: TerrainGenParams;
  fractalNoise: FractalNoise
  resourceGenerators: ResourceGenerator[]
  previousVoxel: {x: number, y: number, z: number} = {x: -Infinity, y: -Infinity, z: -Infinity};
  previousSurfaceHeight: {surfaceHeight: number, heightValue: number} = {surfaceHeight: -Infinity, heightValue: -Infinity}

  constructor(params: TerrainGenParams) {
    this.params = params
    this.fractalNoise = new FractalNoise(params.fractalNoise, params.seed);
    this.resourceGenerators = RESOURCES.map((resource) => {
      return {
        noise3D: SimplexNoise.createNoise3D(RNG(params.seed + resource.name)),
        resource,
        scaleX: resource.scale.x,
        scaleY: resource.scale.y,
        scaleZ: resource.scale.z,
        scarcity: resource.scarcity,
      };
    });
  }

  getBlockIdXYZ(x: number, y: number, z: number) {
    const heights = this.getHeightsXYZ(x, y, z)

    const terrain = this._getTerrainXYZ(x, y, z, heights)
    if (terrain) return terrain

    const isTree = this.isTreeAtXYZ(x, y, z, this.params, heights)
    if (isTree) return this.generateTreeXYZ(x, y, z, heights)

    return null
  }

  getHeightsXYZ(x: number, y: number, z: number) {
    let heights = null
    if (this.previousVoxel.x === x && this.previousVoxel.z === z) {
      heights = this.previousSurfaceHeight
    } else {
      heights = this._getSurfaceHeightXYZ(x, y, z)
      this.previousVoxel = {x, y, z}
      this.previousSurfaceHeight = heights
    }
    return heights
  }


  _getTerrainXYZ(x: number, y: number, z: number, heights?: {surfaceHeight: number, heightValue: number}) {
    const {surfaceHeight, heightValue} = heights || this.getHeightsXYZ(x, y, z)
    if (y > surfaceHeight) return null

    const isBedrock = y <= (Math.random() > 0.5 ? 0 : 1)
    const resource = this._getResourceXYZ(x, y, z, heights!)
    
    if (resource && y <= surfaceHeight) return resource
    if (y === surfaceHeight) return BLOCKS.grass.id;
    if (isBedrock) return BLOCKS.bedrock.id;
    if (y < surfaceHeight && y > heightValue - (Math.random() * 0.1)) return BLOCKS.dirt.id;
    if (y < surfaceHeight) return BLOCKS.stone.id

    return null
  }

  _getResourceXYZ(x: number, y: number, z: number, heights: {surfaceHeight: number, heightValue: number}) {
    if (y > heights.surfaceHeight) return null
    
    for (let i = 0; i < this.resourceGenerators.length; i++) {
      const resource = this.resourceGenerators[i];
      const scaleY = resource.scaleY;
      const scaleZ = resource.scaleZ;
      const scaleX = resource.scaleX;
      const scarcity = resource.scarcity;
  
      const yS = y / scaleY;
      const zS= z / scaleZ;
      const xS = x / scaleX;
  
      const value = resource.noise3D(xS, yS, zS);
  
      if (value > scarcity) {
        return resource.resource.id;
      }
    } 
    return null
  }

  _getSurfaceHeightXYZ(x: number, y: number, z: number) {
    const { height } = this.params.chunkSize;
    const heightValue = this.fractalNoise.fractal2D(x, z)
    const upperLimit = Math.min(Math.floor(height * heightValue), height - 1);
    const surfaceHeight = Math.max(0, upperLimit);
    return {surfaceHeight, heightValue}
  }

  // isAirAtXYZ(x: number, y: number, z: number) {
  //   return false
  // }

  isTreeAtXYZ(
    x: number,
    y: number,
    z: number,
    params: TerrainGenParams,
    heights?: {surfaceHeight: number, heightValue: number}
  ) {
    const { surfaceHeight } = heights ? heights : this.getHeightsXYZ(x, y, z);
    if (y <= surfaceHeight || y > (surfaceHeight + params.trees.trunk.maxHeight)) return false
    const width = params.chunkSize.width;
    const treeBuffer = params.trees.buffer;
    const density = params.trees.density;
    if (Math.abs(x % width) < treeBuffer || Math.abs(x % width) > width - treeBuffer) return false;
    if (Math.abs(z % width) < treeBuffer || Math.abs(z % width) > width - treeBuffer) return false;
    const rng = RNG(params.seed + "tree" + keyFromXZCoords(x, z));
    if (rng.fract53() < density) return true;
    return false;
  }

  // isCanopyAtXYZ(x: number, y: number, z: number, params: TerrainGenParams, heights?: {surfaceHeight: number, heightValue: number}) {
  //   const maxRadius = params.trees.canopy.maxRadius
  //   const { surfaceHeight } = heights ? heights : this.getHeightsXYZ(x, y, z);
  //   if (y <= surfaceHeight && y > (surfaceHeight + maxRadius + params.trees.trunk.maxHeight)) return false
  //   const potentialTrees = []
  //   for (let dx = -maxRadius; dx <= maxRadius; dx++) {
  //     for (let dz = -maxRadius; dz <= maxRadius; dz++) {
  //       if (this.isTreeAtXYZ(x + dx, y, z + dz, params)) {
  //         potentialTrees.push({x: x + dx, y, z: z + dz})
  //       }
  //     }
  //   }
  //   if (potentialTrees.length === 0) return false
  //   for (let i = 0; i < potentialTrees.length; i++) {
  //     const tree = this.generateTreeXYZ(potentialTrees[i].x, potentialTrees[i].y, potentialTrees[i].z)
  //     if (tree.canopy.some((coord) => coord.x === x && coord.y === y && coord.z === z)) {
  //       return true
  //     }
  //   }
  //   return false
  // }

  // isTrunkAtXYZ(x: number, y: number, z: number, params: TerrainGenParams, heights?: {surfaceHeight: number, heightValue: number}) {
  //   const { surfaceHeight } = heights ? heights : this.getHeightsXYZ(x, y, z);
  //   if (y <= surfaceHeight) return false
  //   if (!this.isTreeAtXYZ(x, y, z, params)) return false
  //   const tree = this.generateTreeXYZ(x, y, z)
  //   return tree.trunk.some((coord) => coord.x === x && coord.y === y && coord.z === z)
  // }

  generateTreeXYZ(x: number, y: number, z: number, heights?: {surfaceHeight: number, heightValue: number}) {
    const { surfaceHeight } = heights ? heights : this.getHeightsXYZ(x, y, z)
    if (y <= surfaceHeight) return null
    const { maxHeight, minHeight } = this.params.trees.trunk;
    const trunkHeight = Math.round(RNG(this.params.seed + "tree" + keyFromXZCoords(x, z)).fract53() * (maxHeight - minHeight) + minHeight);
    if (y > trunkHeight + surfaceHeight) return null
    return BLOCKS.oak_log.id
  }

  generateCanopyXYZ(x: number, y: number, z: number, trunkHeight: number) {
    const offsets = 0
    const { maxRadius, minRadius } = this.params.trees.canopy;
    const radius = Math.round(RNG(this.params.seed + "tree" + x + z).fract53() * (maxRadius - minRadius) + minRadius);
    const canopyMinY = y + trunkHeight - radius + offsets
    const canopyMaxY = y + trunkHeight + (radius * 2) + offsets
    const canopyCoords: { x: number; y: number; z: number }[] = []

    for (let dy = canopyMinY; dy <= canopyMaxY; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const distance = dx * dx + dy * dy + dz * dz <= radius * radius;
          if (distance && RNG(this.params.seed + "tree" + keyFromXZCoords(x + dx, z + dz)).fract53() < 0.75) {
            canopyCoords.push({x: x + dx, y: y + dy, z: z + dz});
          }
        }
      }
    }
    return canopyCoords
  }
}