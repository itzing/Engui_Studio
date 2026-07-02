import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

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

function streamFileResponse(request: NextRequest, filePath: string): NextResponse {
  const stats = fs.statSync(filePath);
  const size = stats.size;
  const type = contentType(filePath);
  const range = request.headers.get('range');

  const baseHeaders = {
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': type,
  };

  if (!range) {
    return new NextResponse(Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream, {
      status: 200,
      headers: {
        ...baseHeaders,
        'Content-Length': String(size),
      },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        ...baseHeaders,
        'Content-Range': `bytes */${size}`,
      },
    });
  }

  const [, rawStart, rawEnd] = match;
  let start = rawStart ? Number.parseInt(rawStart, 10) : 0;
  let end = rawEnd ? Number.parseInt(rawEnd, 10) : size - 1;

  if (!rawStart && rawEnd) {
    const suffixLength = Number.parseInt(rawEnd, 10);
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        ...baseHeaders,
        'Content-Range': `bytes */${size}`,
      },
    });
  }

  end = Math.min(end, size - 1);

  return new NextResponse(Readable.toWeb(fs.createReadStream(filePath, { start, end })) as ReadableStream, {
    status: 206,
    headers: {
      ...baseHeaders,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
    },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ file: string[] }> }) {
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
      return streamFileResponse(req, candidate);
    }
  }

  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
}
