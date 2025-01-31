attribute vec2 voxleVertexData;
varying vec3 vertexNormal;
varying vec2 vertexUV;

vec3 decodeNormal(uint bits) {
  switch(bits) {
    case 0u: return vec3(0.0, 1.0, 0.0);
    case 1u: return vec3(0.0, -1.0, 0.0);
    case 2u: return vec3(1.0, 0.0, 0.0);
    case 3u: return vec3(-1.0, 0.0, 0.0);
    case 4u: return vec3(0.0, 0.0, 1.0);
    case 5u: return vec3(0.0, 0.0, -1.0);
    default: return vec3(0.0, 1.0, 0.0);
  }
}

void main() {
  uint vertexData = voxleVertexData.x;
  uint voxleData = voxleVertexData.y;

  // Extract position bits (6 bits per axis, range 0 – 63)
  uint x_bits = vertexData & 0x3Fu; // Mask 6 bits for X
  uint y_bits = (vertexData >> 6) & 0x3Fu; // Mask 6 bits for Y
  uint z_bits = (vertexData >> 12) & 0x3Fu; // Mask 6 bits for Z

  // Scale to [0.0 – 63.0] to cover the 64-unit chunk
  vec3 pos = vec3(
    float(x_bits),
    float(y_bits),
    float(z_bits)
  );

  // Extract normal (3 bits)
  uint normalBits = (vertexData >> 18) & 0x7u;
  vNormal = decodeNormal(normalBits);

  // Block ID (10 bits) and AO (1 bit)
  uint packed = voxleVertexData.x;
  vBlockId = (packed >> 1) & 0x3FFu;
  vAo = packed & 0x1u;

  // Transform to clip space
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  vUv = uv;
}