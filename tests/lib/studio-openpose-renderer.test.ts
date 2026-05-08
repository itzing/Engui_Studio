import { describe, expect, it } from 'vitest';
import { extractOpenPoseBodyKeypoints, renderOpenPoseControlImage, transformOpenPoseKeypoints } from '@/lib/studio-sessions/openPoseRenderer';

function flatKeypoints(points: Array<[number, number, number]>) {
  return { people: [{ pose_keypoints_2d: points.flat() }] };
}

function readPngSize(buffer: Buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function bbox(points: Array<{ canvasX: number; canvasY: number }>) {
  const xs = points.map((point) => point.canvasX);
  const ys = points.map((point) => point.canvasY);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
    centerY: (Math.min(...ys) + Math.max(...ys)) / 2,
    height: Math.max(...ys) - Math.min(...ys),
  };
}

describe('OpenPose renderer', () => {
  it('extracts visible OpenPose body keypoints and ignores low-confidence points', () => {
    const points = extractOpenPoseBodyKeypoints(flatKeypoints([
      [10, 20, 0.9],
      [20, 30, 0],
      [30, 40, 0.6],
    ]));

    expect(points).toEqual([
      expect.objectContaining({ index: 0, x: 10, y: 20, confidence: 0.9 }),
      expect.objectContaining({ index: 2, x: 30, y: 40, confidence: 0.6 }),
    ]);
  });

  it('applies center and poseHeight transform from source bbox', () => {
    const rendered = transformOpenPoseKeypoints({
      poseKeypointJson: flatKeypoints([
        [100, 100, 1],
        [100, 200, 1],
        [200, 200, 1],
      ]),
      width: 400,
      height: 600,
      transform: { centerX: 0.25, centerY: 0.75, poseHeight: 0.5, rotationDeg: 0, flipX: false },
    });
    const box = bbox(rendered);

    expect(box.centerX).toBeCloseTo(100, 4);
    expect(box.centerY).toBeCloseTo(450, 4);
    expect(box.height).toBeCloseTo(300, 4);
  });

  it('supports flipX and 2D rotation before scaling', () => {
    const source = flatKeypoints([
      [0, 0, 1],
      [100, 0, 1],
      [0, 200, 1],
    ]);

    const normal = transformOpenPoseKeypoints({
      poseKeypointJson: source,
      width: 500,
      height: 500,
      transform: { centerX: 0.5, centerY: 0.5, poseHeight: 0.4, rotationDeg: 0, flipX: false },
    });
    const flipped = transformOpenPoseKeypoints({
      poseKeypointJson: source,
      width: 500,
      height: 500,
      transform: { centerX: 0.5, centerY: 0.5, poseHeight: 0.4, rotationDeg: 0, flipX: true },
    });
    const rotated = transformOpenPoseKeypoints({
      poseKeypointJson: source,
      width: 500,
      height: 500,
      transform: { centerX: 0.5, centerY: 0.5, poseHeight: 0.4, rotationDeg: 90, flipX: false },
    });

    expect(flipped[0].canvasX).toBeCloseTo(normal[1].canvasX, 4);
    expect(flipped[1].canvasX).toBeCloseTo(normal[0].canvasX, 4);
    expect(rotated[1].canvasY).toBeGreaterThan(rotated[0].canvasY);
  });

  it('renders exact-size PNG output with black background and drawn joints', async () => {
    const result = await renderOpenPoseControlImage({
      poseKeypointJson: flatKeypoints([
        [100, 100, 1],
        [100, 160, 1],
        [130, 220, 1],
        [100, 260, 1],
        [70, 220, 1],
      ]),
      width: 320,
      height: 480,
      transform: { centerX: 0.5, centerY: 0.58, poseHeight: 0.78, rotationDeg: 0, flipX: false },
    });

    expect(result.width).toBe(320);
    expect(result.height).toBe(480);
    expect(readPngSize(result.buffer)).toEqual({ width: 320, height: 480 });
    expect(result.buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(result.buffer.length).toBeGreaterThan(100);
  });

  it('returns a valid empty control image for missing keypoints', async () => {
    const result = await renderOpenPoseControlImage({
      poseKeypointJson: { people: [{ pose_keypoints_2d: [] }] },
      width: 64,
      height: 64,
      transform: { centerX: 0.5, centerY: 0.5, poseHeight: 0.8, rotationDeg: 0, flipX: false },
    });

    expect(readPngSize(result.buffer)).toEqual({ width: 64, height: 64 });
  });
});
