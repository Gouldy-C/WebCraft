import * as THREE from 'three';

const _MIN_NODE_SIZE = 500;

interface Node {
  bounds: THREE.Box2;
  children: Node[];
  center: THREE.Vector2;
  size: THREE.Vector2;
}

interface Params {
  min: THREE.Vector2;
  max: THREE.Vector2;
}

export class QuadTree {
  _root: Node;

  constructor(params: Params) {
    const b = new THREE.Box2(params.min, params.max);
    this._root = {
      bounds: b,
      children: [],
      center: b.getCenter(new THREE.Vector2()),
      size: b.getSize(new THREE.Vector2()),
    };
  }

  GetChildren() {
    const children: Node[] = [];
    this._GetChildren(this._root, children);
    return children;
  }

  _GetChildren(node: Node, target: Node[]) {
    if (node.children.length == 0) {
      target.push(node);
      return;
    }

    for (let c of node.children) {
      this._GetChildren(c, target);
    }
  }

  Insert(pos: { x: number; z: number }) {
    this._Insert(this._root, new THREE.Vector2(pos.x, pos.z));
  }

  _Insert(child: Node, pos: THREE.Vector2) {
    const distToChild = this._DistanceToChild(child, pos);

    if (distToChild < child.size.x && child.size.x > _MIN_NODE_SIZE) {
      child.children = this._CreateChildren(child);

      for (let c of child.children) {
        this._Insert(c, pos);
      }
    }
  }

  _DistanceToChild(child: Node, pos: THREE.Vector2) {
    return child.center.distanceTo(pos);
  }

  _CreateChildren(child: Node) {
    const midpoint = child.bounds.getCenter(new THREE.Vector2());

    // Bottom left
    const b1 = new THREE.Box2(child.bounds.min, midpoint);

    // Bottom right
    const b2 = new THREE.Box2(
      new THREE.Vector2(midpoint.x, child.bounds.min.y),
      new THREE.Vector2(child.bounds.max.x, midpoint.y));

    // Top left
    const b3 = new THREE.Box2(
      new THREE.Vector2(child.bounds.min.x, midpoint.y),
      new THREE.Vector2(midpoint.x, child.bounds.max.y));

    // Top right
    const b4 = new THREE.Box2(midpoint, child.bounds.max);

    const children = [b1, b2, b3, b4].map(
        b => {
          return {
            bounds: b,
            children: [],
            center: b.getCenter(new THREE.Vector2()),
            size: b.getSize(new THREE.Vector2())
          };
        });

    return children;
  }
}