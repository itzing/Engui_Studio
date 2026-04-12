'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowUp, File, Folder, RefreshCw, Trash2 } from 'lucide-react';

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

interface S3BucketViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv']);

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

function normalizePrefix(prefix: string): string {
  if (!prefix) return '';
  return prefix.endsWith('/') ? prefix : `${prefix}/`;
}

function makeTimestamp(): string {
  const now = new Date();
  return `${now.toLocaleTimeString('en-GB', { hour12: false })}.${String(now.getMilliseconds()).padStart(3, '0')}`;
}

export function S3BucketViewerDialog({ open, onOpenChange }: S3BucketViewerDialogProps) {
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
  const [error, setError] = useState<string>('');

  function appendDeleteLog(entry: Omit<DeleteLogEntry, 'timestamp'>) {
    setDeleteLogs((previous) => [...previous, { ...entry, timestamp: makeTimestamp() }]);
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

  async function loadItems(volume: string, path: string) {
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
    } catch (loadError) {
      setItems([]);
      setSelectedKeys([]);
      setPreviewKey('');
      setError(loadError instanceof Error ? loadError.message : 'Failed to load files.');
    } finally {
      setIsLoading(false);
    }
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
        plan.push(...nestedKeys);
      } else {
        plan.push(key);
      }
    }

    return Array.from(new Set(plan));
  }

  async function executeDeletePlan(inputKeys: string[], contextKey: string, successPathAfterDelete: string) {
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

        const deletedKeys: string[] = Array.isArray(data.deletedKeys) ? data.deletedKeys : batch;
        completed += deletedKeys.length;
        setDeleteLogStatus(deletedKeys, 'deleted');
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

      await loadItems(activeVolume, successPathAfterDelete);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Delete failed.');
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
    await executeDeletePlan([currentPath], currentPath, parentPath);
    setCurrentPath(parentPath);
  }

  async function handleDeleteSelected() {
    if (!activeVolume || selectedKeys.length === 0) return;

    const confirmed = confirm(`Delete ${selectedKeys.length} selected item(s)?`);
    if (!confirmed) return;

    const targets = [...selectedKeys];
    await executeDeletePlan(targets, currentPath || activeVolume, currentPath);
  }

  function handleCancelDelete() {
    setDeleteProgress((previous) => ({
      ...previous,
      cancelled: true,
    }));
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
                disabled={!activeVolume || isLoading || isDeleting}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={selectedKeys.length === 0 || isDeleting}
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
            {isDeleting && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    Deleting {deleteProgress.completed}/{deleteProgress.total}
                    {deleteProgress.currentKey ? `, current: ${deleteProgress.currentKey}` : ''}
                  </span>
                  <span>{deleteProgress.cancelled ? 'Stopping after current item...' : 'In progress'}</span>
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
            <div className="flex items-center gap-2">
              <span>Bucket:</span>
              <select
                value={activeVolume}
                onChange={(event) => handleVolumeChange(event.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                disabled={isDeleting}
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
                disabled={!activeVolume || isDeleting}
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
                    disabled={isDeleting}
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
              <span className="text-xs text-muted-foreground">Contents</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleToggleSelectAllVisible}
                  disabled={visibleKeys.length === 0 || isDeleting}
                >
                  {allVisibleSelected ? 'Clear visible' : 'Select visible'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={handleDeleteCurrentFolder}
                  disabled={!currentPath || isDeleting}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete folder
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleGoUp}
                  disabled={!currentPath || isDeleting}
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
                          disabled={isDeleting}
                        />

                        <button
                          type="button"
                          className="flex items-center gap-2 flex-1 min-w-0 text-left"
                          onClick={() => {
                            if (isDeleting) return;
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
    </Dialog>
  );
}
