export class BitArray {
  constructor(size, bits) {
    this.size = size;
    this.bits = (bits ?? 0n) & ((1n << BigInt(size)) - 1n);
  }

  // Get the value of a specific bit
  getBit(index) {
    if (index >= this.size || index < 0) throw new RangeError("Index out of bounds");
    return (this.bits & (1n << BigInt(index))) !== 0n ? 1 : 0;
  }

  // Set a specific bit to 1 (returns new instance)
  setBit(index) {
    if (index >= this.size || index < 0) throw new RangeError("Index out of bounds");
    this.bits = (this.bits | (1n << BigInt(index)));
  }

  // Clear a specific bit (returns new instance)
  clearBit(index) {
    if (index >= this.size || index < 0) throw new RangeError("Index out of bounds");
    this.bits = (this.bits & ~(1n << BigInt(index)));
  }

  // Toggle a specific bit (returns new instance)
  toggleBit(index) {
    if (index >= this.size || index < 0) throw new RangeError("Index out of bounds");
    this.bits = (this.bits ^ (1n << BigInt(index)));
  }

  // Print the entire bit array as a binary string
  toBinaryString() {
    return this.bits.toString(2)
      .padStart(this.size, '0')
      .slice(-this.size);
  }

  // Bitwise AND operation (returns new instance)
  and(other) {
    if (this.size !== other.size) throw new Error("BitArrays must be the same size");
    return new BitArray(this.size, this.bits & other.bits);
  }

  // Bitwise OR operation (returns new instance)
  or(other) {
    if (this.size !== other.size) throw new Error("BitArrays must be the same size");
    return new BitArray(this.size, this.bits | other.bits);
  }

  // Bitwise XOR operation (returns new instance)
  xor(other) {
    if (this.size !== other.size) throw new Error("BitArrays must be the same size");
    return new BitArray(this.size, this.bits ^ other.bits);
  }

  // Bitwise NOT operation (returns new instance)
  not() {
    const numBits = Math.ceil(this.size / 32) * 32;
    const inversionMask = (1n << BigInt(numBits)) - 1n;
    return new BitArray(this.size, (~this.bits) & inversionMask);
  }

  // Left shift operation (returns new instance)
  leftShift(positions) {
    if (positions < 0) throw new Error("Positions must be non-negative");
    if (positions === 0) return this.copy();
    if (positions >= this.size) return new BitArray(this.size);
    return new BitArray(this.size, this.bits << BigInt(positions));
  }

  // Right shift operation (returns new instance)
  rightShift(positions) {
    if (positions < 0) throw new Error("Positions must be non-negative");
    if (positions === 0) return this.copy();
    if (positions >= this.size) return new BitArray(this.size);
    return new BitArray(this.size, this.bits >> BigInt(positions));
  }

  // Create a copy of the BitArray
  copy() {
    return new BitArray(this.size, this.bits);
  }

  // Get the underlying buffer
  getBuffer() {
    const numChunks = Math.ceil(this.size / 32);
    const chunks = new Uint32Array(numChunks);
    let temp = this.bits;
    for (let i = 0; i < numChunks; i++) {
      chunks[i] = Number(temp & 0xFFFFFFFFn);
      temp >>= 32n;
    }
    return chunks.buffer;
  }

  getSize() {
    return this.size;
  }

  // Static method to concatenate multiple BitArrays into a single buffer
  static getBufferFromBitArrays(bitArrays) {
    const buffers = bitArrays.map(ba => ba.getBuffer());
    const totalBytes = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const buf of buffers) {
      combined.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }
    return combined.buffer;
  }

  // Static method to create BitArrays from a buffer
  static fromBuffer(buffer, bitArraySize) {
    const uint32Size = Math.ceil(bitArraySize / 32);
    const view = new Uint32Array(buffer);
    const result = [];
    
    for (let i = 0; i < view.length; i += uint32Size) {
      const slice = view.subarray(i, i + uint32Size);
      let bits = 0n;
      for (let j = 0; j < slice.length; j++) {
        bits |= BigInt(slice[j]) << BigInt(j * 32);
      }
      result.push(new BitArray(bitArraySize, bits));
    }
    return result;
  }
}

const ba1 = new BitArray(64);
console.log(ba1.toBinaryString()); // 00000000
const ba2 = ba1.toggleBit(1)
console.log(ba1.toBinaryString()); // 00101000

// console.log(ba2.leftShift(2).toBinaryString()); // 10100000
// console.log(ba2.rightShift(2).toBinaryString()); // 00001010

// const buffer = ba2.getBuffer();
// const restored = BitArray.fromBuffer(buffer, 64)[0];
// console.log(restored.toBinaryString()); // 10100000

// const arrayBuffer = BitArray.getBufferFromBitArrays([ba1, ba2]);
// const restoredArray = BitArray.fromBuffer(arrayBuffer, 64);
// console.log(restoredArray[0].toBinaryString()); // 00101000
// console.log(restoredArray[1].toBinaryString()); // 10100000