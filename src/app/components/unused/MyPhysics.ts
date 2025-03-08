import * as THREE from "three";
import { BLOCKS } from "../../utils/BlocksData";
import { World } from "../World";
import { Player } from "./Player";

export interface PhysicsObject extends Player {
  world: World;
  velocity: THREE.Vector3;
  onGround: boolean;
  lastGroundY: number;
  applyWorldDeltaVelocity(dv: THREE.Vector3): void;
}

const collisionMaterial = new THREE.MeshBasicMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.2,
});

const collisionBlockGeometry = new THREE.BoxGeometry(1.001, 1.001, 1.001);

const contactMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ff00,
  wireframe: true,
});

const contactGeometry = new THREE.SphereGeometry(0.05, 6, 6);

type collision = {
  block: { x: number; y: number; z: number };
  contactPoint: { x: number; y: number; z: number };
  normal: THREE.Vector3;
  overlap: number;
};

export class Physics {
  object: PhysicsObject;
  gravity: number = 30;
  helpers: THREE.Group;

  private readonly GROUND_ANGLE_THRESHOLD = 2.8; // About 160 degrees - very strict!
  private readonly DEBUG_COLLISION = false; // Set to true to see collision angles

  constructor(object: PhysicsObject) {
    this.object = object;
    this.helpers = new THREE.Group();
    this.object.world.add(this.helpers);
  }

  update(timeStep: number) {
    this.helpers.clear();

    this.applyGravity(timeStep);
    this.detectCollision();
  }

  detectCollision() {
    this.object.onGround = false;
    this.object.lastGroundY = -Infinity;

    const candidates = this.broadPhase();
    const collisions = this.narrowPhase(candidates);

    if (collisions.length > 0) {
      this.resolveCollision(collisions);
    }
  }

  applyGravity(timeStep: number) {
    this.object.velocity.y -= this.gravity * timeStep;
  }

  broadPhase() {
    const candidates = [];

    const extents = {
      x: {
        min: Math.floor(this.object.position.x - this.object.radius),
        max: Math.ceil(this.object.position.x + this.object.radius),
      },
      y: {
        min: Math.floor(this.object.position.y - this.object.height),
        max: Math.ceil(this.object.position.y),
      },
      z: {
        min: Math.floor(this.object.position.z - this.object.radius),
        max: Math.ceil(this.object.position.z + this.object.radius),
      },
    };

    for (let x = extents.x.min; x <= extents.x.max; x++) {
      for (let y = extents.y.min; y <= extents.y.max; y++) {
        for (let z = extents.z.min; z <= extents.z.max; z++) {
          const block = this.object.world.getVoxel(x, y, z);
          if (block !== BLOCKS.air.id) {
            const blockPosition = { x, y, z };
            candidates.push(blockPosition);
            this.addCollisionHelper(blockPosition);
          }
        }
      }
    }
    return candidates;
  }

  narrowPhase(candidates: { x: number; y: number; z: number }[]) {
    const collisions: collision[] = [];
    const p = this.object.position;

    let highestGroundY = -Infinity;
    let validGroundCollision = false;

    for (const block of candidates) {
      const closestPoint = {
        x: Math.max(block.x - 0.5, Math.min(p.x, block.x + 0.5)),
        y: Math.max(
          block.y - 0.5,
          Math.min(p.y - this.object.height / 2, block.y + 0.5)
        ),
        z: Math.max(block.z - 0.5, Math.min(p.z, block.z + 0.5)),
      };

      const dx = closestPoint.x - p.x;
      const dy = closestPoint.y - (p.y - this.object.height / 2);
      const dz = closestPoint.z - p.z;

      if (this.pointInPlayerBounds(closestPoint)) {
        const overlapY = this.object.height / 2 - Math.abs(dy);
        const overlapXZ = this.object.radius - Math.sqrt(dx * dx + dz * dz);

        let normal: THREE.Vector3;
        let overlap: number;

        const collisionVector = new THREE.Vector3(dx, dy, dz).normalize();
        const verticalAxis = new THREE.Vector3(0, 1, 0);
        const angle = collisionVector.angleTo(verticalAxis);

        if (this.DEBUG_COLLISION) {
          const angleInDegrees = (angle * 180) / Math.PI;
          console.log(`Collision angle: ${angleInDegrees.toFixed(2)}°`);
        }

        const isVerticalCollision =
          Math.abs(dy) > Math.abs(dx) * 1.5 &&
          Math.abs(dy) > Math.abs(dz) * 1.5; // Made more strict
        const isTopCollision = dy < 0 && isVerticalCollision;
        const centerDistance = Math.sqrt(dx * dx + dz * dz);
        const isCentered = centerDistance < this.object.radius * 0.8; // Made more strict

        if (overlapXZ > overlapY) {
          normal = new THREE.Vector3(0, -Math.sign(dy), 0);
          overlap = overlapY;

          if (
            isTopCollision &&
            block.y + 0.5 > highestGroundY &&
            angle > this.GROUND_ANGLE_THRESHOLD && // Stricter angle check
            isCentered
          ) {
            highestGroundY = block.y + 0.5;
            const distanceToGround = Math.abs(
              p.y - this.object.height - highestGroundY
            );
            if (distanceToGround < 0.1) {
              // Very close to the surface
              if (this.DEBUG_COLLISION) {
                console.log("Valid ground collision detected");
                console.log(`Distance to ground: ${distanceToGround}`);
                console.log(`Center distance: ${centerDistance}`);
              }
              validGroundCollision = true;
            }
          }
        } else {
          normal = new THREE.Vector3(-dx, 0, -dz).normalize();
          overlap = overlapXZ;
        }

        collisions.push({
          block: block,
          contactPoint: closestPoint,
          normal: normal,
          overlap: overlap,
        });

        this.addContactHelper(closestPoint);
      }
    }

    this.object.onGround = validGroundCollision;
    this.object.lastGroundY = highestGroundY;

    return collisions;
  }

  resolveCollision(collisions: collision[]) {
    collisions.sort((a, b) => b.overlap - a.overlap);

    for (const collision of collisions) {
      if (!this.pointInPlayerBounds(collision.contactPoint)) {
        continue;
      }

      let deltaPos = collision.normal.clone().multiplyScalar(collision.overlap);
      this.object.camera.position.add(deltaPos);

      let magnitude = this.object.worldVelocityVector.dot(collision.normal);
      let velocityAdjustment = collision.normal
        .clone()
        .multiplyScalar(magnitude);

      this.object.applyWorldDeltaVelocity(velocityAdjustment.negate());
    }
  }

  pointInPlayerBounds(point: { x: number; y: number; z: number }): boolean {
    const dx = point.x - this.object.position.x;
    const dy = point.y - (this.object.position.y - this.object.height / 2);
    const dz = point.z - this.object.position.z;
    const r_sq = dx * dx + dz * dz;

    return (
      Math.abs(dy) < this.object.height / 2 &&
      r_sq < this.object.radius * this.object.radius
    );
  }

  addCollisionHelper(blockPosition: { x: number; y: number; z: number }) {
    const blockMesh = new THREE.Mesh(collisionBlockGeometry, collisionMaterial);
    blockMesh.position.copy(blockPosition);
    this.helpers.add(blockMesh);
  }

  addContactHelper(contactPosition: { x: number; y: number; z: number }) {
    const contactMesh = new THREE.Mesh(contactGeometry, contactMaterial);
    contactMesh.position.copy(contactPosition);
    this.helpers.add(contactMesh);
  }
}
