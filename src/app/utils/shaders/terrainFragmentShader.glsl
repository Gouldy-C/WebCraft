uniform sampler2DArray uTextureArray;
uniform sampler2D uTextureConfig; // R: numTextures per Block, G: startIndex in the texture array
in vec3 vNormal;
in vec2 vUv;
flat in uint vertexData;
flat in uint voxleData;
flat in uint vAo;
flat in uint vBlockId;

out vec4 fragColor;

float getTextureIndex(float blockId, vec3 normal) {
  // Calculate UV based on texture width
  float uvX = blockId / float(textureSize(uTextureConfig, 0).x - 1);
  vec2 blockInfo = texture2D(uTextureConfig, vec2(uvX, 0.0)).rg;
  float numTextures = blockInfo.r;
  float startIndex = blockInfo.g;

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
    return startIndex + 2.0; // All sides share texture
  }
  // Default to single texture
  return startIndex;
}

void main() {
  // 1. Get correct texture index
  // float texIndex = getTextureIndex(vBlockId, vNormal);
  // vec4 texColor = texture(textureArray, vec3(vUv, texIndex));

  // 2. Apply ambient occlusion
  float aoFactor = float(vAo) == 1.0 ? 0.75 : 1.0; // Darken occluded areas

  // 3. Simple directional lighting
  vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
  float light = max(dot(vNormal, lightDir), 0.2); // 0.2 = ambient light

  vec3 fixColor = vec3(0.2, 0.4, 0.1);

  // 4. Combine effects
  // vec3 finalColor = texColor.rgb * light * aoFactor;
  vec3 finalColor = fixColor * light * aoFactor;
  // gl_FragColor = vec4(finalColor, texColor.a);
  fragColor = vec4(fixColor, 1.0);
}