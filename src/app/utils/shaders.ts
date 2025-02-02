export const V_SHADER = `
uniform sampler2D uTextureConfig; // X: numTextures per Block, Y: startIndex in the texture array

varying vec3 vertexNormal;
varying vec2 vertexUV;
varying float textureIndex;

vec3 decodeNormal(uint normalBits) {
  switch(normalBits) {
    case 0u: return vec3(0.0, 1.0, 0.0);
    case 1u: return vec3(0.0, -1.0, 0.0);
    case 2u: return vec3(1.0, 0.0, 0.0);
    case 3u: return vec3(-1.0, 0.0, 0.0);
    case 4u: return vec3(0.0, 0.0, 1.0);
    case 5u: return vec3(0.0, 0.0, -1.0);
    default: return vec3(1.0, 0.0, 0.0);
  }
}

vec2 getUVCoords(uint UVBits) {
  switch(UVBits) {
    case 0u: return vec2(0.0, 0.0);
    case 1u: return vec2(0.0, 1.0);
    case 2u: return vec2(1.0, 0.0);
    case 3u: return vec2(1.0, 1.0);
    default: return vec2(0.0, 0.0);
  }
}

float getTextureIndex(float blockId, vec3 normal) {
  // Calculate UV based on texture width
  float uvX = blockId / float(textureSize(uTextureConfig, 0).x);
  vec2 blockInfo = texture(uTextureConfig, vec2(uvX, 0.0)).rg;
  float numTextures = blockInfo.r * 255.0;
  float startIndex = blockInfo.g * 255.0;

  // Determine face orientation with better threshold
  bool isTop = normal.y > 0.99;
  bool isBottom = normal.y < -0.99;
  bool isRight = normal.x > 0.99;
  bool isLeft = normal.x < -0.99;
  bool isFront = normal.z > 0.99;
  bool isBack = normal.z < -0.99;

  // 6-texture blocks (all faces unique)
  if (numTextures >= 6.0) {
    if (isTop) return startIndex;
    if (isBottom) return startIndex + 1.0;
    if (isRight) return startIndex + 2.0;
    if (isLeft) return startIndex + 3.0;
    if (isFront) return startIndex + 4.0;
    if (isBack) return startIndex + 5.0;
  }
  // 3-texture blocks (top/bottom/sides)
  else if (numTextures >= 3.0) {
    if (isTop) return startIndex;
    if (isBottom) return startIndex + 1.0;
    return startIndex + 2.0;
  }
  // Default to single texture
  return startIndex;
}

void main() {
  // Decode vertex data
  float x = float(uint(position.x) & 0x3Fu);
  float y = float((uint(position.x) >> 6) & 0x3Fu);
  float z = float((uint(position.x) >> 12) & 0x3Fu);
  uint normalIndex = uint((uint(position.x) >> 18) & 0x7u);
  uint UVIndex = uint((uint(position.x) >> 21) & 0x3u);
  
  // Decode block and texture data
  float blockId = float(uint(position.y) & 0xFFFu);
  
  vertexNormal = decodeNormal(normalIndex);
  vertexUV = getUVCoords(UVIndex);
  textureIndex = getTextureIndex(blockId, vertexNormal);

  float uvX = blockId / float(textureSize(uTextureConfig, 0).x);
  vec2 blockInfo = texture(uTextureConfig, vec2(uvX, 0.0)).rg;

  vec3 pos = vec3(x, y, z);

  gl_Position = projectionMatrix * modelViewMatrix * vec4( pos, 1.0 );
}
`;

export const F_SHADER = `
uniform sampler2DArray uTextureArray;
uniform sampler2D blockTexture;

varying vec3 vertexNormal;
varying vec2 vertexUV;
varying float textureIndex;

out vec4 fragColor;

void main() {
	fragColor = texture(uTextureArray, vec3(vertexUV, textureIndex));
}
`;
