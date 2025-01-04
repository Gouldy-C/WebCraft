import * as THREE from 'three';


export function _GetImageData(texture: THREE.Texture) {
  const canvas = document.createElement('canvas');
  canvas.width = texture.image.width;
  canvas.height = texture.image.height;

  const context = canvas.getContext( '2d' );
  if (!context) throw new Error('Failed to get canvas context');
  context.drawImage(texture.image, 0, 0);

  return context.getImageData(0, 0, texture.image.width, texture.image.height);
}

export function _GetPixel(imagedata: ImageData, x: number, y: number) {
  const position = (x + imagedata.width * y) * 4;
  const data = imagedata.data;
  return {
      r: data[position],
      g: data[position + 1],
      b: data[position + 2],
      a: data[position + 3]
  };
}