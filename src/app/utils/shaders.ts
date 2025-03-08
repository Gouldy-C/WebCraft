export const V_SHADER = `
precision highp float;
precision highp sampler2D;
precision highp int;

attribute uvec2 voxel;
uniform sampler2D uTextureConfig; // X: numTextures , Y: startIndex in the texture array

out vec3 vertexNormal;
out vec2 vertexUV;
out float textureIndex;
out float quadWidth;
out float quadHeight;

vec3 decodeNormal(uint normalBits) {
  switch(normalBits) {
    case 0u: return vec3(1.0, 0.0, 0.0);
    case 1u: return vec3(-1.0, 0.0, 0.0);
    case 2u: return vec3(0.0, 1.0, 0.0);
    case 3u: return vec3(0.0, -1.0, 0.0);
    case 4u: return vec3(0.0, 0.0, 1.0);
    case 5u: return vec3(0.0, 0.0, -1.0);
    default: return vec3(1.0, 0.0, 0.0);
  }
}

vec2 decodeUVCoords(uint UVBits) {
  switch(UVBits) {
    case 0u: return vec2(0.0, 1.0);
    case 1u: return vec2(1.0, 1.0);
    case 2u: return vec2(1.0, 0.0);
    case 3u: return vec2(0.0, 0.0);
    default: return vec2(0.0, 0.0);
  }
}

float getTextureIndex(float blockId, vec3 normal) {
  float textureSize = float(textureSize(uTextureConfig, 0).x);
  float uvX = blockId / (textureSize - 1.0);
  vec2 blockInfo = texture(uTextureConfig, vec2(uvX, 0)).rg;
  float numTextures = blockInfo.r * 255.0;
  float startIndex = blockInfo.g * 255.0;

  bool isTop = normal.y > 0.9;
  bool isBottom = normal.y < -0.9;
  bool isRight = normal.x > 0.9;
  bool isLeft = normal.x < -0.9;
  bool isFront = normal.z > 0.9;
  bool isBack = normal.z < -0.9;

  if (numTextures >= 6.0) {
    if (isTop) return startIndex;
    if (isBottom) return startIndex + 1.0;
    if (isFront) return startIndex + 2.0;
    if (isBack) return startIndex + 3.0;
    if (isRight) return startIndex + 4.0;
    if (isLeft) return startIndex + 5.0;
  }
  else if (numTextures >= 4.0) {
    if (isTop) return startIndex;
    if (isBottom) return startIndex + 1.0;
    if (isFront) return startIndex + 2.0; 
    return startIndex + 3.0;
  }
  else if (numTextures >= 3.0) {
    if (isTop) return startIndex;
    if (isBottom) return startIndex + 1.0;
    return startIndex + 2.0;
  }

  return startIndex;
}

void main() {
  float x = position.x;
  float y = position.y;
  float z = position.z;

  float blockId = float(uint(voxel.x) & 0xFFFu);
  float width = float((uint(voxel.x) >> 12u) & 0x1Fu);
  float height = float((uint(voxel.x) >> 17u) & 0x1Fu);
  uint normalIndex = (uint(voxel.x) >> 22u) & 0x7u;
  uint UVIndex = (uint(voxel.x) >> 25u) & 0x3u;
  
  vertexNormal = decodeNormal(normalIndex);
  vertexUV = decodeUVCoords(UVIndex);
  textureIndex = getTextureIndex(blockId, vertexNormal);
  quadWidth = width;
  quadHeight = height;

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4( x, y, z, 1.0 );
}
`;

export const F_SHADER = `
precision highp float;
precision highp sampler2DArray;

uniform sampler2DArray uTextureArray;

in vec3 vertexNormal;
in vec2 vertexUV;
in float textureIndex;
in float quadWidth;
in float quadHeight;

out vec4 fragColor;

void main() {
  vec2 uv = fract(vertexUV * vec2(quadWidth + 1.0, quadHeight + 1.0));
  vec4 texColor = texture(uTextureArray, vec3(uv, textureIndex));
  fragColor = texColor;

	// vec3 debugNormal = normalize(vertexNormal) * 0.5 + 0.5;
  // fragColor = vec4(debugNormal, 1.0);
}
`;
