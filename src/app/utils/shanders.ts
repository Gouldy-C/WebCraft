export const V_SHADER = `
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  vNormal = normal;
  vUv = uv;
}
`;

export const F_SHADER = `
uniform vec3 color;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  //gl_FragColor = vec4(vNormal, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
`;