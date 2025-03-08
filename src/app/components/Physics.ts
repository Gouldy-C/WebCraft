import * as RAPIER from "@dimforge/rapier3d";
import * as THREE from "three";

interface PhysicsParams {
  gravity: { x: number; y: number; z: number };
}

export interface AddPhysicsParams {
  object: THREE.Object3D | THREE.Mesh
  rigidBodyType: RAPIER.RigidBodyType
  colliderType?: "ball" | "capsule" | "cuboid"| "trimesh"
  colliderSettings?: ColliderDesc
  autoAnimate: boolean
  postPhysicsFn?: Function
  userData?: any;
}

interface ColliderDesc {
  dimensions: {
    halfWidth?: number;
    halfHeight?: number;
    halfDepth?: number;
    radius?: number;
  };
}

interface PhysicsObject {
  id: string; // Unique identifier
  object: THREE.Object3D | THREE.Mesh; // Optional Three.js object
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  postPhysicsFn?: Function
  autoAnimate: boolean
  userData?: any;
}

export class Physics {
  physicsWorld: RAPIER.World;
  physicsObjects: PhysicsObject[];

  constructor(params: PhysicsParams) {
    const gravity = { x: params.gravity.x, y: params.gravity.y, z: params.gravity.z };
    this.physicsWorld = new RAPIER.World(gravity);
    this.physicsObjects = []
  }

  addPhysics(params: AddPhysicsParams) {
    if (this.physicsObjects.find((obj) => obj.id === params.object.uuid)) {
      this.updatePhysics(params)
      return
    }

    const rigidBodyDesc = new RAPIER.RigidBodyDesc(params.rigidBodyType)
    rigidBodyDesc.setTranslation(params.object.position.x, params.object.position.y, params.object.position.z);

    const rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc)

    const colliderDesc = this.getColliderDesc(params)

    const collider = this.physicsWorld.createCollider(colliderDesc, rigidBody)

    const physicsObject: PhysicsObject = {
      id: params.object.uuid,
      object: params.object,
      body: rigidBody,
      collider: collider,
      autoAnimate: true,
    }

    this.physicsObjects.push(physicsObject)
  }

  updatePhysics(params: AddPhysicsParams) {
    const physicsObject = this.physicsObjects.find((item) => item.id === params.object.uuid)
    
    if (physicsObject) {
      physicsObject.postPhysicsFn = params.postPhysicsFn ?? physicsObject.postPhysicsFn
      physicsObject.autoAnimate = params.autoAnimate ?? physicsObject.autoAnimate
      physicsObject.userData = params.userData ?? physicsObject.userData

      // Update rigid body type if needed
      const currentBody = physicsObject.body;
      if (currentBody.bodyType() !== params.rigidBodyType) {
        physicsObject.body.setBodyType(params.rigidBodyType, true);
      }

      const colliderDesc = this.getColliderDesc(params)

      this.physicsWorld.removeCollider(physicsObject.collider, true)
      physicsObject.collider = this.physicsWorld.createCollider(colliderDesc, physicsObject.body)
    }
  }

  update() {
    this.physicsWorld.step();

    for (const physicsObject of this.physicsObjects) {
      if (!physicsObject.autoAnimate) continue;

      const body = physicsObject.body;
      const object = physicsObject.object;

      // Synchronize Three.js object with Rapier rigid body
      if (body.bodyType() === RAPIER.RigidBodyType.Dynamic || body.bodyType() === RAPIER.RigidBodyType.KinematicPositionBased) {
        const translation = body.translation();
        const rotation = body.rotation();

        object.position.set(translation.x, translation.y, translation.z);
        object.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      } else if (body.bodyType() === RAPIER.RigidBodyType.KinematicVelocityBased) {
        const translation = body.translation();
        object.position.set(translation.x, translation.y, translation.z)
      }

      if (physicsObject.postPhysicsFn) {
        physicsObject.postPhysicsFn(physicsObject);
      }
    }
  }

  setGravity(gravity: { x: number; y: number; z: number }) {
    this.physicsWorld.gravity = new RAPIER.Vector3(gravity.x, gravity.y, gravity.z)
  }

  removePhysics(object: THREE.Object3D | THREE.Mesh) {
    const index = this.physicsObjects.findIndex((item) => item.id === object.uuid)
    if (index !== -1) {
      const physicsObject = this.physicsObjects[index]
      this.physicsWorld.removeCollider(physicsObject.collider, true)
      this.physicsWorld.removeRigidBody(physicsObject.body)
      this.physicsObjects.splice(index, 1)
    }
  }

  private getColliderDesc(params: AddPhysicsParams) {
    let colliderDesc
    const dimensions = params.colliderSettings?.dimensions

    switch (params.colliderType) {
      case 'cuboid':
        {
          const width = dimensions?.halfWidth || 1
          const height = dimensions?.halfHeight || 1
          const depth = dimensions?.halfDepth || 1

          colliderDesc = RAPIER.ColliderDesc.cuboid(width, height, depth)
        }
        break

      case 'ball':
        {
          const radius  = dimensions?.radius || 1
          colliderDesc = RAPIER.ColliderDesc.ball(radius)
        }
        break

      case 'capsule':
        {
          const halfHeight = dimensions?.halfHeight || 1
          const radius  = dimensions?.radius || 1
          colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius)
        }
        break
      case 'trimesh':
        { 
          if (!(params.object instanceof THREE.Mesh)) break
          const geometry = params.object.geometry;

          if (!(geometry instanceof THREE.BufferGeometry)) {
            throw new Error("Trimesh collider requires BufferGeometry.")
          }

          const vertices = geometry.attributes.position.array as Float32Array;
          const indices = geometry.index?.array as Uint32Array;

          if (!vertices || !indices) {
            throw new Error("Trimesh collider requires valid vertices and indices.");
          }

          colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
        }
        break
      default:
        {
          throw new Error('Physics Object Error: Unsupported shape type.')
        }
    }

    if (!colliderDesc) {
      throw new Error('Collider Mesh Error: convex mesh creation failed.')
    }

    colliderDesc.setTranslation(params.object.position.x, params.object.position.y, params.object.position.z)

    return colliderDesc
  }
}