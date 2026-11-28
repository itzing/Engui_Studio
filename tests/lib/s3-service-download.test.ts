import { execFile } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { describe, expect, it, vi } from 'vitest';

const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));

vi.mock('child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execFile: mockExecFile,
  };
});

import S3Service from '@/lib/s3Service';

describe('S3Service.downloadFile', () => {
  it('downloads objects with direct GetObject instead of s3 cp HeadObject preflight', async () => {
    mockExecFile.mockImplementation((_command, args, _options, callback) => {
      const outputPath = args[6];
      writeFileSync(outputPath, Buffer.from('secure-result'));
      callback(null, JSON.stringify({ ContentLength: 13 }), '');
    });

    const service = new S3Service({
      endpointUrl: 'https://s3api-eu-cz-1.runpod.io',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      bucketName: 'network-volume',
      region: 'eu-cz-1',
    });

    const result = await service.downloadFile('secure-jobs/job__attempt__output__result.bin');

    expect(result.toString()).toBe('secure-result');
    expect(execFile).toHaveBeenCalledWith(
      'aws',
      [
        's3api',
        'get-object',
        '--bucket',
        'network-volume',
        '--key',
        'secure-jobs/job__attempt__output__result.bin',
        expect.stringMatching(/s3-download-/),
        '--region',
        'eu-cz-1',
        '--endpoint-url',
        'https://s3api-eu-cz-1.runpod.io',
      ],
      expect.objectContaining({
        env: expect.objectContaining({
          AWS_ACCESS_KEY_ID: 'access-key',
          AWS_SECRET_ACCESS_KEY: 'secret-key',
          AWS_DEFAULT_REGION: 'eu-cz-1',
          AWS_REGION: 'eu-cz-1',
        }),
      }),
      expect.any(Function)
    );

    const outputPath = mockExecFile.mock.calls[0][1][6];
    expect(existsSync(outputPath)).toBe(false);
  });
});


describe('S3Service.uploadFile', () => {
  it('preserves secure delimiters through uploads and collision renaming while sanitizing unsafe characters', async () => {
    const objects = new Map<string, Buffer>();
    mockExecFile.mockImplementation((_command, args, _options, callback) => {
      if (args[0] === 's3api' && args[1] === 'head-object') {
        if (objects.has(args[args.indexOf('--key') + 1])) callback(null, '{}', '');
        else callback(Object.assign(new Error('404 Not Found'), { code: 1 }), '', '404 Not Found');
      } else if (args[0] === 's3' && args[1] === 'cp') {
        objects.set(args[3].replace('s3://fixture/', ''), readFileSync(args[2]));
        callback(null, '', '');
      } else throw new Error('Unexpected AWS call');
    });
    const service = new S3Service({ endpointUrl: 'https://fixture.invalid', accessKeyId: 'fixture',
      secretAccessKey: 'fixture', bucketName: 'fixture', region: 'us-east-1' });
    const name = 'job__attempt__input__source_image.bin';
    const first = await service.uploadFile(Buffer.from('first'), name, 'application/octet-stream', 'secure-jobs');
    const second = await service.uploadFile(Buffer.from('second'), name, 'application/octet-stream', 'secure-jobs');
    expect(first.filePath).toBe('/runpod-volume/secure-jobs/' + name);
    expect(second.filePath).toBe('/runpod-volume/secure-jobs/job__attempt__input__source_image_1.bin');
    expect(objects.get('secure-jobs/' + name)?.toString()).toBe('first');
    expect(objects.get(second.filePath.replace('/runpod-volume/', ''))?.toString()).toBe('second');
    const ordinary = await service.uploadFile(Buffer.from('ordinary'), 'portrait [draft] (v1)!.png', 'image/png', 'uploads');
    expect(ordinary.filePath).toMatch(/^\/runpod-volume\/uploads\/[a-zA-Z0-9_.-]+\.png$/);
    expect(objects.get(ordinary.filePath.replace('/runpod-volume/', ''))?.toString()).toBe('ordinary');
    for (const call of mockExecFile.mock.calls.filter(call => call[1][0] === 's3')) {
      expect(existsSync(call[1][2])).toBe(false);
    }
  });
});
