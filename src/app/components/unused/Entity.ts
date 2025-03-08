import { InputManager } from "../../utils/classes/InputManger";
import { Physics } from "./MyPhysics";
import { World } from "../World";
import * as THREE from "three";

interface Item {
  id: string;
  name: string;
  description: string;
  stackable: boolean;
  quantity: number;
  use?: (user: Entity) => void;
}

interface HealthState {
  currentHealth: number;
  maxHealth: number;
  armor: number;
  isInvulnerable: boolean;
}

export class Entity {
  readonly inputManager: InputManager;
  // private readonly physics: Physics;
  readonly world: World;

  readonly radius: number = 0;
  readonly height: number = 0;
  readonly baseSpeed: number = 0;
  readonly sprintSpeed: number = 0;
  readonly jumpSpeed: number = 0;
  readonly reach: number = 0;

  id: string;
  name: string;
  entityType: "player" | "enemy" | "npc";

  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  isMoving: boolean = false;
  isJumping: boolean = false;
  isSprinting: boolean = false;
  isFlying: boolean = false;
  isCrouching: boolean = false;

  private health: HealthState;

  private inventory: Item[] = [];
  private inventorySlots: number = 16;

  private tempEuler: THREE.Euler = new THREE.Euler();
  private tempMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private tempVector: THREE.Vector3 = new THREE.Vector3();

  constructor(
    id: string,
    name: string,
    entityType: "player" | "enemy" | "npc",
    position: { x: number; y: number; z: number },
    maxHealth: number,
    world: World
  ) {
    this.id = id;
    this.name = name;
    this.entityType = entityType;
    this.position = position;
    this.velocity = { x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: 0, z: 0 };

    // Initialize health
    this.health = {
      currentHealth: maxHealth,
      maxHealth: maxHealth,
      armor: 0,
      isInvulnerable: false,
    };

    // Initialize required components
    this.inputManager = world.inputManager;
    // this.physics = world.physics;
    this.world = world;
  }

  takeDamage(amount: number): boolean {
    if (this.health.isInvulnerable) return false;

    // Calculate actual damage after armor reduction
    const actualDamage = Math.max(0, amount - this.health.armor);
    this.health.currentHealth = Math.max(
      0,
      this.health.currentHealth - actualDamage
    );

    // Return true if the entity died from this damage
    return this.isDead();
  }

  heal(amount: number): void {
    this.health.currentHealth = Math.min(
      this.health.maxHealth,
      this.health.currentHealth + amount
    );
  }

  isDead(): boolean {
    return this.health.currentHealth <= 0;
  }

  setMaxHealth(value: number): void {
    this.health.maxHealth = value;
    // Optionally adjust current health if it exceeds new max
    if (this.health.currentHealth > value) {
      this.health.currentHealth = value;
    }
  }

  getHealthPercentage(): number {
    return (this.health.currentHealth / this.health.maxHealth) * 100;
  }

  setArmor(value: number): void {
    this.health.armor = value;
  }

  setInvulnerable(value: boolean): void {
    this.health.isInvulnerable = value;
  }

  getHealthState(): HealthState {
    return { ...this.health }; // Return a copy to prevent direct mutation
  }

  getInventory(): Item[] {
    return [...this.inventory]; // Return a copy to prevent direct mutation
  }

  addItem(item: Item): boolean {
    if (item.stackable && item.quantity) {
      const existingItem = this.inventory.find((i) => i.id === item.id);
      if (existingItem && existingItem.quantity) {
        existingItem.quantity += item.quantity;
        return true;
      }
    }

    if (this.inventory.length === this.inventorySlots) return false;

    this.inventory.push({ ...item });
    return true;
  }

  removeItem(itemId: string, quantity: number = 1): boolean {
    const itemIndex = this.inventory.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) return false;

    const item = this.inventory[itemIndex];

    if (item.stackable && item.quantity) {
      if (item.quantity > quantity) {
        item.quantity -= quantity;
        return true;
      }
    }
    this.inventory.splice(itemIndex, 1);
    return true;
  }

  useItem(itemId: string): boolean {
    const item = this.inventory.find((item) => item.id === itemId);
    if (!item || !item.use) return false;

    item.use(this);

    if (item.stackable && item.quantity) {
      return this.removeItem(itemId, 1);
    }

    return true;
  }

  hasItem(itemId: string): boolean {
    return this.inventory.some((item) => item.id === itemId);
  }

  clearInventory(): void {
    this.inventory = [];
  }

  update(deltaTime: number): void {}
}
