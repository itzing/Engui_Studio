"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { validateLoRAFileClient } from '@/lib/loraValidation';
import { removeDeletedLoraFromCreateDrafts } from '@/lib/create/loraDraftSanitizer';
import { LORA_BASE_MODELS, buildLoraPairs, filterLorasForTarget, getExplicitBaseModel, getLoraSearchText, getVideoLoraPathSet, type LoraBaseModel } from '@/lib/lora/modelFilters';
import { Upload, Trash2, Package, AlertCircle, CheckCircle, X, RefreshCw, Pencil, Save, Search, ImageIcon, Video, ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { getPairHelperProfile, getSingleHelperProfile, LORA_HELPER_NOTES_MAX_LENGTH, type LoRAHelperProfile } from '@/lib/lora/helperProfiles';

// TypeScript interfaces
interface LoRAFile {
  id: string;
  name: string;
  fileName: string;
  s3Path: string;
  s3Url: string;
  presignedUrl?: string; // Optional presigned URL with expiration
  fileSize: string;
  extension: string;
  uploadedAt: string;
  workspaceId?: string;
  targetOverride?: 'image' | 'video' | string | null;
  baseModel?: LoraBaseModel | string | null;
  helperProfile?: LoRAHelperProfile | null;
  pairHelperProfile?: LoRAHelperProfile | null;
}

interface LoRAPair {
  key?: string;
  baseName: string;
  high?: LoRAFile;
  low?: LoRAFile;
  isComplete: boolean;
}

type UploadStatus = 'idle' | 'initializing' | 'uploading' | 'completing' | 'failed';
type LoraTargetFilter = 'all' | 'image' | 'video';
type LoraBaseModelFilter = 'all' | LoraBaseModel;
type LoraNameSort = 'asc' | 'desc';

type MultipartUploadPart = {
  partNumber: number;
  eTag?: string | null;
};

type LoraMultipartInitResponse = {
  success: boolean;
  volume: string;
  uploadId: string;
  key: string;
  partSize: number;
  error?: string;
};

type LoraMultipartFinalizeResponse = {
  success: boolean;
  lora?: LoRAFile;
  error?: string;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface LoRAManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoRAUploaded?: () => void;
  workspaceId?: string;
}

export function LoRAManagementDialog({
  open,
  onOpenChange,
  onLoRAUploaded,
  workspaceId,
}: LoRAManagementDialogProps) {
  const { t } = useI18n();
  const [loras, setLoras] = useState<LoRAFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadUploadedBytes, setUploadUploadedBytes] = useState(0);
  const [uploadTotalBytes, setUploadTotalBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [targetUpdatingId, setTargetUpdatingId] = useState<string | null>(null);
  const [helperEditingKey, setHelperEditingKey] = useState<string | null>(null);
  const [helperSavingKey, setHelperSavingKey] = useState<string | null>(null);
  const [helperNotesDraft, setHelperNotesDraft] = useState('');
  const [helperHighWeightDraft, setHelperHighWeightDraft] = useState('');
  const [helperLowWeightDraft, setHelperLowWeightDraft] = useState('');
  const [loraSearchQuery, setLoraSearchQuery] = useState('');
  const [loraTargetFilter, setLoraTargetFilter] = useState<LoraTargetFilter>('all');
  const [loraBaseModelFilter, setLoraBaseModelFilter] = useState<LoraBaseModelFilter>('all');
  const [loraNameSort, setLoraNameSort] = useState<LoraNameSort>('asc');
  const [uploadBaseModel, setUploadBaseModel] = useState<LoraBaseModel>('z-image');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadRef = useRef<{
    aborted: boolean;
    requests: Set<XMLHttpRequest>;
    volume?: string;
    key?: string;
    uploadId?: string;
  } | null>(null);

  // Group LoRAs into pairs (high/low)
  const groupLoRAsIntoPairs = useCallback((loraList: LoRAFile[], sortDirection: LoraNameSort): LoRAPair[] => {
    const componentPairs = buildLoraPairs(loraList);
    const pairedPaths = new Set(componentPairs.flatMap((pair) => [pair.high?.s3Path, pair.low?.s3Path]).filter(Boolean));
    const standalonePairs: LoRAPair[] = loraList
      .filter((lora) => !pairedPaths.has(lora.s3Path))
      .map((lora) => ({
        key: `single:${lora.id}`,
        baseName: lora.name,
        high: lora,
        low: undefined,
        isComplete: false,
      }));

    return [...componentPairs, ...standalonePairs].sort((a, b) => (
      sortDirection === 'asc'
        ? a.baseName.localeCompare(b.baseName)
        : b.baseName.localeCompare(a.baseName)
    ));
  }, []);

  const inferredVideoLoraPaths = useMemo(() => getVideoLoraPathSet(loras), [loras]);
  const getDisplayBaseModel = useCallback((lora: LoRAFile): LoraBaseModel => {
    const explicitBaseModel = getExplicitBaseModel(lora);
    if (explicitBaseModel) return explicitBaseModel;
    if (inferredVideoLoraPaths.has(lora.s3Path)) return 'wan2.2';
    return 'z-image';
  }, [inferredVideoLoraPaths]);

  const filteredLoras = useMemo(() => {
    const targetFiltered = loraTargetFilter === 'all'
      ? loras
      : filterLorasForTarget(loras, loraTargetFilter);
    const baseModelFiltered = loraBaseModelFilter === 'all'
      ? targetFiltered
      : targetFiltered.filter((lora) => getDisplayBaseModel(lora) === loraBaseModelFilter);
    const searchText = loraSearchQuery.trim().toLowerCase();
    if (!searchText) return baseModelFiltered;

    return baseModelFiltered.filter((lora) => getLoraSearchText(lora).includes(searchText));
  }, [getDisplayBaseModel, loras, loraBaseModelFilter, loraSearchQuery, loraTargetFilter]);

  const loraPairs = useMemo(
    () => groupLoRAsIntoPairs(filteredLoras, loraNameSort),
    [filteredLoras, groupLoRAsIntoPairs, loraNameSort]
  );

  // Fetch LoRAs with retry logic
  const fetchLoras = useCallback(async (retryCount = 0) => {
    const maxRetries = 2;
    setIsLoading(true);
    setError(null);
    
    try {
      const url = workspaceId 
        ? `/api/lora?workspaceId=${workspaceId}`
        : '/api/lora';
      
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      const data = await response.json();

      if (data.success) {
        setLoras(data.loras);
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to fetch LoRAs');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch LoRAs';
      
      // Retry on network errors
      if (retryCount < maxRetries && (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('timeout'))) {
        console.log(`Retrying fetch (attempt ${retryCount + 1}/${maxRetries})...`);
        setTimeout(() => fetchLoras(retryCount + 1), 1000 * (retryCount + 1)); // Exponential backoff
        return;
      }
      
      setError(`${errorMessage}${retryCount > 0 ? ' (after retries)' : ''}`);
      console.error('Error fetching LoRAs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  // Fetch LoRAs when dialog opens
  useEffect(() => {
    if (open) {
      fetchLoras();
    }
  }, [open, fetchLoras]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

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

  async function abortActiveUpload(uploadContext: NonNullable<typeof activeUploadRef.current>) {
    uploadContext.aborted = true;
    for (const request of uploadContext.requests) {
      request.abort();
    }

    if (uploadContext.volume && uploadContext.key && uploadContext.uploadId) {
      try {
        await postJson('/api/s3-storage/multipart/abort', {
          volume: uploadContext.volume,
          key: uploadContext.key,
          uploadId: uploadContext.uploadId,
        });
      } catch {
        // Best-effort cleanup only. Keep the original upload failure visible.
      }
    }
  }

  function uploadPartWithProgress(input: {
    url: string;
    blob: Blob;
    partNumber: number;
    partProgress: number[];
    totalBytes: number;
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
        setUploadUploadedBytes(uploadedBytes);
        setUploadProgress(Math.min(100, Math.round((uploadedBytes / input.totalBytes) * 100)));
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
          setUploadUploadedBytes(uploadedBytes);
          setUploadProgress(Math.min(100, Math.round((uploadedBytes / input.totalBytes) * 100)));
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

  async function handleFileUpload(file: File) {
    // Validate file
    const validation = validateLoRAFileClient(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('initializing');
    setUploadFileName(file.name);
    setUploadUploadedBytes(0);
    setUploadTotalBytes(file.size);
    setError(null);
    setSuccessMessage(null);

    let uploadContext: NonNullable<typeof activeUploadRef.current> | null = null;
    let keepTerminalState = false;

    try {
      const init = await postJson<LoraMultipartInitResponse>('/api/lora/multipart/init', {
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || 'application/octet-stream',
      });

      uploadContext = {
        aborted: false,
        requests: new Set<XMLHttpRequest>(),
        volume: init.volume,
        key: init.key,
        uploadId: init.uploadId,
      };
      activeUploadRef.current = uploadContext;
      setUploadStatus('uploading');

      const totalParts = Math.ceil(file.size / init.partSize);
      const partProgress = Array.from({ length: totalParts }, () => 0);
      const completedParts: MultipartUploadPart[] = [];

      for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
        if (uploadContext.aborted) {
          throw new Error('Upload cancelled.');
        }

        const start = (partNumber - 1) * init.partSize;
        const end = Math.min(start + init.partSize, file.size);
        const params = new URLSearchParams({
          volume: init.volume,
          key: init.key,
          uploadId: init.uploadId,
          partNumber: String(partNumber),
        });

        let lastPartError: unknown;
        let part: MultipartUploadPart | null = null;

        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            part = await uploadPartWithProgress({
              url: `/api/s3-storage/multipart/proxy-part?${params.toString()}`,
              blob: file.slice(start, end),
              partNumber,
              partProgress,
              totalBytes: file.size,
              uploadContext,
            });
            break;
          } catch (partError) {
            lastPartError = partError;
            partProgress[partNumber - 1] = 0;
            const uploadedBytes = partProgress.reduce((sum, value) => sum + value, 0);
            setUploadUploadedBytes(uploadedBytes);
            setUploadProgress(Math.min(100, Math.round((uploadedBytes / file.size) * 100)));
            if (uploadContext.aborted) {
              throw partError;
            }
            if (attempt < 3) {
              await sleep(attempt * 1000);
            }
          }
        }

        if (!part) {
          throw lastPartError instanceof Error ? lastPartError : new Error(`Part ${partNumber} upload failed.`);
        }

        completedParts.push(part);
      }

      setUploadUploadedBytes(file.size);
      setUploadProgress(100);
      setUploadStatus('completing');

      const finalized = await postJson<LoraMultipartFinalizeResponse>('/api/lora/multipart/finalize', {
        volume: init.volume,
        key: init.key,
        uploadId: init.uploadId,
        fileName: file.name,
        fileSize: file.size,
        baseModel: uploadBaseModel,
        workspaceId,
        parts: completedParts.sort((a, b) => a.partNumber - b.partNumber),
      });

      if (!finalized.success) {
        throw new Error(finalized.error || 'Upload failed');
      }

      setSuccessMessage(`✓ ${file.name} ${t('loraManagement.messages.uploadSuccess')}`);
      await fetchLoras();
      onLoRAUploaded?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload file';

      if (uploadContext && !errorMessage.includes('cancelled')) {
        await abortActiveUpload(uploadContext);
      }

      setUploadStatus(errorMessage.includes('cancelled') ? 'idle' : 'failed');
      keepTerminalState = !errorMessage.includes('cancelled');
      setError(errorMessage.includes('cancelled') ? 'Upload cancelled.' : `Upload failed: ${errorMessage}. Please try again.`);
      console.error('Error uploading LoRA:', err);
    } finally {
      if (activeUploadRef.current === uploadContext) {
        activeUploadRef.current = null;
      }
      setIsUploading(false);
      if (!keepTerminalState) {
        setUploadProgress(0);
        setUploadStatus('idle');
        setUploadFileName('');
        setUploadUploadedBytes(0);
        setUploadTotalBytes(0);
      }
    }
  }

  const handleCancelUpload = async () => {
    const uploadContext = activeUploadRef.current;
    if (!uploadContext) return;
    await abortActiveUpload(uploadContext);
    setIsUploading(false);
    setUploadProgress(0);
    setUploadStatus('idle');
    setUploadFileName('');
    setUploadUploadedBytes(0);
    setUploadTotalBytes(0);
    setError('Upload cancelled.');
  };

  // Handle file input change (supports multiple files)
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Upload all selected files
      for (let i = 0; i < files.length; i++) {
        await handleFileUpload(files[i]);
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Handle delete with retry logic
  const handleDelete = async (id: string, retryCount = 0) => {
    const maxRetries = 2;
    setError(null);
    setSuccessMessage(null);
    setIsDeleting(true);
    const deletedLora = loras.find((entry) => entry.id === id);
    
    try {
      const response = await fetch(`/api/lora/${id}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const data = await response.json();

      if (data.success) {
        // Close confirmation dialog first
        setDeleteConfirmId(null);
        
        // Show success message
        if (data.warning) {
          setSuccessMessage(`✓ ${t('loraManagement.messages.deleteSuccess')} (Note: ${data.warning})`);
        } else {
          setSuccessMessage(`✓ ${t('loraManagement.messages.deleteSuccess')}`);
        }
        
        if (deletedLora) {
          removeDeletedLoraFromCreateDrafts([deletedLora.s3Path, deletedLora.fileName]);
        }

        // Refresh the list
        await fetchLoras();
        onLoRAUploaded?.();
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete LoRA';
      
      // Retry on network errors
      if (retryCount < maxRetries && (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('timeout'))) {
        console.log(`Retrying delete (attempt ${retryCount + 1}/${maxRetries})...`);
        setTimeout(() => handleDelete(id, retryCount + 1), 1000 * (retryCount + 1)); // Exponential backoff
        return;
      }
      
      setError(`Delete failed: ${errorMessage}${retryCount > 0 ? ' (after retries)' : ''}. Please try again.`);
      console.error('Error deleting LoRA:', err);
      setDeleteConfirmId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes: string): string => {
    const size = parseInt(bytes, 10);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const uploadStatusLabel = (() => {
    if (uploadStatus === 'initializing') return 'Preparing upload...';
    if (uploadStatus === 'completing') return 'Finalizing upload...';
    if (uploadStatus === 'failed') return 'Upload failed';
    return t('loraManagement.uploadArea.uploading');
  })();

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const isDefaultVideoLora = (lora: LoRAFile, pair: LoRAPair) => {
    if (lora.targetOverride === 'video') return true;
    if (lora.targetOverride === 'image') return false;
    return pair.isComplete;
  };

  const handleTargetChange = async (lora: LoRAFile, targetOverride: 'image' | 'video') => {
    setTargetUpdatingId(lora.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/lora/${lora.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetOverride }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Update failed');
      }

      setLoras((previous) => previous.map((entry) => (
        entry.id === lora.id ? { ...entry, targetOverride: data.lora?.targetOverride ?? targetOverride } : entry
      )));
      onLoRAUploaded?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update LoRA target';
      setError(`Update failed: ${errorMessage}. Please try again.`);
    } finally {
      setTargetUpdatingId(null);
    }
  };

  const handleBaseModelChange = async (lora: LoRAFile, baseModel: LoraBaseModel) => {
    setTargetUpdatingId(lora.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/lora/${lora.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseModel }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Update failed');
      }

      setLoras((previous) => previous.map((entry) => (
        entry.id === lora.id ? {
          ...entry,
          baseModel: data.lora?.baseModel ?? baseModel,
          targetOverride: data.lora?.targetOverride ?? (baseModel === 'wan2.2' ? 'video' : 'image'),
        } : entry
      )));
      setSuccessMessage('✓ LoRA model updated.');
      onLoRAUploaded?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update LoRA base model';
      setError(`Update failed: ${errorMessage}. Please try again.`);
    } finally {
      setTargetUpdatingId(null);
    }
  };

  const getHelperEditorKey = (pair: LoRAPair) => {
    if (pair.high && pair.low) return `pair:${pair.high.id}:${pair.low.id}`;
    const single = pair.high ?? pair.low;
    return single ? `single:${single.id}` : pair.baseName;
  };

  const getHelperProfileForPair = (pair: LoRAPair) => (
    pair.high && pair.low
      ? getPairHelperProfile(pair)
      : getSingleHelperProfile(pair.high ?? pair.low)
  );

  const openHelperEditor = (pair: LoRAPair) => {
    const profile = getHelperProfileForPair(pair);
    setHelperEditingKey(getHelperEditorKey(pair));
    setHelperNotesDraft(profile?.notes ?? '');
    setHelperHighWeightDraft(typeof profile?.recommendedHighWeight === 'number' ? String(profile.recommendedHighWeight) : '');
    setHelperLowWeightDraft(typeof profile?.recommendedLowWeight === 'number' ? String(profile.recommendedLowWeight) : '');
  };

  const updateSavedHelperProfile = (profile: LoRAHelperProfile) => {
    setLoras((previous) => previous.map((entry) => {
      if (profile.scope === 'single' && entry.id === profile.loraId) {
        return { ...entry, helperProfile: profile };
      }
      if (profile.scope === 'pair' && (entry.id === profile.highLoraId || entry.id === profile.lowLoraId)) {
        return { ...entry, pairHelperProfile: profile };
      }
      return entry;
    }));
  };

  const saveHelperProfile = async (pair: LoRAPair) => {
    const key = getHelperEditorKey(pair);
    const notes = helperNotesDraft.trim();
    if (notes.length > LORA_HELPER_NOTES_MAX_LENGTH) {
      setError(`Helper notes must be ${LORA_HELPER_NOTES_MAX_LENGTH} characters or less.`);
      return;
    }

    const isPair = !!(pair.high && pair.low);
    const single = pair.high ?? pair.low;
    if (!isPair && !single) return;

    setHelperSavingKey(key);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/lora/helper-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isPair ? {
          workspaceId,
          scope: 'pair',
          highLoraId: pair.high!.id,
          lowLoraId: pair.low!.id,
          notes,
          recommendedHighWeight: helperHighWeightDraft,
          recommendedLowWeight: helperLowWeightDraft,
        } : {
          workspaceId,
          scope: 'single',
          loraId: single!.id,
          notes,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save helper profile');
      }

      updateSavedHelperProfile(data.profile);
      setHelperEditingKey(null);
      setSuccessMessage('✓ LoRA helper saved.');
      onLoRAUploaded?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save helper profile';
      setError(`Save failed: ${errorMessage}. Please try again.`);
    } finally {
      setHelperSavingKey(null);
    }
  };

  const renderTargetControl = (lora: LoRAFile, pair: LoRAPair) => {
    const checked = isDefaultVideoLora(lora, pair);
    return (
      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-border"
          checked={checked}
          disabled={targetUpdatingId === lora.id}
          onChange={(event) => handleTargetChange(lora, event.target.checked ? 'video' : 'image')}
          aria-label={`Use ${lora.fileName} for video`}
        />
        <span>Use for video</span>
      </label>
    );
  };

  const renderBaseModelControl = (lora: LoRAFile) => (
    <label className="mt-2 block space-y-1 text-xs text-muted-foreground">
      <span>Base model</span>
      <select
        value={getDisplayBaseModel(lora)}
        disabled={targetUpdatingId === lora.id}
        onChange={(event) => void handleBaseModelChange(lora, event.target.value as LoraBaseModel)}
        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
        aria-label={`Base model for ${lora.fileName}`}
      >
        {LORA_BASE_MODELS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );

  // Handle S3 sync
  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/lora/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          workspaceId,
          userId: 'user-with-settings' // TODO: Get from auth context
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const data = await response.json();

      if (data.success) {
        const syncedCount = Array.isArray(data.synced) ? data.synced.length : 0;
        const deletedCount = Array.isArray(data.deleted) ? data.deleted.length : 0;

        if (syncedCount > 0) {
          setSuccessMessage(`✓ ${t('loraManagement.messages.syncSuccess', { count: syncedCount })}`);
        } else if (deletedCount > 0) {
          setSuccessMessage(`✓ ${t('loraManagement.messages.syncDeleted', { count: deletedCount })}`);
        } else {
          setSuccessMessage(`✓ ${t('loraManagement.messages.allSynced')}`);
        }
        await fetchLoras();
        onLoRAUploaded?.();
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync LoRAs';
      setError(`Sync failed: ${errorMessage}. Please try again.`);
      console.error('Error syncing LoRAs:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogOverlay className="z-[110]" />
          <DialogPrimitive.Content
            className="fixed left-[50%] top-[50%] z-[110] grid w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg max-h-[90vh] overflow-y-auto"
          >
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
            <DialogHeader>
              <DialogTitle>{t('loraManagement.title')}</DialogTitle>
              <DialogDescription>
                {t('loraManagement.description')}
              </DialogDescription>
          </DialogHeader>

          {/* Messages */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm">{error}</p>
                {error.includes('Please try again') && (
                  <button
                    onClick={() => fetchLoras()}
                    className="text-xs underline hover:no-underline mt-1 opacity-80 hover:opacity-100 transition-opacity"
                  >
                    {t('loraManagement.actions.retryNow')}
                  </button>
                )}
              </div>
              <button
                onClick={() => setError(null)}
                className="text-current hover:opacity-70 transition-opacity"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-md text-green-400">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm flex-1">{successMessage}</span>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-current hover:opacity-70 transition-opacity"
                aria-label="Dismiss message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Upload Section */}
          <div className="mb-3 grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="lora-upload-base-model">
              Upload base model
            </label>
            <select
              id="lora-upload-base-model"
              value={uploadBaseModel}
              onChange={(event) => setUploadBaseModel(event.target.value as LoraBaseModel)}
              disabled={isUploading}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              {LORA_BASE_MODELS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div
            className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-all duration-200 ${
              isDragging
                ? 'border-primary bg-primary/10 scale-[1.02]'
                : 'border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/30'
            } ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!isUploading) {
                  fileInputRef.current?.click();
                }
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".safetensors,.ckpt"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
              disabled={isUploading}
            />
            
            <Upload className={`h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 transition-colors ${
              isDragging ? 'text-primary' : 'text-muted-foreground'
            }`} />
            
            {isUploading ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{uploadStatusLabel}</p>
                <p className="mx-auto max-w-xs truncate text-xs text-muted-foreground" title={uploadFileName}>
                  {uploadFileName}
                </p>
                <div className="w-full max-w-xs mx-auto bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span>{uploadProgress}%</span>
                  <span>
                    {formatFileSize(String(uploadUploadedBytes))} / {formatFileSize(String(uploadTotalBytes))}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleCancelUpload();
                  }}
                  className="h-8 px-2"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium mb-2">
                  {t('loraManagement.uploadArea.dragAndDrop')}
                </p>
                <p className="text-xs text-muted-foreground mb-4">{t('loraManagement.uploadArea.orClickToBrowse')}</p>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  variant="outline"
                  size="sm"
                  className="hover:bg-primary/10 transition-colors"
                >
                  {t('loraManagement.uploadArea.browseFiles')}
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                  {t('loraManagement.uploadArea.fileTypes')}
                </p>
              </>
            )}
          </div>

          {/* LoRA List Section */}
          <div className="mt-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {t('loraManagement.yourLoras')} {loras.length > 0 && `(${filteredLoras.length}/${loras.length})`}
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full gap-2 sm:w-auto"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? t('loraManagement.actions.syncing') : t('loraManagement.actions.syncFromS3')}
              </Button>
            </div>

            <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={loraSearchQuery}
                  onChange={(event) => setLoraSearchQuery(event.target.value)}
                  placeholder="Search LoRAs..."
                  className="pl-9"
                  aria-label="Search LoRAs"
                />
              </div>

              <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/30 p-1 sm:grid-cols-4">
                {([
                  { value: 'all', label: 'All bases' },
                  ...LORA_BASE_MODELS.map((model) => ({ value: model.value, label: model.label })),
                ] as const).map((option) => {
                  const isActive = loraBaseModelFilter === option.value;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={isActive ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setLoraBaseModelFilter(option.value)}
                      aria-pressed={isActive}
                    >
                      <span>{option.label}</span>
                    </Button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-muted/30 p-1">
                {([
                  { value: 'all', label: 'All', icon: Package },
                  { value: 'image', label: 'Image', icon: ImageIcon },
                  { value: 'video', label: 'Video', icon: Video },
                ] as const).map((option) => {
                  const Icon = option.icon;
                  const isActive = loraTargetFilter === option.value;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={isActive ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 gap-1.5 px-2"
                      onClick={() => setLoraTargetFilter(option.value)}
                      aria-pressed={isActive}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{option.label}</span>
                    </Button>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 gap-2"
                onClick={() => setLoraNameSort((current) => current === 'asc' ? 'desc' : 'asc')}
                aria-label={loraNameSort === 'asc' ? 'Sort by name descending' : 'Sort by name ascending'}
              >
                {loraNameSort === 'asc' ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
                <span>{loraNameSort === 'asc' ? 'Name A-Z' : 'Name Z-A'}</span>
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-4" role="status">
                  <span className="sr-only">{t('common.loading')}</span>
                </div>
                <p className="text-sm">{t('loraManagement.messages.loadingLoras')}</p>
              </div>
            ) : loras.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">{t('loraManagement.messages.noLorasUploaded')}</p>
                <p className="text-sm mt-1">
                  {t('loraManagement.messages.uploadFirstLora')}
                </p>
              </div>
            ) : loraPairs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No LoRAs match your filters</p>
                <p className="text-sm mt-1">
                  Try a different search term, target filter, or base model.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {loraPairs.map((pair) => (
                  <Card 
                    key={pair.key ?? pair.baseName}
                    className={`group hover:border-primary/50 hover:shadow-md transition-all duration-200 ${
                      pair.isComplete ? 'border-green-500/30' : 'border-yellow-500/30'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Pair Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex min-w-0 items-center gap-2">
                            <Package className={`h-5 w-5 ${pair.isComplete ? 'text-green-500' : 'text-yellow-500'}`} />
                            <h4 className="truncate text-sm font-medium">{pair.baseName}</h4>
                            {pair.isComplete ? (
                              <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded">{t('loraManagement.status.complete')}</span>
                            ) : (
                              <span className="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded">{t('loraManagement.status.incomplete')}</span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 gap-1.5"
                            onClick={() => openHelperEditor(pair)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Helper
                          </Button>
                        </div>

                        {/* High/Low Files */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* High LoRA */}
                          <div className={`p-3 rounded-md border ${pair.high ? 'bg-muted/30 border-muted' : 'bg-muted/10 border-dashed border-muted-foreground/20'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-muted-foreground">{t('loraManagement.status.high')}</span>
                              {pair.high && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmId(pair.high!.id);
                                  }}
                                  aria-label={`Delete ${pair.high.fileName}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            {pair.high ? (
                              <>
                                <p className="text-xs truncate" title={pair.high.fileName}>
                                  {pair.high.fileName}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatFileSize(pair.high.fileSize)} • {formatDate(pair.high.uploadedAt)}
                                </p>
                                {renderBaseModelControl(pair.high)}
                                {renderTargetControl(pair.high, pair)}
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">{t('loraManagement.status.notUploaded')}</p>
                            )}
                          </div>

                          {/* Low LoRA */}
                          <div className={`p-3 rounded-md border ${pair.low ? 'bg-muted/30 border-muted' : 'bg-muted/10 border-dashed border-muted-foreground/20'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-muted-foreground">{t('loraManagement.status.low')}</span>
                              {pair.low && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmId(pair.low!.id);
                                  }}
                                  aria-label={`Delete ${pair.low.fileName}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            {pair.low ? (
                              <>
                                <p className="text-xs truncate" title={pair.low.fileName}>
                                  {pair.low.fileName}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatFileSize(pair.low.fileSize)} • {formatDate(pair.low.uploadedAt)}
                                </p>
                                {renderBaseModelControl(pair.low)}
                                {renderTargetControl(pair.low, pair)}
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">{t('loraManagement.status.notUploaded')}</p>
                            )}
                          </div>
                        </div>

                        {helperEditingKey === getHelperEditorKey(pair) ? (
                          <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div>
                                <div className="text-xs font-medium">Trigger notes</div>
                                <div className="text-xs text-muted-foreground">
                                  Blank lines split clickable copy groups in pickers.
                                </div>
                              </div>
                              <div className={`text-xs ${helperNotesDraft.length > LORA_HELPER_NOTES_MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {helperNotesDraft.length}/{LORA_HELPER_NOTES_MAX_LENGTH}
                              </div>
                            </div>
                            <textarea
                              value={helperNotesDraft}
                              onChange={(event) => setHelperNotesDraft(event.target.value)}
                              maxLength={LORA_HELPER_NOTES_MAX_LENGTH}
                              rows={5}
                              className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                              placeholder="Trigger words, sample prompt snippets, usage notes..."
                            />

                            {pair.high && pair.low ? (
                              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label className="space-y-1 text-xs">
                                  <span className="font-medium">Recommended HIGH weight</span>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={helperHighWeightDraft}
                                    onChange={(event) => setHelperHighWeightDraft(event.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="Optional"
                                  />
                                </label>
                                <label className="space-y-1 text-xs">
                                  <span className="font-medium">Recommended LOW weight</span>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={helperLowWeightDraft}
                                    onChange={(event) => setHelperLowWeightDraft(event.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="Optional"
                                  />
                                </label>
                              </div>
                            ) : null}

                            <div className="mt-3 flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setHelperEditingKey(null)}
                                disabled={helperSavingKey === getHelperEditorKey(pair)}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => saveHelperProfile(pair)}
                                disabled={helperSavingKey === getHelperEditorKey(pair) || helperNotesDraft.length > LORA_HELPER_NOTES_MAX_LENGTH}
                              >
                                <Save className="h-3.5 w-3.5" />
                                Save helper
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => {
        if (!open) setDeleteConfirmId(null);
      }}>
        <DialogPortal>
          <DialogOverlay className="z-[120]" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[120] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          <DialogHeader>
            <DialogTitle>{t('loraManagement.deleteDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('loraManagement.deleteDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              disabled={isDeleting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={isDeleting}
            >
              {isDeleting ? t('loraManagement.deleteDialog.deleting') : t('common.delete')}
            </Button>
          </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </>
  );
}
