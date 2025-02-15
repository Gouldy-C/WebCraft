

type PlaneTypes = 'xPos' | 'xNeg' | 'yPos' | 'yNeg' | 'zPos' | 'zNeg'

export class RowToPlaneSwizzler {
  planes: Record<PlaneTypes, Uint32Array[]>
  size: number


  constructor(size: number) {
    this.size = size;
    this.planes = {
      xPos: new Array(size).fill(0).map(() => new Uint32Array(size)),
      xNeg: new Array(size).fill(0).map(() => new Uint32Array(size)),
      yPos: new Array(size).fill(0).map(() => new Uint32Array(size)),
      yNeg: new Array(size).fill(0).map(() => new Uint32Array(size)),
      zPos: new Array(size).fill(0).map(() => new Uint32Array(size)),
      zNeg: new Array(size).fill(0).map(() => new Uint32Array(size))
    };
  }

  processFacesFromRows(binaryArray: Uint32Array) {
    for (let v = 0; v < this.size; v++) {
      for (let u = 0; u < this.size; u++) {
        // Process X faces (YZ plane)
        const xBinary = binaryArray[u + v * this.size];
        const xPosShift = (xBinary << 1) >>> 0;
        const xNegShift = (xBinary >>> 1) >>> 0;
        const xPosAir = (~xPosShift) >>> 0;
        const xNegAir = (~xNegShift) >>> 0;
        const xPosFaces = (xBinary & xPosAir) >>> 0;
        const xNegFaces = (xBinary & xNegAir) >>> 0;
        
        // Store in YZ planes
        this.planes.xPos[v][u] = xPosFaces;
        this.planes.xNeg[v][u] = xNegFaces;

        // Process Y faces (XZ plane)
        const yBinary = binaryArray[u + v * this.size + (this.size * this.size)];
        const yPosShift = (yBinary << 1) >>> 0;
        const yNegShift = (yBinary >>> 1) >>> 0;
        const yPosAir = (~yPosShift) >>> 0;
        const yNegAir = (~yNegShift) >>> 0;
        const yPosFaces = (yBinary & yPosAir) >>> 0;
        const yNegFaces = (yBinary & yNegAir) >>> 0;
        
        // Store in XZ planes
        this.planes.yPos[v][u] = yPosFaces;
        this.planes.yNeg[v][u] = yNegFaces;

        // Process Z faces (XY plane)
        const zBinary = binaryArray[u + v * this.size + (2 * this.size * this.size)];
        const zPosShift = (zBinary << 1) >>> 0;
        const zNegShift = (zBinary >>> 1) >>> 0;
        const zPosAir = (~zPosShift) >>> 0;
        const zNegAir = (~zNegShift) >>> 0;
        const zPosFaces = (zBinary & zPosAir) >>> 0;
        const zNegFaces = (zBinary & zNegAir) >>> 0;
        
        // Store in XY planes
        this.planes.zPos[v][u] = zPosFaces;
        this.planes.zNeg[v][u] = zNegFaces;
      }
    }
  }

  // Helper method to get a specific plane for greedy meshing
  getPlane(direction: 'xPos' | 'xNeg' | 'yPos' | 'yNeg' | 'zPos' | 'zNeg', index: number) {
    return this.planes[direction][index];
  }

  visualizePlane(direction: 'xPos' | 'xNeg' | 'yPos' | 'yNeg' | 'zPos' | 'zNeg', index: number) {
    const plane: Uint32Array  = this.getPlane(direction, index);
    const result: number[][] = [];
    for (let y = 0; y < this.size; y++) {
      result.push([]);
      for (let x = 0; x < this.size; x++) {
        result[y].push(plane[y] & (1 << x));
      }
    }
    return result;
  }
}