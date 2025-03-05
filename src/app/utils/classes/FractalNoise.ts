import * as SimplexNoise from "simplex-noise";
import * as FastSimplexNoise from "fast-simplex-noise";
import { RNG } from "../generalUtils";

export interface FractalNoiseParams {
  amplitude: number;
  frequency: number;
  octaves: number;
  lacunarity: number;
  persistence: number;
  offset: number
};

export class FractalNoise {
  private amplitude: number;
  private frequency: number;
  private octaves: number;
  private lacunarity: number;
  private persistence: number;
  private offset: number;
  private seed: string | number;
  private noise2D: (x: number, y: number) => number;
  private noise3D: (x: number, y: number, z: number) => number;

  constructor(params: FractalNoiseParams, seed: string | number) {
    this.amplitude = params.amplitude;
    this.frequency = params.frequency;
    this.octaves = params.octaves;
    this.lacunarity = params.lacunarity;
    this.persistence = params.persistence;
    this.offset = params.offset

    this.seed = seed
    const rng = RNG(this.seed);

    this.noise2D = SimplexNoise.createNoise2D(rng);
    this.noise3D = SimplexNoise.createNoise3D(rng);
  }

  public fractal2D(x: number, y: number): number {
    let frequency = this.frequency;
    let amplitude = this.amplitude;
    let total = 0;
    let maxValue = 0;

    for (let i = 0; i < this.octaves; i++) {
      const noiseValue = this.noise2D(x * frequency, y * frequency);
      total += noiseValue * amplitude;
      maxValue += amplitude;
      amplitude *= this.persistence;
      frequency *= this.lacunarity;
    }
    return total * (this.amplitude / maxValue) + this.offset;
  }

  public fractal3D(x: number, y: number, z: number): number {
    let frequency = this.frequency;
    let amplitude = this.amplitude;
    let total = 0;
    let maxValue = 0;

    for (let i = 0; i < this.octaves; i++) {
      const noiseValue = this.noise3D(x * frequency, y * frequency, z * frequency);
      total += noiseValue * amplitude;
      maxValue += amplitude;
      amplitude *= this.persistence;
      frequency *= this.lacunarity;
    }
    return total * (this.amplitude / maxValue) + this.offset;
  }
}

