import { describe, expect, it } from 'vitest';

import { videoInfoFromFfmpegStderr, videoInfoFromFfprobeJson } from '@/lib/ffmpegService';

describe('ffmpeg video info parsing', () => {
  it('reads dimensions from ffprobe video stream JSON', () => {
    const info = videoInfoFromFfprobeJson(JSON.stringify({
      streams: [{ width: 768, height: 512, avg_frame_rate: '16/1', r_frame_rate: '16/1' }],
      format: { duration: '5.062500' },
    }), '/tmp/source.mp4');

    expect(info).toMatchObject({
      duration: 5.0625,
      width: 768,
      height: 512,
      fps: 16,
      format: '.mp4',
    });
  });

  it('applies 90-degree rotation metadata to displayed dimensions', () => {
    const info = videoInfoFromFfprobeJson(JSON.stringify({
      streams: [{ width: 768, height: 512, avg_frame_rate: '24/1', tags: { rotate: '90' } }],
      format: { duration: '4.5' },
    }), '/tmp/rotated.mp4');

    expect(info.width).toBe(512);
    expect(info.height).toBe(768);
  });

  it('ignores incidental 0x1 text before the real FFmpeg stream resolution', () => {
    const stderr = [
      'configuration: --enable-libx264 --enable-libvpx',
      'Duration: 00:00:05.06, start: 0.000000, bitrate: 1200 kb/s',
      'Metadata:',
      '  variant_bitrate : 0x1',
      'Stream #0:0(und): Video: h264, yuv420p(progressive), 768x512, 1198 kb/s, 16 fps, 16 tbr, 16384 tbn',
    ].join('\n');

    const info = videoInfoFromFfmpegStderr(stderr, '/tmp/fallback.mp4');

    expect(info.width).toBe(768);
    expect(info.height).toBe(512);
    expect(info.fps).toBe(16);
  });
});
