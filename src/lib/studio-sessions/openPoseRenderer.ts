import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

export type OpenPoseRendererTransform = {
  centerX: number;
  centerY: number;
  poseHeight: number;
  rotationDeg: number;
  flipX: boolean;
};

export type OpenPoseRendererInput = {
  poseKeypointJson: unknown;
  width: number;
  height: number;
  transform: OpenPoseRendererTransform;
  minConfidence?: number;
  outputPath?: string;
};

export type OpenPosePoint = {
  index: number;
  x: number;
  y: number;
  confidence: number;
};

export type RenderedOpenPosePoint = OpenPosePoint & {
  canvasX: number;
  canvasY: number;
};

type Rgba = [number, number, number, number];

type PointLike = { x?: unknown; y?: unknown; confidence?: unknown; score?: unknown; c?: unknown };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MIN_DIMENSION = 1;
const MAX_DIMENSION = 8192;
const DEFAULT_MIN_CONFIDENCE = 0.01;
const DEFAULT_JOINT_RADIUS = 4;
const DEFAULT_LINE_THICKNESS = 4;

// BODY_25-ish limb order. COCO/OpenPose bodies still render safely when later indexes are absent.
const BODY_LIMBS: Array<[number, number, Rgba]> = [
  [1, 8, [255, 0, 0, 255]],
  [1, 2, [255, 85, 0, 255]],
  [2, 3, [255, 170, 0, 255]],
  [3, 4, [255, 255, 0, 255]],
  [1, 5, [170, 255, 0, 255]],
  [5, 6, [85, 255, 0, 255]],
  [6, 7, [0, 255, 0, 255]],
  [8, 9, [0, 255, 85, 255]],
  [9, 10, [0, 255, 170, 255]],
  [10, 11, [0, 255, 255, 255]],
  [8, 12, [0, 170, 255, 255]],
  [12, 13, [0, 85, 255, 255]],
  [13, 14, [0, 0, 255, 255]],
  [1, 0, [85, 0, 255, 255]],
  [0, 15, [170, 0, 255, 255]],
  [15, 17, [255, 0, 255, 255]],
  [0, 16, [255, 0, 170, 255]],
  [16, 18, [255, 0, 85, 255]],
  [14, 19, [255, 255, 85, 255]],
  [19, 20, [255, 255, 170, 255]],
  [14, 21, [255, 170, 255, 255]],
  [11, 22, [170, 255, 255, 255]],
  [22, 23, [85, 255, 255, 255]],
  [11, 24, [85, 170, 255, 255]],
];

const JOINT_COLORS: Rgba[] = [
  [255, 0, 0, 255], [255, 85, 0, 255], [255, 170, 0, 255], [255, 255, 0, 255], [170, 255, 0, 255],
  [85, 255, 0, 255], [0, 255, 0, 255], [0, 255, 85, 255], [0, 255, 170, 255], [0, 255, 255, 255],
  [0, 170, 255, 255], [0, 85, 255, 255], [0, 0, 255, 255], [85, 0, 255, 255], [170, 0, 255, 255],
  [255, 0, 255, 255], [255, 0, 170, 255], [255, 0, 85, 255], [255, 85, 85, 255], [255, 170, 85, 255],
  [255, 255, 85, 255], [170, 255, 85, 255], [85, 255, 170, 255], [85, 170, 255, 255], [170, 85, 255, 255],
];

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDimension(value: number, label: string) {
  if (!Number.isInteger(value) || value < MIN_DIMENSION || value > MAX_DIMENSION) {
    throw new Error(`${label} must be an integer between ${MIN_DIMENSION} and ${MAX_DIMENSION}`);
  }
  return value;
}

function parseJsonMaybe(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseFlatKeypointArray(value: unknown, minConfidence: number): OpenPosePoint[] {
  if (!Array.isArray(value)) return [];
  const numbers = value.map(readFiniteNumber);
  if (numbers.length < 2) return [];

  const stride = numbers.length % 3 === 0 ? 3 : 2;
  const points: OpenPosePoint[] = [];
  for (let i = 0; i + 1 < numbers.length; i += stride) {
    const x = numbers[i];
    const y = numbers[i + 1];
    const confidence = stride === 3 ? numbers[i + 2] ?? 1 : 1;
    if (x === null || y === null || confidence === null) continue;
    if (confidence < minConfidence) continue;
    if (x === 0 && y === 0 && confidence <= minConfidence) continue;
    points.push({ index: Math.floor(i / stride), x, y, confidence });
  }
  return points;
}

function parsePointObjectArray(value: unknown, minConfidence: number): OpenPosePoint[] {
  if (!Array.isArray(value)) return [];
  const points: OpenPosePoint[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const point = item as PointLike;
    const x = readFiniteNumber(point.x);
    const y = readFiniteNumber(point.y);
    const confidence = readFiniteNumber(point.confidence ?? point.score ?? point.c) ?? 1;
    if (x === null || y === null || confidence < minConfidence) return;
    points.push({ index, x, y, confidence });
  });
  return points;
}

function collectPointCandidates(value: unknown, output: OpenPosePoint[][], minConfidence: number, depth = 0) {
  if (depth > 6 || value == null) return;
  const parsed = parseJsonMaybe(value);

  const flat = parseFlatKeypointArray(parsed, minConfidence);
  if (flat.length > 0) output.push(flat);

  const objectPoints = parsePointObjectArray(parsed, minConfidence);
  if (objectPoints.length > 0) output.push(objectPoints);

  if (Array.isArray(parsed)) {
    parsed.forEach((item) => collectPointCandidates(item, output, minConfidence, depth + 1));
    return;
  }

  if (typeof parsed !== 'object') return;
  const record = parsed as Record<string, unknown>;
  const likelyKeys = [
    'pose_keypoints_2d',
    'pose_keypoint_2d',
    'body_keypoints_2d',
    'candidate',
    'keypoints',
    'points',
    'body',
    'bodies',
    'people',
    'openpose',
    'pose',
  ];

  for (const key of likelyKeys) {
    if (key in record) collectPointCandidates(record[key], output, minConfidence, depth + 1);
  }
}

export function extractOpenPoseBodyKeypoints(poseKeypointJson: unknown, minConfidence = DEFAULT_MIN_CONFIDENCE): OpenPosePoint[] {
  const candidates: OpenPosePoint[][] = [];
  collectPointCandidates(poseKeypointJson, candidates, minConfidence);
  return candidates.sort((a, b) => b.length - a.length)[0] ?? [];
}

function computeBBox(points: Array<{ x: number; y: number }>) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

export function transformOpenPoseKeypoints(input: OpenPoseRendererInput): RenderedOpenPosePoint[] {
  const width = normalizeDimension(input.width, 'width');
  const height = normalizeDimension(input.height, 'height');
  const points = extractOpenPoseBodyKeypoints(input.poseKeypointJson, input.minConfidence ?? DEFAULT_MIN_CONFIDENCE);
  if (points.length === 0) return [];

  const sourceBBox = computeBBox(points);
  const radians = ((input.transform.rotationDeg || 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const rotated = points.map((point) => {
    const centeredX = point.x - sourceBBox.centerX;
    const centeredY = point.y - sourceBBox.centerY;
    const flippedX = input.transform.flipX ? -centeredX : centeredX;
    return {
      ...point,
      x: flippedX * cos - centeredY * sin,
      y: flippedX * sin + centeredY * cos,
    };
  });

  const rotatedBBox = computeBBox(rotated);
  const sourceHeight = rotatedBBox.height > 0 ? rotatedBBox.height : Math.max(rotatedBBox.width, 1);
  const targetPoseHeight = clamp(readFiniteNumber(input.transform.poseHeight) ?? 0.78, 0.05, 2) * height;
  const scale = targetPoseHeight / sourceHeight;
  const targetCenterX = clamp(readFiniteNumber(input.transform.centerX) ?? 0.5, -0.5, 1.5) * width;
  const targetCenterY = clamp(readFiniteNumber(input.transform.centerY) ?? 0.58, -0.5, 1.5) * height;

  return rotated.map((point) => ({
    index: point.index,
    x: point.x,
    y: point.y,
    confidence: point.confidence,
    canvasX: targetCenterX + point.x * scale,
    canvasY: targetCenterY + point.y * scale,
  }));
}

function setPixel(buffer: Buffer, width: number, height: number, x: number, y: number, color: Rgba) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= width || py >= height) return;
  const offset = (py * width + px) * 4;
  buffer[offset] = color[0];
  buffer[offset + 1] = color[1];
  buffer[offset + 2] = color[2];
  buffer[offset + 3] = color[3];
}

function drawCircle(buffer: Buffer, width: number, height: number, centerX: number, centerY: number, radius: number, color: Rgba) {
  const r = Math.max(1, Math.round(radius));
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      if (x * x + y * y <= r * r) setPixel(buffer, width, height, centerX + x, centerY + y, color);
    }
  }
}

function drawLine(buffer: Buffer, width: number, height: number, x1: number, y1: number, x2: number, y2: number, thickness: number, color: Rgba) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const radius = Math.max(1, Math.round(thickness / 2));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    drawCircle(buffer, width, height, x1 + dx * t, y1 + dy * t, radius, color);
  }
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer: Buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePngRgba(width: number, height: number, rgba: Buffer) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (stride + 1);
    scanlines[rowOffset] = 0;
    rgba.copy(scanlines, rowOffset + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}


export type OpenPosePngControlInput = {
  sourcePath: string;
  width: number;
  height: number;
  transform: OpenPoseRendererTransform;
  outputPath?: string;
};

type DecodedPng = { width: number; height: number; rgba: Buffer };

function paethPredictor(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function decodePngRgba(buffer: Buffer): DecodedPng {
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) throw new Error('OpenPose source is not a PNG');
  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
  }
  if (bitDepth !== 8 || interlace !== 0) throw new Error('Only non-interlaced 8-bit PNG OpenPose sources are supported');
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!channels) throw new Error(`Unsupported OpenPose PNG color type: ${colorType}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const unfiltered = Buffer.alloc(stride * height);
  let rawOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset++];
    const rowStart = y * stride;
    const prevStart = (y - 1) * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[rawOffset++];
      const left = x >= channels ? unfiltered[rowStart + x - channels] : 0;
      const up = y > 0 ? unfiltered[prevStart + x] : 0;
      const upLeft = y > 0 && x >= channels ? unfiltered[prevStart + x - channels] : 0;
      let decoded = value;
      if (filter === 1) decoded = (value + left) & 0xff;
      else if (filter === 2) decoded = (value + up) & 0xff;
      else if (filter === 3) decoded = (value + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) decoded = (value + paethPredictor(left, up, upLeft)) & 0xff;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter: ${filter}`);
      unfiltered[rowStart + x] = decoded;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, o = 0; i < width * height; i += 1, o += channels) {
    const target = i * 4;
    if (channels === 4) {
      rgba[target] = unfiltered[o];
      rgba[target + 1] = unfiltered[o + 1];
      rgba[target + 2] = unfiltered[o + 2];
      rgba[target + 3] = unfiltered[o + 3];
    } else if (channels === 3) {
      rgba[target] = unfiltered[o];
      rgba[target + 1] = unfiltered[o + 1];
      rgba[target + 2] = unfiltered[o + 2];
      rgba[target + 3] = 255;
    } else {
      rgba[target] = unfiltered[o];
      rgba[target + 1] = unfiltered[o];
      rgba[target + 2] = unfiltered[o];
      rgba[target + 3] = 255;
    }
  }
  return { width, height, rgba };
}

function isOpenPoseForeground(rgba: Buffer, offset: number) {
  const alpha = rgba[offset + 3];
  if (alpha === 0) return false;
  return rgba[offset] > 12 || rgba[offset + 1] > 12 || rgba[offset + 2] > 12;
}

function computeForegroundBBox(image: DecodedPng) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (!isOpenPoseForeground(image.rgba, (y * image.width + x) * 4)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX + 1),
    height: Math.max(1, maxY - minY + 1),
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

export async function composeOpenPosePngControlImage(input: OpenPosePngControlInput): Promise<{ buffer: Buffer; width: number; height: number }> {
  const width = normalizeDimension(input.width, 'width');
  const height = normalizeDimension(input.height, 'height');
  const source = decodePngRgba(fs.readFileSync(input.sourcePath));
  const sourceBBox = computeForegroundBBox(source);
  if (!sourceBBox) return { buffer: Buffer.alloc(0), width, height };

  const targetPoseHeight = clamp(readFiniteNumber(input.transform.poseHeight) ?? 0.78, 0.05, 2) * height;
  const scale = targetPoseHeight / sourceBBox.height;
  const targetCenterX = clamp(readFiniteNumber(input.transform.centerX) ?? 0.5, -0.5, 1.5) * width;
  const targetCenterY = clamp(readFiniteNumber(input.transform.centerY) ?? 0.58, -0.5, 1.5) * height;
  const radians = -(((input.transform.rotationDeg || 0) * Math.PI) / 180);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dest = Buffer.alloc(width * height * 4);
  for (let i = 0; i < dest.length; i += 4) dest[i + 3] = 255;

  const targetHalfWidth = (sourceBBox.width * scale) / 2;
  const targetHalfHeight = (sourceBBox.height * scale) / 2;
  const radius = Math.ceil(Math.sqrt(targetHalfWidth * targetHalfWidth + targetHalfHeight * targetHalfHeight)) + 2;
  const startX = Math.max(0, Math.floor(targetCenterX - radius));
  const endX = Math.min(width - 1, Math.ceil(targetCenterX + radius));
  const startY = Math.max(0, Math.floor(targetCenterY - radius));
  const endY = Math.min(height - 1, Math.ceil(targetCenterY + radius));

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const dx = (x - targetCenterX) / scale;
      const dy = (y - targetCenterY) / scale;
      const unrotatedX = dx * cos - dy * sin;
      const unrotatedY = dx * sin + dy * cos;
      const sourceX = Math.round(sourceBBox.centerX + (input.transform.flipX ? -unrotatedX : unrotatedX));
      const sourceY = Math.round(sourceBBox.centerY + unrotatedY);
      if (sourceX < 0 || sourceY < 0 || sourceX >= source.width || sourceY >= source.height) continue;
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      if (!isOpenPoseForeground(source.rgba, sourceOffset)) continue;
      const targetOffset = (y * width + x) * 4;
      dest[targetOffset] = source.rgba[sourceOffset];
      dest[targetOffset + 1] = source.rgba[sourceOffset + 1];
      dest[targetOffset + 2] = source.rgba[sourceOffset + 2];
      dest[targetOffset + 3] = 255;
    }
  }

  const buffer = encodePngRgba(width, height, dest);
  if (input.outputPath) {
    fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
    fs.writeFileSync(input.outputPath, buffer);
  }
  return { buffer, width, height };
}

export async function renderOpenPoseControlImage(input: OpenPoseRendererInput): Promise<{ buffer: Buffer; width: number; height: number }> {
  const width = normalizeDimension(input.width, 'width');
  const height = normalizeDimension(input.height, 'height');
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) rgba[i + 3] = 255;

  const renderedPoints = transformOpenPoseKeypoints({ ...input, width, height });
  const pointsByIndex = new Map(renderedPoints.map((point) => [point.index, point]));
  const scaleRadius = clamp(Math.round(Math.min(width, height) / 160), 2, 8);
  const jointRadius = Math.max(DEFAULT_JOINT_RADIUS, scaleRadius);
  const lineThickness = Math.max(DEFAULT_LINE_THICKNESS, scaleRadius);

  for (const [from, to, color] of BODY_LIMBS) {
    const a = pointsByIndex.get(from);
    const b = pointsByIndex.get(to);
    if (!a || !b) continue;
    drawLine(rgba, width, height, a.canvasX, a.canvasY, b.canvasX, b.canvasY, lineThickness, color);
  }

  for (const point of renderedPoints) {
    drawCircle(rgba, width, height, point.canvasX, point.canvasY, jointRadius, JOINT_COLORS[point.index % JOINT_COLORS.length]);
  }

  const buffer = encodePngRgba(width, height, rgba);
  if (input.outputPath) {
    fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
    fs.writeFileSync(input.outputPath, buffer);
  }
  return { buffer, width, height };
}
