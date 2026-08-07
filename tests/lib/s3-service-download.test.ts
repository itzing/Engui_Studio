import { execFile } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
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
