/** Walks the GIF block structure and sums the per-frame delays; returns the duration of one playthrough in ms, or null if it cannot be parsed */
export function gifDurationMs(bytes: Uint8Array): number | null {
  if (bytes.length < 13 || String.fromCharCode(...bytes.subarray(0, 3)) !== "GIF") return null;
  let p = 13;
  if (bytes[10] & 0x80) p += 3 * 2 ** ((bytes[10] & 7) + 1); // global color table

  const skipSubBlocks = () => {
    while (p < bytes.length && bytes[p] !== 0) p += bytes[p] + 1;
    p++; // block terminator
  };

  let total = 0;
  let frames = 0;
  let pendingDelayCs = 0;
  while (p < bytes.length) {
    const b = bytes[p++];
    if (b === 0x3b) break; // trailer
    if (b === 0x21) {
      const label = bytes[p++];
      if (label === 0xf9) {
        pendingDelayCs = bytes[p + 2] | (bytes[p + 3] << 8); // [size, flags, delayLo, delayHi, transparent]
      }
      skipSubBlocks();
    } else if (b === 0x2c) {
      const flags = bytes[p + 8];
      p += 9;
      if (flags & 0x80) p += 3 * 2 ** ((flags & 7) + 1); // local color table
      p++; // LZW minimum code size
      skipSubBlocks();
      // Browsers treat delays of <=1 centisecond as 10 centiseconds
      total += (pendingDelayCs <= 1 ? 10 : pendingDelayCs) * 10;
      pendingDelayCs = 0;
      frames++;
    } else {
      return null; // malformed structure
    }
  }
  return frames > 0 ? total : null;
}
