import { TerrainGenParams } from "../../components/TerrainManager";
import { TimeObject } from "../../components/unused/Time";

export interface WorldStore {
  objects: { [key: string]: any };
  players: { [key: string]: any };
  time: TimeObject;
  terrain: TerrainGenParams;
  diffs: Record<string, { blockId: number }>;
}

export const defaultWorldStore: WorldStore = {
  time: { time: 0, days: 0, years: 0, minutesInDay: 20, daysInYear: 365 },
  objects: {},
  players: {},
  terrain: {
    seed: crypto.randomUUID(),// "default", // crypto.randomUUID(),
    chunkSize: 32,
    maxWorldHeight: 32 * 16, // chunkSize * 12
    hDrawDist: 10, 
    vDrawDist: 0,
    terrainSampleRate: 4,

    fractalNoise: {
      amplitude: 1,
      frequency: 0.0008,
      octaves: 6,
      lacunarity: 2,
      persistence: 0.5,
    },

    seaLevel: 100,
    mountainHeight: 310,
    mountainVariance: 30,
    snowHeight: 330,
    snowVariance: 30,
    dirtVariance: 20,
    sandVariance: 6,

    trees: {
      trunk: {
        diameter: 1,
        minHeight: 5,
        maxHeight: 10,
      },
      canopy: {
        minRadius: 3,
        maxRadius: 5,
      },
      buffer: 3,
      density: 0.008,
    },

  },
  diffs: {},
};