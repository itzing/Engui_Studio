'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowUp, File, Folder, Pencil, RefreshCw, Trash2, Upload } from 'lucide-react';

type VolumeInfo = {
  name: string;
  region?: string;
  endpoint?: string;
};

type S3Item = {
  key: string;
  size: number;
  lastModified: string | Date;
  type: 'file' | 'directory';
  extension?: string;
};

type DeleteLogEntry = {
  key: string;
  status: 'queued' | 'deleting' | 'deleted' | 'failed' | 'info';
  message?: string;
  timestamp: string;
};

type MultipartUploadPart = {
  partNumber: number;
  eTag?: string | null;
};

type MultipartUploadInitResponse = {
  success: boolean;
  uploadId: string;
  key: string;
  partSize: number;
  error?: string;
};

type UploadState = {
  active: boolean;
  fileName: string;
  key: string;
  uploadedBytes: number;
  totalBytes: number;
  fileIndex: number;
  totalFiles: number;
  startedAt: number;
  status: 'idle' | 'initializing' | 'uploading' | 'completing' | 'completed' | 'cancelling' | 'failed';
  error?: string;
};

type RenameResponse = {
  success: boolean;
  sourceKey: string;
  destinationKey: string;
  error?: string;
};

interface S3BucketViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv']);
const UPLOAD_CONCURRENCY = 1;

function getExtension(key: string): string {
  const fileName = key.split('/').filter(Boolean).pop() || '';
  const ext = fileName.split('.').pop();
  return (ext || '').toLowerCase();
}

function getFileName(key: string): string {
  const normalized = key.endsWith('/') ? key.slice(0, -1) : key;
  return normalized.split('/').pop() || key;
}

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatRate(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '—';
  return `${formatSize(bytesPerSecond)}/s`;
}

function normalizePrefix(prefix: string): string {
  if (!prefix) return '';
  return prefix.endsWith('/') ? prefix : `${prefix}/`;
}

function makeTimestamp(): string {
  const now = new Date();
  return `${now.toLocaleTimeString('en-GB', { hour12: false })}.${String(now.getMilliseconds()).padStart(3, '0')}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function S3BucketViewerDialog({ open, onOpenChange }: S3BucketViewerDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeUploadRef = useRef<{
    aborted: boolean;
    requests: Set<XMLHttpRequest>;
    uploadId?: string;
    key?: string;
    volume?: string;
  } | null>(null);
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [activeVolume, setActiveVolume] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<S3Item[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [previewKey, setPreviewKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<{ total: number; completed: number; currentKey: string | null; cancelled: boolean }>({
    total: 0,
    completed: 0,
    currentKey: null,
    cancelled: false,
  });
  const [deleteLogs, setDeleteLogs] = useState<DeleteLogEntry[]>([]);
  const [copiedDeleteLog, setCopiedDeleteLog] = useState(false);
  const [error, setError] = useState<string>('');
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const uploadActive = uploadState?.active === true;
  const uploadPercent = uploadState && uploadState.totalBytes > 0
    ? Math.min(100, Math.round((uploadState.uploadedBytes / uploadState.totalBytes) * 100))
    : 0;
  const uploadElapsedSeconds = uploadState ? Math.max(1, (Date.now() - uploadState.startedAt) / 1000) : 1;
  const uploadRate = uploadState ? uploadState.uploadedBytes / uploadElapsedSeconds : 0;

  function appendDeleteLog(entry: Omit<DeleteLogEntry, 'timestamp'>) {
    setDeleteLogs((previous) => [...previous, { ...entry, timestamp: makeTimestamp() }]);
  }

  async function handleCopyDeleteLog() {
    if (deleteLogs.length === 0) return;

    const text = deleteLogs
      .map((entry) => `${entry.timestamp} [${entry.status}] ${entry.key}${entry.message ? ` - ${entry.message}` : ''}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedDeleteLog(true);
      window.setTimeout(() => setCopiedDeleteLog(false), 2000);
    } catch {
      setError('Failed to copy delete log.');
    }
  }

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return getFileName(a.key).localeCompare(getFileName(b.key));
    });
  }, [items]);

  const previewItem = useMemo(() => sortedItems.find((item) => item.key === previewKey), [sortedItems, previewKey]);
  const selectedSingleItem = useMemo(() => {
    if (selectedKeys.length !== 1) return null;
    return sortedItems.find((item) => item.key === selectedKeys[0]) || null;
  }, [selectedKeys, sortedItems]);
  const selectedRenameFile = selectedSingleItem?.type === 'file' ? selectedSingleItem : null;
  const visibleKeys = useMemo(() => sortedItems.map((item) => item.key), [sortedItems]);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedSet.has(key));

  const previewType = useMemo(() => {
    if (!previewItem || previewItem.type !== 'file') return 'none';
    const ext = getExtension(previewItem.key);
    if (IMAGE_EXTENSIONS.has(ext)) return 'image';
    if (VIDEO_EXTENSIONS.has(ext)) return 'video';
    return 'none';
  }, [previewItem]);

  const previewUrl = useMemo(() => {
    if (!previewItem || !activeVolume || previewType === 'none') return '';
    const params = new URLSearchParams({
      volume: activeVolume,
      key: previewItem.key,
    });
    return `/api/s3-storage/preview?${params.toString()}`;
  }, [previewItem, activeVolume, previewType]);

  const breadcrumbSegments = useMemo(() => {
    const segments = currentPath.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `${segments.slice(0, index + 1).join('/')}/`;
      return { label: segment, path };
    });
  }, [currentPath]);

  useEffect(() => {
    if (!open) return;
    void loadVolumes();
  }, [open]);

  useEffect(() => {
    if (!open || !activeVolume) return;
    void loadItems(activeVolume, currentPath);
  }, [open, activeVolume, currentPath]);

  async function loadVolumes() {
    setError('');
    try {
      const response = await fetch('/api/s3-storage/volumes');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load bucket information.');
      }

      const fetchedVolumes: VolumeInfo[] = Array.isArray(data) ? data : [];
      setVolumes(fetchedVolumes);

      if (fetchedVolumes.length === 0) {
        setActiveVolume('');
        setItems([]);
        return;
      }

      setActiveVolume((previous) => {
        if (previous && fetchedVolumes.some((volume) => volume.name === previous)) {
          return previous;
        }
        return fetchedVolumes[0].name;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load bucket information.');
    }
  }

  async function loadItems(volume: string, path: string): Promise<S3Item[]> {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ volume, path });
      const response = await fetch(`/api/s3-storage/files?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load files.');
      }

      const nextItems: S3Item[] = Array.isArray(data.files) ? data.files : [];
      setItems(nextItems);

      setSelectedKeys((previous) => previous.filter((key) => nextItems.some((item) => item.key === key)));
      setPreviewKey((previous) => (nextItems.some((item) => item.key === previous) ? previous : ''));
      return nextItems;
    } catch (loadError) {
      setItems([]);
      setSelectedKeys([]);
      setPreviewKey('');
      setError(loadError instanceof Error ? loadError.message : 'Failed to load files.');
      return [];
    } finally {
      setIsLoading(false);
    }
  }

  async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      throw new Error(data.error || `Request failed: ${url}`);
    }

    return data as T;
  }

  async function uploadPartWithProgress(input: {
    url: string;
    blob: Blob;
    partNumber: number;
    partProgress: number[];
    uploadContext: NonNullable<typeof activeUploadRef.current>;
  }): Promise<MultipartUploadPart> {
    return new Promise((resolve, reject) => {
      if (input.uploadContext.aborted) {
        reject(new Error('Upload cancelled.'));
        return;
      }

      const xhr = new XMLHttpRequest();
      input.uploadContext.requests.add(xhr);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        input.partProgress[input.partNumber - 1] = event.loaded;
        const uploadedBytes = input.partProgress.reduce((sum, value) => sum + value, 0);
        setUploadState((previous) => previous ? { ...previous, uploadedBytes } : previous);
      };

      xhr.onload = () => {
        input.uploadContext.requests.delete(xhr);
        if (xhr.status >= 200 && xhr.status < 300) {
          const responseBody = (() => {
            try {
              return xhr.responseText ? JSON.parse(xhr.responseText) as { eTag?: string | null } : {};
            } catch {
              return {};
            }
          })();
          input.partProgress[input.partNumber - 1] = input.blob.size;
          const uploadedBytes = input.partProgress.reduce((sum, value) => sum + value, 0);
          setUploadState((previous) => previous ? { ...previous, uploadedBytes } : previous);
          resolve({
            partNumber: input.partNumber,
            eTag: responseBody.eTag || xhr.getResponseHeader('ETag'),
          });
          return;
        }
        reject(new Error(`Part ${input.partNumber} upload failed with HTTP ${xhr.status}.`));
      };

      xhr.onerror = () => {
        input.uploadContext.requests.delete(xhr);
        reject(new Error(`Part ${input.partNumber} upload failed.`));
      };

      xhr.onabort = () => {
        input.uploadContext.requests.delete(xhr);
        reject(new Error('Upload cancelled.'));
      };

      xhr.open('PUT', input.url);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.send(input.blob);
    });
  }

  async function uploadSingleFile(file: File, fileIndex: number, totalFiles: number) {
    if (!activeVolume) {
      throw new Error('Select a bucket before uploading.');
    }

    setUploadState({
      active: true,
      fileName: file.name,
      key: '',
      uploadedBytes: 0,
      totalBytes: file.size,
      fileIndex,
      totalFiles,
      startedAt: Date.now(),
      status: 'initializing',
    });

    const init = await postJson<MultipartUploadInitResponse>('/api/s3-storage/multipart/init', {
      volume: activeVolume,
      path: currentPath,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      fileSize: file.size,
    });

    const uploadContext = {
      aborted: false,
      requests: new Set<XMLHttpRequest>(),
      uploadId: init.uploadId,
      key: init.key,
      volume: activeVolume,
    };
    activeUploadRef.current = uploadContext;

    setUploadState((previous) => previous ? {
      ...previous,
      key: init.key,
      status: 'uploading',
    } : previous);

    const partSize = init.partSize;
    const totalParts = Math.ceil(file.size / partSize);
    const partProgress = Array.from({ length: totalParts }, () => 0);
    const completedParts: MultipartUploadPart[] = [];
    let nextPartNumber = 1;

    const uploadPart = async (partNumber: number): Promise<MultipartUploadPart> => {
      const start = (partNumber - 1) * partSize;
      const end = Math.min(start + partSize, file.size);
      const blob = file.slice(start, end);
      let lastError: unknown;

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        if (uploadContext.aborted) {
          throw new Error('Upload cancelled.');
        }

        try {
          const params = new URLSearchParams({
            volume: activeVolume,
            key: init.key,
            uploadId: init.uploadId,
            partNumber: String(partNumber),
          });

          return await uploadPartWithProgress({
            url: `/api/s3-storage/multipart/proxy-part?${params.toString()}`,
            blob,
            partNumber,
            partProgress,
            uploadContext,
          });
        } catch (partError) {
          lastError = partError;
          partProgress[partNumber - 1] = 0;
          if (attempt < 3) {
            await sleep(attempt * 1000);
          }
        }
      }

      throw lastError instanceof Error ? lastError : new Error(`Part ${partNumber} upload failed.`);
    };

    const worker = async () => {
      while (nextPartNumber <= totalParts) {
        const partNumber = nextPartNumber;
        nextPartNumber += 1;
        const part = await uploadPart(partNumber);
        completedParts.push(part);
      }
    };

    try {
      await Promise.all(
        Array.from({ length: Math.min(UPLOAD_CONCURRENCY, totalParts) }, () => worker())
      );

      if (uploadContext.aborted) {
        throw new Error('Upload cancelled.');
      }

      setUploadState((previous) => previous ? { ...previous, status: 'completing' } : previous);
      await postJson('/api/s3-storage/multipart/complete', {
        volume: activeVolume,
        key: init.key,
        uploadId: init.uploadId,
        parts: completedParts.sort((a, b) => a.partNumber - b.partNumber),
      });

      setUploadState((previous) => previous ? {
        ...previous,
        uploadedBytes: file.size,
        status: 'completed',
        active: false,
      } : previous);
    } catch (uploadError) {
      if (uploadContext.uploadId && uploadContext.key) {
        try {
          await postJson('/api/s3-storage/multipart/abort', {
            volume: activeVolume,
            key: uploadContext.key,
            uploadId: uploadContext.uploadId,
          });
        } catch {
          // Best-effort cleanup only. Keep the original upload failure visible.
        }
      }
      throw uploadError;
    } finally {
      if (activeUploadRef.current === uploadContext) {
        activeUploadRef.current = null;
      }
    }
  }

  async function handleUploadFiles(files: File[]) {
    if (!activeVolume || files.length === 0 || uploadActive) return;

    setError('');

    try {
      for (let index = 0; index < files.length; index += 1) {
        await uploadSingleFile(files[index], index + 1, files.length);
      }
      await loadItems(activeVolume, currentPath);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Upload failed.';
      setUploadState((previous) => previous ? {
        ...previous,
        active: false,
        status: message.includes('cancelled') ? 'cancelling' : 'failed',
        error: message,
      } : {
        active: false,
        fileName: '',
        key: '',
        uploadedBytes: 0,
        totalBytes: 0,
        fileIndex: 0,
        totalFiles: files.length,
        startedAt: Date.now(),
        status: 'failed',
        error: message,
      });
      setError(message);
    }
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    void handleUploadFiles(files);
  }

  function handleVolumeChange(nextVolume: string) {
    setActiveVolume(nextVolume);
    setCurrentPath('');
    setSelectedKeys([]);
    setPreviewKey('');
  }

  function handleOpenFolder(folderKey: string) {
    setCurrentPath(normalizePrefix(folderKey));
    setSelectedKeys([]);
    setPreviewKey('');
  }

  function handleGoUp() {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    const parentParts = parts.slice(0, -1);
    const parentPath = parentParts.length > 0 ? `${parentParts.join('/')}/` : '';
    setCurrentPath(parentPath);
    setSelectedKeys([]);
    setPreviewKey('');
  }

  function toggleSelect(key: string, checked: boolean) {
    setSelectedKeys((previous) => {
      if (checked) {
        if (previous.includes(key)) return previous;
        return [...previous, key];
      }
      return previous.filter((itemKey) => itemKey !== key);
    });
  }

  function handleToggleSelectAllVisible() {
    setSelectedKeys((previous) => {
      if (allVisibleSelected) {
        return previous.filter((key) => !visibleKeys.includes(key));
      }

      const next = new Set(previous);
      for (const key of visibleKeys) {
        next.add(key);
      }
      return Array.from(next);
    });
  }

  function setDeleteLogStatus(keys: string[], status: DeleteLogEntry['status'], message?: string) {
    const keySet = new Set(keys);
    setDeleteLogs((previous) => previous.map((entry) => {
      if (!keySet.has(entry.key)) return entry;
      return {
        ...entry,
        status,
        message: message ?? entry.message,
        timestamp: makeTimestamp(),
      };
    }));
  }

  async function fetchRecursiveKeys(folderKey: string): Promise<string[]> {
    const params = new URLSearchParams({ volume: activeVolume, path: folderKey, recursive: 'true' });
    const response = await fetch(`/api/s3-storage/files?${params.toString()}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Failed to list folder contents for ${folderKey}`);
    }

    return Array.isArray(data.keys) ? data.keys : [];
  }

  async function buildDeletePlan(inputKeys: string[]): Promise<string[]> {
    const plan: string[] = [];

    for (const key of inputKeys) {
      if (key.endsWith('/')) {
        appendDeleteLog({ key, status: 'info', message: 'expanding folder' });
        const nestedKeys = await fetchRecursiveKeys(key);
        appendDeleteLog({ key, status: 'info', message: `listed ${nestedKeys.length} keys` });

        if (nestedKeys.length === 0) {
          const normalizedFolderKey = normalizePrefix(key);
          plan.push(normalizedFolderKey, `${normalizedFolderKey}folder-marker.txt`);
          appendDeleteLog({ key, status: 'info', message: 'empty folder, adding folder placeholder and marker to delete plan' });
        } else {
          plan.push(...nestedKeys, normalizePrefix(key));
          appendDeleteLog({ key, status: 'info', message: 'adding folder placeholder to delete plan' });
        }
      } else {
        plan.push(key);
      }
    }

    return Array.from(new Set(plan));
  }

  async function executeDeletePlan(inputKeys: string[], contextKey: string, successPathAfterDelete: string): Promise<boolean> {
    setIsDeleting(true);
    setError('');
    setDeleteLogs([]);
    appendDeleteLog({ key: contextKey, status: 'info', message: 'delete requested' });

    try {
      const planKeys = await buildDeletePlan(inputKeys);
      setDeleteLogs((previous) => [
        ...previous,
        ...planKeys.map((key) => ({ key, status: 'queued' as const, timestamp: makeTimestamp() })),
      ]);
      appendDeleteLog({ key: contextKey, status: 'info', message: `delete plan has ${planKeys.length} object keys` });

      setDeleteProgress({
        total: planKeys.length,
        completed: 0,
        currentKey: planKeys[0] || contextKey,
        cancelled: false,
      });

      const batchSize = 100;
      let completed = 0;

      for (let index = 0; index < planKeys.length; index += batchSize) {
        const batch = planKeys.slice(index, index + batchSize);
        const batchNumber = Math.floor(index / batchSize) + 1;
        let cancelled = false;

        appendDeleteLog({ key: contextKey, status: 'info', message: `batch ${batchNumber} started (${batch.length} keys)` });

        setDeleteProgress((previous) => {
          cancelled = previous.cancelled;
          return {
            ...previous,
            currentKey: batch[0] || previous.currentKey,
          };
        });

        if (cancelled) {
          appendDeleteLog({ key: contextKey, status: 'info', message: 'cancellation requested' });
          break;
        }

        setDeleteLogStatus(batch, 'deleting');

        const response = await fetch('/api/s3-storage/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volume: activeVolume, keys: batch }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setDeleteLogStatus(batch, 'failed', data.error || 'Delete failed');
          appendDeleteLog({ key: contextKey, status: 'info', message: `batch ${batchNumber} failed` });
          throw new Error(data.error || 'Failed to delete batch.');
        }

        const deletedKeys: string[] = Array.isArray(data.deletedKeys) ? data.deletedKeys : [];
        const failedKeys: string[] = Array.isArray(data.failedKeys) ? data.failedKeys : [];

        completed += deletedKeys.length;
        if (deletedKeys.length > 0) {
          setDeleteLogStatus(deletedKeys, 'deleted');
        }
        if (failedKeys.length > 0) {
          setDeleteLogStatus(failedKeys, 'failed', 'Delete failed');
          appendDeleteLog({ key: contextKey, status: 'info', message: `batch ${batchNumber} partial failure (${failedKeys.length} keys)` });
        }
        appendDeleteLog({ key: contextKey, status: 'info', message: `batch ${batchNumber} finished (${deletedKeys.length} keys)` });
        setDeleteProgress((previous) => ({
          ...previous,
          completed,
          currentKey: batch[batch.length - 1] || previous.currentKey,
        }));
      }

      setSelectedKeys([]);
      if (previewKey && inputKeys.includes(previewKey)) {
        setPreviewKey('');
      }

      let refreshedItems = await loadItems(activeVolume, successPathAfterDelete);
      let remainingTargets = inputKeys.filter((key) => refreshedItems.some((item) => item.key === key));

      if (remainingTargets.length > 0) {
        appendDeleteLog({ key: contextKey, status: 'info', message: `verification retry for ${remainingTargets.length} remaining target(s)` });
        await sleep(800);
        refreshedItems = await loadItems(activeVolume, successPathAfterDelete);
        remainingTargets = inputKeys.filter((key) => refreshedItems.some((item) => item.key === key));
      }

      if (remainingTargets.length > 0) {
        appendDeleteLog({ key: contextKey, status: 'failed', message: `verification failed, still visible: ${remainingTargets.join(', ')}` });
        setError(`Delete reported success, but ${remainingTargets.length} target(s) are still visible.`);
        return false;
      }

      appendDeleteLog({ key: contextKey, status: 'info', message: 'verification passed' });
      return true;
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Delete failed.');
      return false;
    } finally {
      setDeleteProgress((previous) => ({
        ...previous,
        currentKey: null,
      }));
      setIsDeleting(false);
    }
  }

  async function handleDeleteCurrentFolder() {
    if (!activeVolume || !currentPath) return;

    const folderName = getFileName(currentPath);
    const confirmed = confirm(`Delete folder "${folderName}" with all nested contents?`);
    if (!confirmed) return;

    const parts = currentPath.split('/').filter(Boolean);
    const parentParts = parts.slice(0, -1);
    const parentPath = parentParts.length > 0 ? `${parentParts.join('/')}/` : '';
    const deleted = await executeDeletePlan([currentPath], currentPath, parentPath);
    if (deleted) {
      setCurrentPath(parentPath);
    }
  }

  async function handleDeleteSelected() {
    if (!activeVolume || selectedKeys.length === 0) return;

    const confirmed = confirm(`Delete ${selectedKeys.length} selected item(s)?`);
    if (!confirmed) return;

    const targets = [...selectedKeys];
    await executeDeletePlan(targets, currentPath || activeVolume, currentPath);
  }

  function handleOpenRename() {
    if (!selectedRenameFile) return;
    setRenameValue(getFileName(selectedRenameFile.key));
    setError('');
    setRenameOpen(true);
  }

  async function handleConfirmRename() {
    if (!activeVolume || !selectedRenameFile || isRenaming) return;

    const nextName = renameValue.trim();
    if (!nextName) {
      setError('Enter a file name.');
      return;
    }

    setIsRenaming(true);
    setError('');

    try {
      const response = await fetch('/api/s3-storage/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volume: activeVolume,
          key: selectedRenameFile.key,
          newName: nextName,
        }),
      });
      const data: RenameResponse = await response.json().catch(() => ({
        success: false,
        sourceKey: selectedRenameFile.key,
        destinationKey: selectedRenameFile.key,
        error: 'Failed to rename file.',
      }));

      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Failed to rename file.');
      }

      await loadItems(activeVolume, currentPath);
      setSelectedKeys([data.destinationKey]);
      setPreviewKey((previous) => previous === selectedRenameFile.key ? data.destinationKey : previous);
      setRenameOpen(false);
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Failed to rename file.');
    } finally {
      setIsRenaming(false);
    }
  }

  function handleCancelDelete() {
    setDeleteProgress((previous) => ({
      ...previous,
      cancelled: true,
    }));
  }

  async function handleCancelUpload() {
    const context = activeUploadRef.current;
    if (!context) return;

    context.aborted = true;
    setUploadState((previous) => previous ? { ...previous, status: 'cancelling' } : previous);

    for (const request of context.requests) {
      request.abort();
    }

    if (context.volume && context.key && context.uploadId) {
      try {
        await postJson('/api/s3-storage/multipart/abort', {
          volume: context.volume,
          key: context.key,
          uploadId: context.uploadId,
        });
      } catch {
        // Best effort. The active upload path will also try to abort.
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 border-b border-border space-y-2 text-left">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base">Bucket Viewer</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => activeVolume && loadItems(activeVolume, currentPath)}
                disabled={!activeVolume || isLoading || isDeleting || uploadActive}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={!activeVolume || isDeleting || uploadActive}
              >
                <Upload className="w-4 h-4 mr-1" />
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
              {selectedRenameFile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenRename}
                  disabled={isDeleting || uploadActive || isRenaming}
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Rename
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={selectedKeys.length === 0 || isDeleting || uploadActive}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete ({selectedKeys.length})
              </Button>
              {isDeleting && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelDelete}
                  disabled={deleteProgress.cancelled}
                >
                  {deleteProgress.cancelled ? 'Cancelling...' : 'Cancel'}
                </Button>
              )}
            </div>
          </div>
          <DialogDescription className="flex flex-col gap-2 text-xs">
            {(isDeleting || deleteLogs.length > 0) && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    {isDeleting ? 'Deleting' : 'Last delete'} {deleteProgress.completed}/{deleteProgress.total}
                    {deleteProgress.currentKey ? `, current: ${deleteProgress.currentKey}` : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>{isDeleting ? (deleteProgress.cancelled ? 'Stopping after current item...' : 'In progress') : 'Finished'}</span>
                    {deleteLogs.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => void handleCopyDeleteLog()}
                      >
                        {copiedDeleteLog ? 'Copied' : 'Copy log'}
                      </Button>
                    )}
                    {!isDeleting && deleteLogs.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setDeleteLogs([])}
                      >
                        Clear log
                      </Button>
                    )}
                  </div>
                </div>
                <div className="max-h-40 overflow-auto rounded border border-border/60 bg-background/60 p-2 font-mono text-[10px] space-y-1">
                  {deleteLogs.length === 0 ? (
                    <div className="text-muted-foreground">Preparing delete plan...</div>
                  ) : (
                    deleteLogs.map((entry) => (
                      <div key={`${entry.timestamp}-${entry.key}-${entry.status}-${entry.message || ''}`} className="break-all">
                        <span className="text-muted-foreground">{entry.timestamp}</span>{' '}
                        <span className={entry.status === 'deleted' ? 'text-green-500' : entry.status === 'failed' ? 'text-red-500' : entry.status === 'deleting' ? 'text-amber-500' : entry.status === 'info' ? 'text-sky-400' : 'text-muted-foreground'}>
                          [{entry.status}]
                        </span>{' '}
                        {entry.key}
                        {entry.message ? ` - ${entry.message}` : ''}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            {uploadState && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    Upload {uploadState.fileIndex}/{uploadState.totalFiles}: {uploadState.fileName || 'file'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap">
                      {uploadState.status === 'completed'
                        ? 'Completed'
                        : uploadState.status === 'failed'
                          ? 'Failed'
                          : uploadState.status === 'cancelling'
                            ? 'Cancelling'
                            : uploadState.status}
                    </span>
                    {uploadActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => void handleCancelUpload()}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span className="break-all">{uploadState.key || normalizePrefix(currentPath) || 'root'}</span>
                  <span>
                    {formatSize(uploadState.uploadedBytes)} / {formatSize(uploadState.totalBytes)} · {uploadPercent}% · {formatRate(uploadRate)}
                  </span>
                </div>
                {uploadState.error && (
                  <div className="text-red-500">{uploadState.error}</div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span>Bucket:</span>
              <select
                value={activeVolume}
                onChange={(event) => handleVolumeChange(event.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                disabled={isDeleting || uploadActive}
              >
                {volumes.map((volume) => (
                  <option key={volume.name} value={volume.name}>
                    {volume.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap py-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  setCurrentPath('');
                  setSelectedKeys([]);
                  setPreviewKey('');
                }}
                disabled={!activeVolume || isDeleting || uploadActive}
              >
                Root
              </Button>
              {breadcrumbSegments.map((segment) => (
                <React.Fragment key={segment.path}>
                  <span className="text-muted-foreground">/</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setCurrentPath(segment.path);
                      setSelectedKeys([]);
                      setPreviewKey('');
                    }}
                    disabled={isDeleting || uploadActive}
                  >
                    {segment.label}
                  </Button>
                </React.Fragment>
              ))}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2">
          <div className="border-r border-border min-h-0 flex flex-col">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Contents</span>
                <span className="text-xs text-muted-foreground">{sortedItems.length} object{sortedItems.length === 1 ? '' : 's'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleToggleSelectAllVisible}
                  disabled={visibleKeys.length === 0 || isDeleting || uploadActive}
                >
                  {allVisibleSelected ? 'Clear visible' : 'Select visible'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={handleDeleteCurrentFolder}
                  disabled={!currentPath || isDeleting || uploadActive}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete folder
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleGoUp}
                  disabled={!currentPath || isDeleting || uploadActive}
                >
                  <ArrowUp className="w-3 h-3 mr-1" />
                  Up
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {error ? (
                <div className="p-4 text-sm text-red-500">{error}</div>
              ) : isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading...</div>
              ) : sortedItems.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Folder is empty.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {sortedItems.map((item) => {
                    const name = getFileName(item.key);
                    const isPreviewSelected = previewKey === item.key;
                    const isChecked = selectedSet.has(item.key);

                    return (
                      <div
                        key={item.key}
                        className={`px-3 py-2 text-xs flex items-center gap-2 hover:bg-muted/30 ${
                          isPreviewSelected ? 'bg-primary/10' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(event) => toggleSelect(item.key, event.target.checked)}
                          className="h-3.5 w-3.5 rounded border-border"
                          disabled={isDeleting || uploadActive}
                        />

                        <button
                          type="button"
                          className="flex items-center gap-2 flex-1 min-w-0 text-left"
                          onClick={() => {
                            if (isDeleting || uploadActive) return;
                            if (item.type === 'directory') {
                              handleOpenFolder(item.key);
                            } else {
                              setPreviewKey(item.key);
                            }
                          }}
                        >
                          {item.type === 'directory' ? (
                            <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          ) : (
                            <File className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="truncate">{name}</span>
                        </button>

                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatSize(item.size)}</span>
                        <span className="hidden lg:inline text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(item.lastModified)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 flex flex-col">
            <div className="px-3 py-2 border-b border-border">
              <span className="text-xs text-muted-foreground">Preview</span>
            </div>
            <div className="flex-1 min-h-0 p-4 overflow-auto bg-black/40">
              {!previewItem ? (
                <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                  Select a file to preview.
                </div>
              ) : previewType === 'image' && previewUrl ? (
                <div className="h-full w-full flex items-center justify-center">
                  <img src={previewUrl} alt={getFileName(previewItem.key)} className="max-w-full max-h-full object-contain" />
                </div>
              ) : previewType === 'video' && previewUrl ? (
                <div className="h-full w-full flex items-center justify-center">
                  <video src={previewUrl} controls className="max-w-full max-h-full" />
                </div>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground text-center">
                  Preview is available for image/video files only.
                  <br />
                  Selected: {getFileName(previewItem.key)}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
      <Dialog open={renameOpen} onOpenChange={(nextOpen) => {
        if (isRenaming) return;
        setRenameOpen(nextOpen);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Rename file</DialogTitle>
            <DialogDescription className="text-xs">
              Enter a new name for the selected S3 object.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleConfirmRename();
                }
              }}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              autoFocus
              disabled={isRenaming}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRenameOpen(false)}
                disabled={isRenaming}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void handleConfirmRename()}
                disabled={isRenaming || !renameValue.trim()}
              >
                {isRenaming ? 'Renaming...' : 'Rename'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
