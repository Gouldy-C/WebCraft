import * as THREE from 'three';


export class TextureArrayManager {
  textures: Map<string, THREE.Texture[]> = new Map();
  textureArray: THREE.DataArrayTexture = new THREE.DataArrayTexture();
  textureConfig: THREE.DataTexture = new THREE.DataTexture();
  numTextures: number = 0

  rawTextureArray: Uint8Array = new Uint8Array(0)
  rawTextureConfig: Uint8Array = new Uint8Array(0)

  

  width: number
  height: number

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

}