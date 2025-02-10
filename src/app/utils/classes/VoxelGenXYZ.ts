import { BLOCKS, Resource, RESOURCES } from "../BlocksData";
import { TerrainGenParams } from "../../components/TerrainManager";
import { FractalNoise } from "./FractalNoise";
import { clamp, keyFromXZCoords, RNG } from "../generalUtils";
import * as SimplexNoise from "simplex-noise";

export interface ResourceGenerator {
  noise3D: SimplexNoise.NoiseFunction3D;
  resource: Resource;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  scarcity: number;
}

export class VoxelGenXYZ {
  params: TerrainGenParams;
  fractalNoise: FractalNoise;
  resources: ResourceGenerator[];
  previousVoxel: { x: number; y: number; z: number } = {
    x: -Infinity,
    y: -Infinity,
    z: -Infinity,
  };
  previousSurfaceHeight: { surfaceHeight: number; heightValue: number } = {
    surfaceHeight: -Infinity,
    heightValue: -Infinity,
  };
  heights: Record<string, { surfaceHeight: number; heightValue: number }> = {};

  constructor(params: TerrainGenParams) {
    this.params = params;
    this.fractalNoise = new FractalNoise(params.fractalNoise, params.seed);
    this.resources = this._generateResources(params);
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


}
