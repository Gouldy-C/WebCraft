import { BLOCKS } from "../BlocksData";
import { TerrainGenParams } from "../../components/unused/Terrain";
import {
  coordsFromIndex,
  getDirections,
  getHeightOfBlock,
  indexFromXYZCoords,
} from "../helpers";
import {
  applyChunkDiffs,
  generateResources,
  generateTerrain,
  generateTrees,
} from "../chunkGenFunctions";

interface WorkerData {
  chunkX: number;
  chunkZ: number;
  params: TerrainGenParams;
  diffs: Record<string, { blockId: number }>;
  workerId: number;
}

export interface MeshGenerationResult {
  blockId: string;
  positions: number[];
  instanceCount: number;
}

self.onmessage = (e) => {
  // 6-10 ms
  processMessage(e);
};

async function processMessage(e: MessageEvent<WorkerData>) {
  const { chunkX, chunkZ, params, diffs, workerId } = e.data as WorkerData;
  const size = params.chunkSize;
  const { width, height } = size;
  const blockData = new Uint16Array(width * height * width).fill(BLOCKS.air.id);

  // Pre-calculate neighbor chunk heights for edges
  // const edgeHeights = {
  //   left: new Int16Array(width),
  //   right: new Int16Array(width),
  //   front: new Int16Array(width),
  //   back: new Int16Array(width)
  // };

  // Calculate heights only once for each edge
  // for (let i = 0; i < width; i++) {
  //   edgeHeights.left[i] = getHeightOfBlock(chunkX - 1, chunkZ, width - 1, i, params);
  //   edgeHeights.right[i] = getHeightOfBlock(chunkX + 1, chunkZ, 0, i, params);
  //   edgeHeights.front[i] = getHeightOfBlock(chunkX, chunkZ - 1, i, width - 1, params);
  //   edgeHeights.back[i] = getHeightOfBlock(chunkX, chunkZ + 1, i, 0, params);
  // }

  const blockTypesMap: Map<string, number[]> = new Map(
    Object.values(BLOCKS)
      .filter((blockType) => blockType.id !== BLOCKS.air.id)
      .map((blockType) => [blockType.id.toString(), []])
  );

  generateResources(chunkX, chunkZ, params, blockData);
  generateTerrain(chunkX, chunkZ, params, blockData);
  generateTrees(chunkX, chunkZ, params, blockData);
  applyChunkDiffs(diffs, blockData, size);

  const visibleBlocks = new Set<number>();
  for (let i = 0; i < blockData.length; i++) {
    const blockId = blockData[i];
    if (blockId === BLOCKS.air.id) continue;
    let isVisible = false;

    const { x, y, z } = coordsFromIndex(i, size);

    for (const { dx, dy, dz } of getDirections(1)) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;

      if (nx < 0 || nz < 0 || nx >= width || nz >= width) {
        // let neighborHeight;

        // if (nx < 0) {
        //   neighborHeight = edgeHeights.left[nz];
        // } else if (nx >= width) {
        //   neighborHeight = edgeHeights.right[nz];
        // } else if (nz < 0) {
        //   neighborHeight = edgeHeights.front[nx];
        // } else {
        //   neighborHeight = edgeHeights.back[nx];
        // }

        // if (y >= neighborHeight) {
        //   break;
        // }
        isVisible = true;
      }

      const neighborIndex = indexFromXYZCoords(nx, ny, nz, size);
      if (blockData[neighborIndex] === BLOCKS.air.id) {
        isVisible = true;
        break;
      }
    }

    if (isVisible) {
      visibleBlocks.add(i);
      const positions = blockTypesMap.get(blockId.toString());
      if (positions) {
        positions.push(x, y, z);
      }
    }
  }

  const meshesData: MeshGenerationResult[] = Array.from(
    blockTypesMap.entries()
  ).map(([blockId, positions]) => ({
    blockId,
    positions,
    instanceCount: positions.length / 3,
  }));

  self.postMessage({
    chunkX,
    chunkZ,
    blockData: blockData.buffer,
    meshesData,
    workerId,
  });
}
