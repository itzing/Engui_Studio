import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function contentType(filePath: string): string {
  const f = filePath.toLowerCase();
  if (f.endsWith('.png')) return 'image/png';
  if (f.endsWith('.jpg') || f.endsWith('.jpeg')) return 'image/jpeg';
  if (f.endsWith('.webp')) return 'image/webp';
  if (f.endsWith('.gif')) return 'image/gif';
  if (f.endsWith('.mp4')) return 'video/mp4';
  if (f.endsWith('.webm')) return 'video/webm';
  if (f.endsWith('.mp3')) return 'audio/mpeg';
  if (f.endsWith('.wav')) return 'audio/wav';
  return 'application/octet-stream';
}

function sanitizeSegments(segments: string[]): string[] {
  return segments.filter(segment => segment && segment !== '.' && segment !== '..');
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ file: string[] }> }) {
  const { file } = await ctx.params;
  const safeSegments = sanitizeSegments(Array.isArray(file) ? file : [file]);

  if (safeSegments.length === 0) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const relativePath = path.join(...safeSegments);
  const candidates = [
    path.join(process.cwd(), 'generations', relativePath),
    path.join(process.cwd(), 'public', 'generations', relativePath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const buf = fs.readFileSync(candidate);
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': contentType(candidate),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  }

  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
}
