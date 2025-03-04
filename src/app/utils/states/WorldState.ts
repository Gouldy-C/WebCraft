import { TerrainGenParams } from "../../components/TerrainManager";
import { TimeObject } from "../../components/unused/Time";

export interface WorldStore {
  objects: { [key: string]: any };
  players: { [key: string]: any };
  time: TimeObject;
  terrain: TerrainGenParams;
  diffs: Record<string, { blockId: number }>;
}

const CHUNK_SIZE = 32;
const SURFACE_HEIGHT = CHUNK_SIZE * 16;

export const defaultWorldStore: WorldStore = {
  time: { time: 0, days: 0, years: 0, minutesInDay: 20, daysInYear: 365 },
  objects: {},
  players: {},
  terrain: {
    seed: "default",
    chunkSize: CHUNK_SIZE,
    maxWorldHeight: SURFACE_HEIGHT,
    hDrawDist: 10, 
    vDrawDist: 1,
    terrainSampleRate: 4,

    fractalNoise: {
      amplitude: 1,
      frequency: 0.0007,
      octaves: 5,
      lacunarity: 2.0,
      persistence: 0.5,
    },

    seaLevel: 0.25 * SURFACE_HEIGHT,
    mountainHeight: 0.65 * SURFACE_HEIGHT,
    snowHeight: 0.72 * SURFACE_HEIGHT,
    mountainVariance: 30,
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