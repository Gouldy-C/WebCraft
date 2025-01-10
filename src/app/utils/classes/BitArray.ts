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
}