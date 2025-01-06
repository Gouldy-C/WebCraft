import * as SimplexNoise from "simplex-noise";
import * as FastSimplexNoise from "fast-simplex-noise";
import alea from "alea";
import { clamp, } from "../generalUtils";

export interface FractalNoiseParams {
  amplitude: number;
  frequency: number;
  octaves: number;
  lacunarity: number;
  persistence: number;
  offset: number;
};

export class FractalNoise {
  private readonly fast = true;
  private readonly amplitude: number;
  private readonly frequency: number;
  private readonly octaves: number;
  private readonly lacunarity: number;
  private readonly persistence: number;
  private readonly seed: string | number
  private readonly offset: number;
  private readonly noise2D: CallableFunction
  private readonly noise3D: CallableFunction

  constructor(params: FractalNoiseParams, seed: string | number) {
    this.amplitude = params.amplitude ?? 0.5;
    this.frequency = params.frequency ?? 0.0015;
    this.octaves =  params.octaves ?? 4;
    this.lacunarity = params.lacunarity ?? 2.0;
    this.persistence = params.persistence ?? 0.5;
    this.offset = params.offset ?? 0.4;
    this.seed = seed ?? "default";
    if (this.fast) {
      this.noise2D = FastSimplexNoise.makeNoise2D(alea(this.seed))
      this.noise3D = FastSimplexNoise.makeNoise3D(alea(this.seed))
    } else {
      this.noise2D = SimplexNoise.createNoise2D(alea(this.seed))
      this.noise3D = SimplexNoise.createNoise3D(alea(this.seed))
    }
  }

  public fractal2D(x: number, y: number, ) {
    let freq = this.frequency;
    let amplitude = this.amplitude
    let total = 0;
    let maxValue = 0;

    for (let i = 0; i < this.octaves; i++) {
      total += this.noise2D(x * freq, y * freq) * amplitude;
      maxValue += this.amplitude;
      amplitude *= this.persistence;
      freq *= this.lacunarity;
    }
    total = total / maxValue;
    return total;
  }

  public fractal3D(x: number, y: number, z: number) {
    let freq = this.frequency;
    let amplitude = this.amplitude
    let total = 0;
    let maxValue = 0;

    for (let i = 0; i < this.octaves; i++) {
      total += this.noise3D(x * freq, y * freq, z * freq) * amplitude;
      maxValue += this.amplitude;
      amplitude *= this.persistence;
      freq *= this.lacunarity;
    }
    
    total = total / maxValue;
    return total;
  }
}

