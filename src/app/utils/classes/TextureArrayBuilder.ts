import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import * as THREE from 'three';
import { color } from 'three/webgpu';


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

  constructor(textureArrayName: string, width: number, height: number) {
    this.textureArrayName = textureArrayName
    this.width = width;
    this.height = height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  setTextures(key: number, texturesUrls: string[], colorMasks?: number[][]) {
    this.texturesloaded = false
    this.textureArrayNeedsUpdate = true
    this.disposeTextures(key);
    this.texturesMap.set(key, []);
    const textures = this.texturesMap.get(key);
    if (!textures) return;
    for (let i = 0; i < texturesUrls.length; i++) {
      textures.push(undefined);
    }
    texturesUrls.forEach((url, index) => {
      textures[index] = null;
      const {loader, type} = this._useCorrectLoader(url);
      loader.load(url, (texture) => {
        texture.userData = {
          type: type,
          colorMask: colorMasks ? colorMasks[index] : [0.0, 0.0, 0.0, 1.0] // [r, g, b, a]  
        }
        this._assignTexture(key, index, texture);
      },
      undefined,
      (error) => {
        console.error(`Error loading ${type} texture: `, error, ' from ', url);
      })
    });
  }

  getTextureArray() {
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
      textureArrayConfig: this.textureArrayConfig
    };
  }

  _buildTextureArray() {
    if (this.numberTextures === 0 || this.numberTextures !== this.numberLoaded) {
      return false;
    }

    const rawTextureArray = new Uint8Array((this.numberTextures + 1) * this.width * this.height * 4);
    const sortedKeys = Array.from(this.texturesMap.keys()).sort((a, b) => a - b);
    const rawTextureConfig = new Uint8Array((sortedKeys.length + 1) * 2);

    let textureIndex = sortedKeys[0];

    for (const [i, key] of sortedKeys.entries()) {
      const textures = this.texturesMap.get(key);
      if (!textures || textures.length === 0) continue;

      const startIndex = textureIndex;
      const count = textures.length;

      for (const texture of textures) {
        if (!texture) throw new Error(`Null texture: ${this.textureArrayName}, ${key}, ${textureIndex}`);

        const colorMask = texture.userData.colorMask;
        const ctx = this.canvas.getContext("2d");

        if (!ctx) throw new Error(`Canvas context not available textureArray: ${this.textureArrayName}`);

        if (colorMask[0] || colorMask[1] || colorMask[2]) {
          ctx.fillStyle = `rgba(${colorMask[0]}, ${colorMask[1]}, ${colorMask[2]}, ${colorMask[3]})`;
          ctx.fillRect(0, 0, this.width, this.height);

          ctx.globalCompositeOperation = 'multiply';
          ctx.drawImage(texture.image, 0, 0);

          ctx.globalCompositeOperation = 'source-over';
        }
        else ctx.drawImage(texture.image, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, this.width, this.height);
        rawTextureArray.set(new Uint8Array(imageData.data), textureIndex * this.width * this.height * 4);
        ctx.clearRect(0, 0, this.width, this.height);

        textureIndex++;
      }
      rawTextureConfig.set([count, startIndex], key * 2);
    }
    this.textureArray = new THREE.DataArrayTexture(rawTextureArray, this.width, this.height, this.numberTextures + 1);
    this.textureArray.minFilter = THREE.NearestFilter;
    this.textureArray.magFilter = THREE.NearestFilter;
    this.textureArray.name = this.textureArrayName;
    this.textureArray.needsUpdate = true;

    this.textureArrayConfig = new THREE.DataTexture(rawTextureConfig, rawTextureConfig.length / 2, 1, THREE.RGFormat, THREE.UnsignedByteType);
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