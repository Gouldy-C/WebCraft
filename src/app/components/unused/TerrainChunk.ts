import * as THREE from "three";
import { BLOCKS } from "../../utils/BlocksData";
import { FractalNoise } from "../../utils/FractalNoise";
import { ChunkSize, TerrainGenParams } from "./Terrain";
import { MeshGenerationResult } from "../../utils/workers/terrainGenWorker";
import {
  getDirections,
  indexFromXYZCoords,
  keyFromXYZCoords,
  keyFromXZCoords,
} from "../../utils/helpers";
import { World } from "../World";

export const SharedResources = {
  geometry: new THREE.BoxGeometry(),
};

export class TerrainChunk extends THREE.Group {
  chunkSize: ChunkSize;
  blocksData: Uint16Array;
  instanceIds: Int32Array;
  params: TerrainGenParams;
  loaded = false;
  world: World;

  fractalNoise: FractalNoise;

  totalBlocks: number = 0;

  tempMatrix = new THREE.Matrix4();
  tempVector = new THREE.Vector3();

  constructor(params: TerrainGenParams, world: World) {
    super();
    this.chunkSize = params.chunkSize;
    this.params = params;
    this.world = world;
    this.totalBlocks =
      this.chunkSize.width * this.chunkSize.height * this.chunkSize.width;
    this.blocksData = new Uint16Array(this.totalBlocks);
    this.instanceIds = new Int32Array(this.totalBlocks);
    this.blocksData.fill(BLOCKS.air.id);
    this.instanceIds.fill(-1);
    this.fractalNoise = new FractalNoise(params.fractalNoise, params.seed);
  }

  async generateMeshes(meshesData: MeshGenerationResult[]) {
    this.dispose();

    const geometry = SharedResources.geometry;
    meshesData.forEach(
      ({ blockId, positions, instanceCount }: MeshGenerationResult) => {
        const blockType = Object.values(BLOCKS).find(
          (b) => b.id.toString() === blockId
        );
        if (!blockType) return;

        const mesh = new THREE.InstancedMesh(
          geometry,
          blockType.material,
          this.getOptimalInstanceCount(parseInt(blockId))
        );
        mesh.name = blockId.toString();
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mesh.count = instanceCount;
        for (let instanceId = 0; instanceId < instanceCount; instanceId++) {
          const x = positions[instanceId * 3];
          const y = positions[instanceId * 3 + 1];
          const z = positions[instanceId * 3 + 2];

          const existingVoxel = this.getVoxel(x, y, z);
          if (existingVoxel && existingVoxel.instanceId !== -1) {
            this.setBlockInstanceId(x, y, z, -1);
          }

          this.tempMatrix.identity();
          this.tempMatrix.setPosition(x, y, z);
          mesh.setMatrixAt(instanceId, this.tempMatrix);
          this.setBlockInstanceId(x, y, z, instanceId);
        }

        mesh.instanceMatrix.needsUpdate = true;
        this.add(mesh);
      }
    );
  }

  addVoxel(x: number, y: number, z: number, blockId: number): void {
    const voxel = this.getVoxel(x, y, z);
    if (!voxel || voxel.id !== BLOCKS.air.id || voxel.instanceId !== -1) return;
    this.setBlockId(x, y, z, blockId);
    this.addMeshInstance(x, y, z);
    this.world.worldStore.set(
      ["diffs", keyFromXZCoords(x, z), keyFromXYZCoords(x, y, z)],
      { id: blockId }
    );
  }

  addMeshInstance(x: number, y: number, z: number): void {
    const voxel = this.getVoxel(x, y, z);

    if (!voxel || voxel.id === BLOCKS.air.id || voxel.instanceId !== -1) {
      return;
    }

    const mesh = this.children.find(
      (m) => m.name === voxel.id.toString()
    ) as THREE.InstancedMesh;
    if (!mesh) return;

    const instanceId = mesh.count++;
    if (instanceId >= mesh.instanceMatrix.count) {
      console.warn("Instance count exceeded");
      return;
    }

    this.tempMatrix.identity();
    this.tempMatrix.setPosition(x, y, z);
    mesh.setMatrixAt(instanceId, this.tempMatrix);

    this.setBlockInstanceId(x, y, z, instanceId);

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }

  removeVoxel(x: number, y: number, z: number): void {
    const voxel = this.getVoxel(x, y, z);
    if (
      !voxel ||
      voxel.id === BLOCKS.air.id ||
      voxel.id === BLOCKS.bedrock.id ||
      voxel.instanceId === -1
    )
      return;

    this.deleteMeshInstance(x, y, z);
    this.setBlockId(x, y, z, BLOCKS.air.id);
    this.world.worldStore.set(
      ["diffs", keyFromXZCoords(x, z), keyFromXYZCoords(x, y, z)],
      { id: BLOCKS.air.id }
    );
  }

  deleteMeshInstance(x: number, y: number, z: number): void {
    const voxel = this.getVoxel(x, y, z);
    if (!voxel || voxel.instanceId === -1) return;

    const mesh = this.children.find(
      (m) => m.name === voxel.id.toString()
    ) as THREE.InstancedMesh;
    if (!mesh || mesh.count <= 0) return;

    const instanceId = voxel.instanceId;
    const lastInstanceId = mesh.count - 1;

    if (instanceId !== lastInstanceId) {
      this.tempMatrix.identity();
      mesh.getMatrixAt(lastInstanceId, this.tempMatrix);
      this.tempVector.setFromMatrixPosition(this.tempMatrix);
      this.setBlockInstanceId(
        Math.round(this.tempVector.x),
        Math.round(this.tempVector.y),
        Math.round(this.tempVector.z),
        instanceId
      );

      mesh.setMatrixAt(instanceId, this.tempMatrix);
    }

    this.setBlockInstanceId(x, y, z, -1);

    mesh.count--;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }

  getNumberOfInstances(blockId: number): number {
    let count = 0;
    this.blocksData.forEach((id) => {
      if (id === blockId) {
        count++;
      }
    });
    return count;
  }

  private getOptimalInstanceCount(blockId: number): number {
    const currentInstances = this.getNumberOfInstances(blockId);
    if (blockId === BLOCKS.air.id) return 0;
    if (blockId === BLOCKS.bedrock.id) {
      return currentInstances * 2;
    }
    if (blockId === BLOCKS.grass.id) {
      return Math.max(
        currentInstances + Math.ceil(currentInstances * 0.3),
        this.chunkSize.width * this.chunkSize.width * 1.5
      );
    }
    if (blockId === BLOCKS.dirt.id || blockId === BLOCKS.stone.id) {
      return Math.max(
        currentInstances + Math.ceil(currentInstances * 0.5),
        this.chunkSize.width * this.chunkSize.width * 5
      );
    }

    return Math.max(
      currentInstances + Math.ceil(currentInstances * 0.5),
      this.chunkSize.width * this.chunkSize.width * 5
    );
  }

  isVoxelObscured(x: number, y: number, z: number): boolean {
    for (const direction of getDirections(1)) {
      const voxel = this.getVoxel(
        x + direction.dx,
        y + direction.dy,
        z + direction.dz
      );
      if (!voxel || voxel.id === BLOCKS.air.id) {
        return false;
      }
    }
    return true;
  }

  getVoxel(
    x: number,
    y: number,
    z: number
  ): { id: number; instanceId: number } | null {
    const index = indexFromXYZCoords(
      x,
      y,
      z,
      this.chunkSize.width,
      this.chunkSize.height
    );
    if (index === -1) return null;
    return {
      id: this.blocksData[index],
      instanceId: this.instanceIds[index],
    };
  }

  setBlockInstanceId(
    x: number,
    y: number,
    z: number,
    instanceId: number
  ): void {
    const index = indexFromXYZCoords(
      x,
      y,
      z,
      this.chunkSize.width,
      this.chunkSize.height
    );
    if (index === -1) return;
    this.instanceIds[index] = instanceId;
  }

  setBlockId(x: number, y: number, z: number, id: number): void {
    const index = indexFromXYZCoords(
      x,
      y,
      z,
      this.chunkSize.width,
      this.chunkSize.height
    );
    if (index === -1) return;
    this.blocksData[index] = id;
  }

  setBlockData(data: Uint16Array): void {
    this.blocksData = data;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return (
      x >= 0 &&
      x < this.chunkSize.width &&
      y >= 0 &&
      y < this.chunkSize.height &&
      z >= 0 &&
      z < this.chunkSize.width
    );
  }

  dispose(): void {
    for (const child of this.children) {
      if (child instanceof THREE.InstancedMesh) {
        child.dispose();
      }
    }
    this.clear();
  }
}
