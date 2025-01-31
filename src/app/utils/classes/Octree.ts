import * as THREE from 'three';
import { Chunk } from '../../components/Chunk';
import { TerrainGenParams } from '../../components/TerrainManager';

class OctreeNode {
  position: THREE.Vector3;
  chunkSize: number;
  size: number;
  children: OctreeNode[];
  constructor(position: THREE.Vector3, chunksize: number, size: number) {
    this.position = position;  // {x, y, z}
    this.chunkSize = chunksize; 
    this.size = size;         // Cube size
    this.children = [];        // 8 child nodes          // THREE.Mesh instance
  }

  isLeaf() {
    return this.children.length === 0;
  }

  // Split node into 8 children
  split() {
    if (this.size <= this.chunkSize) return; // Minimum chunk size
    
    const childSize = this.size / 2;
    for (let i = 0; i < 8; i++) {
      const offset = {
        x: (i & 1) * childSize,
        y: ((i >> 1) & 1) * childSize,
        z: ((i >> 2) & 1) * childSize
      };
      
      this.children.push(new OctreeNode(
        new THREE.Vector3(
          this.position.x + offset.x,
          this.position.y + offset.y,
          this.position.z + offset.z
        ),
        this.chunkSize,
        childSize
      ));
    }
  }
}


export class Octree {
  root: OctreeNode;
  chunkSize: number;
  rootSize: number;

  constructor(params: TerrainGenParams) {
    this.chunkSize = params.chunkSize;
    this.rootSize = 2**14;
    this.root = new OctreeNode(new THREE.Vector3(0, 0, 0), this.chunkSize, this.rootSize);
  }

  update(position: THREE.Vector3, drawDistance: number) {
    const x = Math.floor(position.x / this.chunkSize) * this.chunkSize;
    const y = Math.floor(position.y / this.chunkSize) * this.chunkSize;
    const z = Math.floor(position.z / this.chunkSize) * this.chunkSize;
    if (this.root.position.x === x && this.root.position.y === y && this.root.position.z === z) return;
    this.root = new OctreeNode(new THREE.Vector3(x, y, z), this.chunkSize, this.rootSize);
    this.revaluate(this.root, position, drawDistance * this.chunkSize);
  }

  revaluate(node: OctreeNode, pos: THREE.Vector3, renderDistance: number) {
    // Calculate distance to node
    const nodeCenter = {
      x: node.position.x + node.size/2,
      y: node.position.y + node.size/2,
      z: node.position.z + node.size/2
    };
    
    const distance = Math.sqrt(
      (nodeCenter.x - pos.x)**2 +
      (nodeCenter.y - pos.y)**2 +
      (nodeCenter.z - pos.z)**2
    );

    if (distance <= renderDistance && node.isLeaf() && node.size > this.chunkSize) {
      node.split();

      for (let child of node.children) {
        this.revaluate(child, pos, renderDistance);
      }
    }
  }
}