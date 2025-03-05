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
  private surfaceNoise: SimplexNoise.NoiseFunction2D

  private terrainDensityNoise: SimplexNoise.NoiseFunction3D
  private cavernsNoise: SimplexNoise.NoiseFunction3D
  private noodleCavesNoise: SimplexNoise.NoiseFunction3D

  constructor(params: TerrainGenParams) {
    this.seed = params.seed
    this.params = params
    this.continentalNoise = SimplexNoise.createNoise2D(RNG(this.seed + "continental"))
    this.erosionNoise = SimplexNoise.createNoise2D(RNG(this.seed + "erosion"))
    this.mountainousNoise = SimplexNoise.createNoise2D(RNG(this.seed + "mountainous"))
    this.surfaceNoise = SimplexNoise.createNoise2D(RNG(this.seed + "surfaceVariance"))

    this.humidityNoise = SimplexNoise.createNoise2D(RNG(this.seed + "humidity"))
    this.temperatureNoise = SimplexNoise.createNoise2D(RNG(this.seed + "temperature"))

    this.terrainDensityNoise = SimplexNoise.createNoise3D(RNG(this.seed + "terrainDensity"))

    this.cavernsNoise = SimplexNoise.createNoise3D(RNG(this.seed + "caverns"))
    this.noodleCavesNoise = SimplexNoise.createNoise3D(RNG(this.seed + "noodleCaves"))
  }

  public getContinental(x: number, y: number): number {
    return this.continentalNoise(x * 0.00007, y * 0.0001)
  }

  public getErosion(x: number, y: number): number {
    return this.erosionNoise(x * 0.0001, y * 0.0002)
  }

  public getMountainous(x: number, y: number): number {
    return this.mountainousNoise(x * 0.001, y * 0.001)
  }

  public getSurfaceVariance(x: number, y: number): number {
    return this.surfaceNoise(x * 0.0005, y * 0.0005)
  }

  public getTemperature(x: number, y: number): number {
    return this.temperatureNoise(x * 0.0003, y * 0.0003)
  }

  public getHumidity(x: number, y: number): number {
    return this.humidityNoise(x * 0.0003, y * 0.0003)
  }

  public getTerrainDensity(x: number, y: number, z: number): number {
    return this.terrainDensityNoise(x / 100, y / 100, z / 100)
  }

  public getCavern(x: number, y: number, z: number): number {
    return this.cavernsNoise(x / 100, y / 100, z / 100)
  }

  public getNoodleCave(x: number, y: number, z: number): number {
    return this.noodleCavesNoise(x / 100, y / 100, z / 100)
  }

}

export type NoiseMapType = 
  | "continental" 
  | "erosion" 
  | "mountainous" 
  | "surfaceVariance"
  | "temperature"
  | "humidity";

export function visualizeNoiseMapAsImage(
  terrainMaps: TerrainMaps,
  mapType: NoiseMapType,
  width: number = 900,
  height: number = 900,
  colorMap: boolean = false
): HTMLCanvasElement {
  // Create a canvas element
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Create image data to manipulate pixels directly
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  
  // Store min/max for normalization
  let minValue = Infinity;
  let maxValue = -Infinity;
  
  // First pass: sample all values to find min/max
  const values = new Array(width * height);
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      // Sample the selected noise map
      let noiseValue: number;
      switch (mapType) {
        case "continental":
          noiseValue = terrainMaps.getContinental(x, z);
          break;
        case "erosion":
          noiseValue = terrainMaps.getErosion(x, z);
          break;
        case "mountainous":
          noiseValue = terrainMaps.getMountainous(x, z);
          break;
        case "surfaceVariance":
          noiseValue = terrainMaps.getSurfaceVariance(x, z);
          break;
        case "temperature":
          noiseValue = terrainMaps.getTemperature(x, z);
          break;
        case "humidity":
          noiseValue = terrainMaps.getHumidity(x, z);
          break;
        default:
          noiseValue = 0;
      }
      
      // Store value and update min/max
      values[z * width + x] = noiseValue;
      minValue = Math.min(minValue, noiseValue);
      maxValue = Math.max(maxValue, noiseValue);
    }
  }
  
  // Second pass: set pixel colors based on normalized values
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const index = z * width + x;
      const pixelIndex = index * 4; // 4 values per pixel (RGBA)
      
      // Normalize the noise value to [0, 1]
      const value = values[index];
      const normalizedValue = (value - minValue) / (maxValue - minValue);
      
      if (colorMap) {
        // Apply a colormap (using a simple rainbow gradient)
        const r = Math.floor(getRedComponent(normalizedValue) * 255);
        const g = Math.floor(getGreenComponent(normalizedValue) * 255);
        const b = Math.floor(getBlueComponent(normalizedValue) * 255);
        
        data[pixelIndex] = r;     // R
        data[pixelIndex + 1] = g; // G
        data[pixelIndex + 2] = b; // B
      } else {
        // Simple grayscale
        const colorValue = Math.floor(normalizedValue * 255);
        data[pixelIndex] = colorValue;     // R
        data[pixelIndex + 1] = colorValue; // G
        data[pixelIndex + 2] = colorValue; // B
      }
      
      data[pixelIndex + 3] = 255; // Alpha (fully opaque)
    }
  }
  
  // Put the image data on the canvas
  ctx.putImageData(imageData, 0, 0);
  
  return canvas;
}

// Helper functions for colormap
function getRedComponent(value: number): number {
  // Start blue (0), then cyan, green, yellow, red (1)
  if (value < 0.25) return 0;
  if (value < 0.5) return (value - 0.25) * 4;
  return 1;
}

function getGreenComponent(value: number): number {
  // Start blue (0), then cyan, green, yellow, red (0)
  if (value < 0.25) return value * 4;
  if (value < 0.75) return 1;
  return 1 - (value - 0.75) * 4;
}

function getBlueComponent(value: number): number {
  // Start blue (1), then cyan, green, yellow, red (0)
  if (value < 0.5) return 1;
  return 1 - (value - 0.5) * 2;
}

// Function to display the image in your application
export function displayNoiseMapImage(
  terrainMaps: TerrainMaps,
  mapType: NoiseMapType,
  width: number = 1000,
  height: number = 1000,
  useColorMap: boolean = false
): void {
  // Create the canvas with the noise visualization
  const canvas = visualizeNoiseMapAsImage(terrainMaps, mapType, width, height, useColorMap);
  
  // Create a modal/popup to display the canvas
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = '1000';
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '20px';
  closeButton.style.right = '20px';
  closeButton.style.padding = '10px';
  closeButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // Make canvas responsive
  canvas.style.maxWidth = '90%';
  canvas.style.maxHeight = '90%';
  canvas.style.objectFit = 'contain';
  
  // Add elements to the modal
  modal.appendChild(canvas);
  modal.appendChild(closeButton);
  
  // Add the modal to the document
  document.body.appendChild(modal);
  
  // Close modal when clicking outside the canvas
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      document.body.removeChild(modal);
    }
  });
}