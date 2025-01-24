export class BitArray {
  private size: number;
  private array: Uint32Array;

  constructor(size: number) {
    this.size = size; // Number of bits
    this.array = new Uint32Array(Math.ceil(size / 32)); // Allocate storage
  }

  // Get the value of a specific bit
  getBit(index: number) {
    if (index >= this.size || index < 0) throw new RangeError("Index out of bounds");
    const chunkIndex = Math.floor(index / 32); // Determine which 32-bit chunk
    const bitPosition = index % 32; // Determine bit position in chunk
    return (this.array[chunkIndex] & (1 << bitPosition)) !== 0 ? 1 : 0;
  }

  // Set a specific bit to 1
  setBit(index: number) {
    if (index >= this.size || index < 0) throw new RangeError("Index out of bounds");
    const chunkIndex = Math.floor(index / 32);
    const bitPosition = index % 32;
    this.array[chunkIndex] |= 1 << bitPosition;
  }

  // Clear a specific bit (set to 0)
  clearBit(index: number) {
    if (index >= this.size || index < 0) throw new RangeError("Index out of bounds");
    const chunkIndex = Math.floor(index / 32);
    const bitPosition = index % 32;
    this.array[chunkIndex] &= ~(1 << bitPosition);
  }

  // Toggle a specific bit (flip between 0 and 1)
  toggleBit(index: number) {
    if (index >= this.size || index < 0) throw new RangeError("Index out of bounds");
    const chunkIndex = Math.floor(index / 32);
    const bitPosition = index % 32;
    this.array[chunkIndex] ^= 1 << bitPosition;
  }

  // Print the entire bit array as a binary string
  toBinaryString() {
    return Array.from(this.array)
      .map((chunk) => chunk.toString(2).padStart(32, "0")) // Convert each chunk to binary
      .reverse() // Reverse for correct bit order
      .join("")
      .slice(-this.size); // Trim to exact size
  }

  and(other: BitArray) {
    if (this.size !== other.size) {
      throw new Error("BitArrays must be the same size");
    }
    const result = new BitArray(this.size);
    for (let i = 0; i < this.array.length; i++) {
      result.array[i] = this.array[i] & other.array[i];
    }
    return result;
  }

  or(other: BitArray) {
    if (this.size !== other.size) {
      throw new Error("BitArrays must be the same size");
    }
    const result = new BitArray(this.size);
    for (let i = 0; i < this.array.length; i++) {
      result.array[i] = this.array[i] | other.array[i];
    }
    return result;
  }
  
  // XOR operation across both chunks
  xor(other: BitArray) {
    if (this.size !== other.size) {
      throw new Error("BitArrays must be the same size");
    }
    const result = new BitArray(this.size);
    for (let i = 0; i < this.array.length; i++) {
      result.array[i] = this.array[i] ^ other.array[i];
    }
    return result;
  }
  
  // NOT operation
  not() {
    const result = new BitArray(this.size);
    for (let i = 0; i < this.array.length; i++) {
      result.array[i] = ~this.array[i];
    }
    return result;
  }

  leftShift(positions: number) {
    if (positions === 0) return;
    if (positions >= this.size) {
        // If shifting more than total bits, zero everything
        this.array.fill(0);
        return;
    }

    // Handle whole-word shifts first
    const wordShifts = Math.floor(positions / 32);
    const bitShifts = positions % 32;

    if (wordShifts > 0) {
        // Move words left
        for (let i = this.array.length - 1; i >= wordShifts; i--) {
            this.array[i] = this.array[i - wordShifts];
        }
        // Zero out the remaining lower words
        for (let i = wordShifts - 1; i >= 0; i--) {
            this.array[i] = 0;
        }
    }

    if (bitShifts > 0) {
        // Handle remaining bit shifts
        for (let i = this.array.length - 1; i > 0; i--) {
            this.array[i] = (this.array[i] << bitShifts) | 
                            (this.array[i - 1] >>> (32 - bitShifts));
        }
        this.array[0] = this.array[0] << bitShifts;
    }
  }

  rightShift(positions: number) {
    if (positions === 0) return;
    if (positions >= this.size) {
        // If shifting more than total bits, zero everything
        this.array.fill(0);
        return;
    }

    // Handle whole-word shifts first
    const wordShifts = Math.floor(positions / 32);
    const bitShifts = positions % 32;

    if (wordShifts > 0) {
        // Move words right
        for (let i = 0; i < this.array.length - wordShifts; i++) {
            this.array[i] = this.array[i + wordShifts];
        }
        // Zero out the remaining higher words
        for (let i = this.array.length - wordShifts; i < this.array.length; i++) {
            this.array[i] = 0;
        }
    }

    if (bitShifts > 0) {
        // Handle remaining bit shifts
        for (let i = 0; i < this.array.length - 1; i++) {
            this.array[i] = (this.array[i] >>> bitShifts) | 
                            (this.array[i + 1] << (32 - bitShifts));
        }
        this.array[this.array.length - 1] = this.array[this.array.length - 1] >>> bitShifts;
    }
  }

  copy(): BitArray {
    const newBitArray = new BitArray(this.size);
    newBitArray.array = new Uint32Array(this.array); // Creates a new array with copied values
    return newBitArray;
  }

  getBuffer(): ArrayBuffer {
    return this.array.buffer;
  }

  getSize(): number {
    return this.size;
  }

  getArray(): Uint32Array {
    return this.array;
  }

  static getBufferFromBitArrays(bitArrays: BitArray[]): ArrayBuffer {
    // Calculate total size needed
    const totalBytes = bitArrays.reduce((sum, bitArray) => 
        sum + bitArray.array.byteLength, 0);
    
    // Create a new buffer to hold all arrays
    const buffer = new ArrayBuffer(totalBytes);
    const view = new Uint8Array(buffer);
    
    // Copy each BitArray's data into the buffer
    let offset = 0;
    for (const bitArray of bitArrays) {
        const arrayView = new Uint8Array(bitArray.array.buffer);
        view.set(arrayView, offset);
        offset += arrayView.length;
    }
    
    return buffer;
  }

  static fromBuffer(buffer: ArrayBuffer, bitArraySize: number): BitArray[] {
    const uint32Size = Math.ceil(bitArraySize / 32) * 4; // bytes needed per BitArray
    const numArrays = Math.floor(buffer.byteLength / uint32Size);
    const bitArrays: BitArray[] = [];
    
    for (let i = 0; i < numArrays; i++) {
        const slice = buffer.slice(i * uint32Size, (i + 1) * uint32Size);
        const bitArray = new BitArray(bitArraySize);
        bitArray.array = new Uint32Array(slice);
        bitArrays.push(bitArray);
    }
    
    return bitArrays;
  }
}