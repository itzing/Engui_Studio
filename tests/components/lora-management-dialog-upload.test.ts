/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'loraManagement.title': 'LoRA Management',
        'loraManagement.description': 'Upload and manage your LoRA models',
        'loraManagement.uploadArea.uploading': 'Uploading...',
        'loraManagement.uploadArea.dragAndDrop': 'Drag & drop LoRA file here',
        'loraManagement.uploadArea.orClickToBrowse': 'or click to browse',
        'loraManagement.uploadArea.browseFiles': 'Browse Files',
        'loraManagement.uploadArea.fileTypes': '.safetensors, .ckpt',
        'loraManagement.messages.uploadSuccess': 'uploaded successfully!',
        'loraManagement.yourLoras': 'Your LoRAs',
        'loraManagement.actions.syncFromS3': 'Sync from S3',
        'loraManagement.messages.noLorasUploaded': 'No LoRAs uploaded yet',
        'loraManagement.messages.uploadFirstLora': 'Upload your first LoRA to get started',
      };
      return labels[key] || key;
    },
  }),
}));

import { LoRAManagementDialog } from '@/components/lora/LoRAManagementDialog';

class MockXMLHttpRequest {
  static instances: MockXMLHttpRequest[] = [];

  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 200;
  responseText = '{"success":true,"eTag":"etag"}';
  method = '';
  url = '';

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader() {}

  send() {}

  abort() {
    this.onabort?.();
  }

  getResponseHeader(name: string) {
    return name === 'ETag' ? 'etag' : null;
  }

  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent);
  }

  load() {
    this.onload?.();
  }
}

describe('LoRAManagementDialog upload progress', () => {
  beforeEach(() => {
    MockXMLHttpRequest.instances = [];
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url.startsWith('/api/lora?')) {
        return {
          ok: true,
          json: async () => ({ success: true, loras: [] }),
        } as Response;
      }

      if (url === '/api/lora/multipart/init') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            volume: 'models',
            uploadId: 'upload-id',
            key: 'loras/model.safetensors',
            partSize: 5,
          }),
        } as Response;
      }

      if (url === '/api/lora/multipart/finalize') {
        return {
          ok: true,
          json: async () => ({ success: true, lora: { id: 'lora-id' } }),
        } as Response;
      }

      throw new Error(`Unexpected fetch ${url} ${options?.method || 'GET'}`);
    }));
  });

  it('uses multipart upload progress instead of the legacy upload route', async () => {
    const onLoRAUploaded = vi.fn();
    render(
      React.createElement(LoRAManagementDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onLoRAUploaded,
        workspaceId: 'default',
      })
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['0123456789'], 'model.safetensors', { type: 'application/octet-stream' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(MockXMLHttpRequest.instances.length).toBe(1);
    });

    act(() => {
      MockXMLHttpRequest.instances[0].progress(5, 5);
    });
    expect(await screen.findByText('50%')).toBeTruthy();
    act(() => {
      MockXMLHttpRequest.instances[0].load();
    });

    await waitFor(() => {
      expect(MockXMLHttpRequest.instances.length).toBe(2);
    });
    act(() => {
      MockXMLHttpRequest.instances[1].progress(5, 5);
      MockXMLHttpRequest.instances[1].load();
    });

    await waitFor(() => {
      expect(onLoRAUploaded).toHaveBeenCalled();
    });

    const fetchCalls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([url]) => url);
    expect(fetchCalls).toContain('/api/lora/multipart/init');
    expect(fetchCalls).toContain('/api/lora/multipart/finalize');
    expect(fetchCalls).not.toContain('/api/lora/upload');
  });
});
