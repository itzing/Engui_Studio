import sharp from "sharp";
import { createHash } from "node:crypto";
import { type MaskInput, fail, limits } from "./core";
import { readMedia } from "./media";

export async function readMask(mask: MaskInput, width: number, height: number) {
  let bytes: Buffer;
  let sourceSha256: string | null = null;
  if (mask.kind === "image") {
    const image = await readMedia(mask.source);
    if (image.width !== width || image.height !== height || image.orientation !== 1)
      fail("INVALID_MASK", "Mask must match source dimensions and have normalized orientation.");
    sourceSha256 = image.hash;
    const { data, info } = await sharp(image.bytes, { limitInputPixels: limits().maxImagePixels }).toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const gray = Buffer.alloc(width * height);
    for (let i = 0; i < gray.length; i++) {
      const o = i * info.channels;
      if (data[o] !== data[o+1] || data[o] !== data[o+2] || data[o+3] !== 255)
        fail("INVALID_MASK", "Use an opaque grayscale mask: white edits, black preserves.");
      gray[i] = data[o];
    }
    if (!gray.some(v => v > 0)) fail("INVALID_MASK", "Mask contains no editable pixels.");
    bytes = await sharp(gray, { raw: { width, height, channels: 1 } }).png().toBuffer();
  } else {
    const gray = Buffer.alloc(width * height);
    for (const box of mask.regions) {
      const x0 = Math.floor(box.x * width), y0 = Math.floor(box.y * height);
      const x1 = Math.min(width, Math.ceil((box.x + box.width) * width)), y1 = Math.min(height, Math.ceil((box.y + box.height) * height));
      for (let y = y0; y < y1; y++) gray.fill(255, y * width + x0, y * width + x1);
    }
    if (!gray.some(v => v > 0)) fail("INVALID_MASK", "Mask contains no editable pixels.");
    bytes = await sharp(gray, { raw: { width, height, channels: 1 } }).png().toBuffer();
  }
  if (bytes.length > limits().maxImageBytes) fail("INVALID_MASK", "Encoded mask exceeds input size limit.");
  return { bytes, snapshot: { input: mask, sha256: createHash("sha256").update(bytes).digest("hex"), sourceSha256, width, height, mimeType: "image/png" } };
}
