import * as SimplexNoise from "simplex-noise";
import alea from "alea";

export interface FractalNoiseParams {
  maxHeight: number;
  frequency: number;
  octaves: number;
  lacunarity: number;
  persistence: number;
  offset: number;
};

export class FractalNoise {
  private readonly maxHeight: number;
  private readonly frequency: number;
  private readonly octaves: number;
  private readonly lacunarity: number;
  private readonly persistence: number;
  private readonly seed: string | number

  constructor(params: FractalNoiseParams, seed: string | number) {
    this.maxHeight = params.maxHeight ?? 0.5;
    this.frequency = params.frequency ?? 0.0015;
    this.octaves =  params.octaves ?? 4;
    this.lacunarity = params.lacunarity ?? 2.0;
    this.persistence = params.persistence ?? 0.5;
    this.seed = seed ?? "default";
  }

  public fractal2D(x: number, y: number, ) {
    const noise2D = SimplexNoise.createNoise2D(alea(this.seed))
    let freq = this.frequency;
    let amplitude = this.maxHeight / 2;
    let total = 0;

    for (let i = 0; i < this.octaves; i++) {
      total += noise2D(x * freq, y * freq) * amplitude;
      amplitude *= this.persistence;
      freq *= this.lacunarity;
    }
    if (total < -this.maxHeight) return -this.maxHeight;
    if (total > this.maxHeight) return this.maxHeight;
    return total;
  }

  public fractal3D(x: number, y: number, z: number) {
    const noise3D = SimplexNoise.createNoise3D(alea(this.seed))
    let freq = this.frequency;
    let amplitude = this.maxHeight / 2;
    let total = 0;

    for (let i = 0; i < this.octaves; i++) {
      total += noise3D(x * freq, y * freq, z * freq) * amplitude;
      amplitude *= this.persistence;
      freq *= this.lacunarity;
    }
  
    if (total < -this.maxHeight) return -this.maxHeight;
    if (total > this.maxHeight) return this.maxHeight;
    return total;
  }
}

