import * as THREE from "three"
import * as SimplexNoise from "simplex-noise";
import { TerrainGenParams } from "../../components/TerrainManager";
import { RNG } from "../generalUtils";




export class TerrainMaps {
  private seed: string | number
  private params: TerrainGenParams
  private continentalNoise: SimplexNoise.NoiseFunction2D
  private erosionNoise: SimplexNoise.NoiseFunction2D
  private mountainousNoise: SimplexNoise.NoiseFunction2D
  private humidityNoise: SimplexNoise.NoiseFunction2D
  private temperatureNoise: SimplexNoise.NoiseFunction2D

  constructor(seed: string | number, params: TerrainGenParams) {
    this.seed = seed
    this.params = params
    this.continentalNoise = SimplexNoise.createNoise2D(RNG(this.seed + "continental"))
    this.erosionNoise = SimplexNoise.createNoise2D(RNG(this.seed + "erosion"))
    this.mountainousNoise = SimplexNoise.createNoise2D(RNG(this.seed + "mountainous"))

    this.humidityNoise = SimplexNoise.createNoise2D(RNG(this.seed + "humidity"))
    this.temperatureNoise = SimplexNoise.createNoise2D(RNG(this.seed + "temperature"))

    this._init()
  }

  private _init () {

  }

}