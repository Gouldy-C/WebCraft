import * as THREE from 'three';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { BLOCKS } from '../BlocksData';

const TEXTURES = {
  bedrock: '/textures/blocks/bedrock.png',
  coal_ore: '/textures/blocks/coal_ore.png',
  cobblestone: '/textures/blocks/cobblestone.png',
  diamond_ore: '/textures/blocks/diamond_ore.png',
  dirt: '/textures/blocks/dirt.png',
  gold_ore: '/textures/blocks/gold_ore.png',
  grass_side: '/textures/blocks/grass_side_carried.png',
  grass_top: '/textures/blocks/grass_carried.png',
  iron_ore: '/textures/blocks/iron_ore.png',
  iron_pickaxe: '/textures/items/iron_pickaxe.png',
  log_oak: '/textures/blocks/log_oak.png',
  log_oak_top: '/textures/blocks/log_oak_top.png',
  oak_leaves: '/textures/blocks/leaves_oak_carried.tga',
  sand: '/textures/blocks/sand.png',
  snow: '/textures/blocks/snow.png',
  snow_dirt_side: '/textures/blocks/grass_side_snowed.png',
  stone: '/textures/blocks/stone.png',
  cloud: '/textures/environment/clouds.png',
};


export class TexturesManager {
  private static instance: TexturesManager | null = null;
  private initialized = false;
  private textures: Record<string, THREE.Texture | null>;
  private materials: Record<string, THREE.Material | null>;
  private textureLoader: THREE.TextureLoader
  private tgaLoader: TGALoader

  private constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.tgaLoader = new TGALoader();
    this.textures = {};
    this.materials = {};
    this.setup();
  }

  static getInstance(): TexturesManager {
    if (!TexturesManager.instance) {
      TexturesManager.instance = new TexturesManager();
    }
    return TexturesManager.instance;
  }

  private async loadTextureAsync(path: string): Promise<THREE.Texture> {
    if (!this.textureLoader) {
      throw new Error('TextureLoader not initialized');
    }
    let loader: THREE.TextureLoader | TGALoader = this.textureLoader;
    if (path.endsWith('.tga')) {
      loader = this.tgaLoader
    }
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        (loadedTexture) => {
          loadedTexture.colorSpace = THREE.SRGBColorSpace;
          loadedTexture.magFilter = THREE.NearestFilter;
          loadedTexture.minFilter = THREE.NearestFilter;
          resolve(loadedTexture);
        },
        undefined,
        (error) => {
          reject(error);
        }
      );
    });
  }

  public async setup(): Promise<void> {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;

    try {
      const texturePromises = Object.fromEntries(
        Object.entries(TEXTURES).map(([key, path]) => [key, this.loadTextureAsync(path)])
      );

      this.textures = await Object.fromEntries(
        await Promise.all(
          Object.entries(texturePromises).map(
            async ([key, promise]) => [key, await promise]
          )
        )
      )

      this.initializeMaterials();
    } catch (error) {
      console.error('Failed to load textures:', error);
      this.dispose()
      throw error;
    }
  }

  private initializeMaterials() {
    for (const [name, block] of Object.entries(BLOCKS)) {
      if (block.id === BLOCKS.air.id) continue
      for (const texture of Object.values(block.textures)) {
        if (this.materials[texture] === undefined) {
          this.materials[texture] = new THREE.MeshLambertMaterial({ 
            map: this.textures[texture],
            alphaHash: true
          })
        }
      }


      BLOCKS[name].material = [
        this.materials[block.textures.left]!,
        this.materials[block.textures.right]!,
        this.materials[block.textures.top]!,
        this.materials[block.textures.bottom]!,
        this.materials[block.textures.front]!,
        this.materials[block.textures.back]!,
      ]
    }
    this.initialized = true;
  }

  getTexture(name: string): THREE.Texture | null {
    return this.textures[name];
  }

  get isInitialized() {
    return this.initialized;
  }

  public dispose(): void {
    Object.values(this.textures).forEach(texture => {
      if (texture) {
        texture.dispose();
      }
    });
    this.textures = {};
    this.initialized = false;
  }
}


class TextureArrayLoader {
  private textureLoader: THREE.TextureLoader;
  private textures: THREE.Texture[];
  private textureSize: number;
  private textureArrayWidth: number;
  private textureArrayHeight: number;

  constructor() {
      this.textureLoader = new THREE.TextureLoader();
      this.textures = [];
      this.textureSize = 16; // Default minecraft-like texture size
      this.textureArrayWidth = 16;
      this.textureArrayHeight = 16;
  }

  // Load a single texture and return a promise
  async loadTexture(url: string) {
      return new Promise((resolve, reject) => {
          this.textureLoader.load(
              url,
              (texture) => {
                  resolve(texture);
              },
              undefined,
              (error) => {
                  reject(error);
              }
          );
      });
  }

  // Create canvas and get image data from texture
  textureToImageData(texture: THREE.Texture) {
      const canvas = document.createElement('canvas');
      canvas.width = this.textureSize;
      canvas.height = this.textureSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');
    
      // Draw the texture to canvas
      const image = texture.image;
      ctx.drawImage(image, 0, 0, this.textureSize, this.textureSize);
    
      // Get image data
      return ctx.getImageData(0, 0, this.textureSize, this.textureSize);
  }

  // Convert multiple textures into a data texture array
  async createTextureArray(textureUrls: string[]) {
      // Load all textures
      const loadedTextures = await Promise.all(
          textureUrls.map(url => this.loadTexture(url))
      ) as THREE.Texture[];

      // Calculate the size needed for the array
      const texturesPerRow = Math.ceil(Math.sqrt(loadedTextures.length));
      const arrayWidth = this.textureSize * texturesPerRow;
      const arrayHeight = this.textureSize * texturesPerRow;

      // Create a canvas to combine all textures
      const canvas = document.createElement('canvas');
      canvas.width = arrayWidth;
      canvas.height = arrayHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      // Draw all textures to the canvas
      loadedTextures.forEach((texture, index) => {
          const x = (index % texturesPerRow) * this.textureSize;
          const y = Math.floor(index / texturesPerRow) * this.textureSize;
          ctx.drawImage(texture.image, x, y, this.textureSize, this.textureSize);
      });

      // Create data texture
      const dataTexture = new THREE.CanvasTexture(canvas);
      dataTexture.minFilter = THREE.NearestFilter;
      dataTexture.magFilter = THREE.NearestFilter;
      
      return {
          texture: dataTexture,
          texturesPerRow,
          textureSize: this.textureSize
      };
  }

  // Helper to get UV coordinates for a specific texture index
  getUVsForIndex(index: number, texturesPerRow: number) {
      const row = Math.floor(index / texturesPerRow);
      const col = index % texturesPerRow;
      
      const uSize = this.textureSize / (this.textureSize * texturesPerRow);
      const vSize = this.textureSize / (this.textureSize * texturesPerRow);
      
      const u = col * uSize;
      const v = row * vSize;
      
      return [
          u, v + vSize,               // bottom left
          u + uSize, v + vSize,       // bottom right
          u + uSize, v,               // top right
          u, v                        // top left
      ];
  }
}
