export const V_SHADER = `
precision highp float;
precision highp sampler2D;
precision highp int;

uniform sampler2D uTextureConfig; // X: numTextures , Y: startIndex in the texture array

out vec3 vertexNormal;
out vec2 vertexUV;
out float textureIndex;

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
    case 0u: return vec2(0.0, 0.0);
    case 1u: return vec2(1.0, 0.0);
    case 2u: return vec2(1.0, 1.0);
    case 3u: return vec2(0.0, 1.0);
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
  float x = float(uint(position.x) & 0x1Fu);
  float y = float(uint(position.x) >> 5 & 0x1Fu);
  float z = float(uint(position.x) >> 10 & 0x1Fu);
  uint normalIndex = uint(position.x) >> 15 & 0x7u;
  uint UVIndex = uint(position.x) >> 18 & 0x3u;

  float blockId = float(uint(position.y) & 0xFFFu);
  
  vertexNormal = decodeNormal(normalIndex);
  vertexUV = decodeUVCoords(UVIndex);
  textureIndex = getTextureIndex(blockId, vertexNormal);

  vec3 pos = vec3(x, y, z);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4( pos, 1.0 );
}
`;

export const F_SHADER = `
precision highp float;
precision highp sampler2DArray;

uniform sampler2DArray uTextureArray;

in vec3 vertexNormal;
in vec2 vertexUV;
in float textureIndex;

out vec4 fragColor;

void main() {
  vec2 uv = fract(vertexUV * vec2(3.0, 3.0));
  vec4 texColor = texture(uTextureArray, vec3(vertexUV, textureIndex));
	vec3 debugNormal = normalize(vertexNormal) * 0.5 + 0.5;

  fragColor = texColor;
  // fragColor = vec4(debugNormal, 1.0);
}
`;
