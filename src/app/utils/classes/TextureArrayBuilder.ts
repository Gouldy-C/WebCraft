import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import * as THREE from 'three';


export class TextureArrayBuilder {
  textureArrayName: string
  texturesMap: Map<number, (THREE.Texture | undefined | null)[]> = new Map();
  numberTextures: number = 0
  numberLoaded: number = 0
  texturesloaded: boolean = false

  textureLoader: THREE.TextureLoader = new THREE.TextureLoader();
  tgaLoader: TGALoader = new TGALoader();

  canvas: HTMLCanvasElement = document.createElement('canvas');

  textureArray: THREE.DataArrayTexture | null = null
  textureArrayConfig: THREE.DataTexture | null = null
  textureArrayNeedsUpdate: boolean = true

  width: number
  height: number

  private loadingPromises: Promise<void>[] = [];

  constructor(textureArrayName: string, width: number, height: number) {
    this.textureArrayName = textureArrayName
    this.width = width;
    this.height = height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  setTextures(key: number, texturesUrls: string[], colorMasks?: (number[] | null)[]) {
    this.texturesloaded = false;
    this.textureArrayNeedsUpdate = true;
    this.disposeTextures(key);
    this.texturesMap.set(key, []);
    const textures = this.texturesMap.get(key);
    if (!textures) return;

    const promises = texturesUrls.map((url, index) => {
      return new Promise<void>((resolve, reject) => {
        const { loader, type } = this._useCorrectLoader(url);
        loader.load(
          url,
          (texture) => {
            texture.userData = {
              type: type,
              colorMask: colorMasks ? colorMasks[index] : null,
            };
            this._assignTexture(key, index, texture);
            resolve();
          },
          undefined,
          (error) => {
            console.error(`Error loading ${type} texture: `, error, ' from ', url);
            reject(error);
          }
        );
      });
    });

    this.loadingPromises.push(...promises);
  }

  async getTextureArray(): Promise<{
    textureArray: THREE.DataArrayTexture | null;
    textureArrayConfig: THREE.DataTexture | null;
  }> {
    await Promise.all(this.loadingPromises);
    this.loadingPromises = [];

    if (this.textureArrayNeedsUpdate) {
      this.textureArray?.dispose();
      this.textureArrayConfig?.dispose();
      this.textureArray = null;
      this.textureArrayConfig = null;
      const res = this._buildTextureArray();
      if (res) this.textureArrayNeedsUpdate = false;
    }

    return {
      textureArray: this.textureArray,
      textureArrayConfig: this.textureArrayConfig,
    };
  }

  _buildTextureArray() {
    if (this.numberTextures === 0 || this.numberTextures !== this.numberLoaded) {
      return false;
    }

    const rawTextureArray = []
    const keys = Array.from(this.texturesMap.keys())
    const rawTextureConfig = []

    let textureIndex = 0;

    for (const key of keys) {
      const textures = this.texturesMap.get(key);
      if (!textures || textures.length === 0) continue;

      const startIndex = textureIndex;
      const count = textures.length;

      for (const texture of textures) {
        if (!texture) throw new Error(`Null texture: ${this.textureArrayName}, ${key}, ${textureIndex}`);

        const colorMask = texture.userData.colorMask;
        const ctx = this.canvas.getContext("2d");

        if (!ctx) throw new Error(`Canvas context not available textureArray: ${this.textureArrayName}`);
        
        if (colorMask) {
          ctx.fillStyle = `rgba(${colorMask[0]}, ${colorMask[1]}, ${colorMask[2]}, ${colorMask[3]})`;
          ctx.fillRect(0, 0, this.width, this.height);
          ctx.globalCompositeOperation = 'multiply';
        }
        
        if (texture.userData.type === 'tga') {
          const imageData = ctx.createImageData(texture.image.width, texture.image.height);
          imageData.data.set(texture.image.data);
          ctx.putImageData(imageData, 0, 0);
        }
        else ctx.drawImage(texture.image, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, this.width, this.height);
        rawTextureArray.push(...imageData.data);
        ctx.clearRect(0, 0, this.width, this.height);

        textureIndex++;
      }
      rawTextureConfig.push(count, startIndex)
    }
    this.textureArray = new THREE.DataArrayTexture(new Uint8Array(rawTextureArray), this.width, this.height, this.numberTextures);
    this.textureArray.minFilter = THREE.NearestFilter;
    this.textureArray.magFilter = THREE.NearestFilter;
    this.textureArray.name = this.textureArrayName;
    this.textureArray.needsUpdate = true;

    this.textureArrayConfig = new THREE.DataTexture(new Uint8Array(rawTextureConfig), rawTextureConfig.length / 2, 1, THREE.RGFormat, THREE.UnsignedByteType);
    this.textureArrayConfig.name = this.textureArrayName;
    this.textureArrayConfig.needsUpdate = true;

    return true
  }

  areTexturesLoaded() {
    return this.texturesloaded
  }

  _useCorrectLoader(url: string) {
    if (url.endsWith('.tga')) return {loader: this.tgaLoader, type: 'tga'}
    if (url.endsWith('.png')) return {loader: this.textureLoader, type: 'png'}
    if (url.endsWith('.jpg')) return {loader: this.textureLoader, type: 'jpg'}
    if (url.endsWith('.jpeg')) return {loader: this.textureLoader, type: 'jpeg'}
    throw new Error('Unknown texture format ' + url)
  }

  _assignTexture(key: number, index: number, texture: THREE.Texture) {
    const textures = this.texturesMap.get(key);
    if (!textures) return;
    textures[index] = texture;
    this._updateNumTextures();
  }

  _updateNumTextures() {
    this.numberTextures = 0;
    this.numberLoaded = 0;
    for (const textures of this.texturesMap.values()) {
      if (textures.length === 0) continue
      for (const texture of textures) {
        if (texture) {
          this.numberLoaded++;
        }
        this.numberTextures++;
      }
    }
    if (this.numberLoaded === this.numberTextures) this.texturesloaded = true
  }

  disposeTextures(key: number) {
    this.textureArrayNeedsUpdate = true
    const textures = this.texturesMap.get(key);
    if (!textures) return;
    for (const texture of textures) {
      if (texture) texture.dispose();
    }
    this.texturesMap.delete(key);
    this._updateNumTextures();
  }

  dispose() {
    this.texturesMap.forEach((textures, key) => {
      this.disposeTextures(key);
    })
    this.canvas.remove()
    this.textureArray?.dispose();
    this.textureArrayConfig?.dispose();
  }
}