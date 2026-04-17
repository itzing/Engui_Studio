'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useStudio, Job } from '@/lib/context/StudioContext';
import { VideoEditorView } from '@/components/video-editor/VideoEditorView';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Info } from 'lucide-react';

type CenterMode = 'image' | 'video';
type ImageViewMode = 'native' | 'fit';

type GalleryItem = {
  id: string;
  url: string;
  prompt?: string;
  modelId?: string;
  workspaceId?: string;
  sourceJobId?: string | null;
  createdAt?: number;
};

type HoverPreview = {
  id: string;
  type: string;
  url?: string;
  prompt?: string;
  modelId?: string;
  workspaceId?: string;
  sourceJobId?: string | null;
  status?: string;
  createdAt?: number;
} | null;

type RightPanelMode = 'jobs' | 'gallery';

type ReuseAction = 'txt2img' | 'img2img' | 'img2vid';

export default function CenterPanel({ mobile = false }: { mobile?: boolean }) {
  const { activeArtifactId, activeTool, jobs, activeWorkspaceId, addJob } = useStudio();
  const { showToast } = useToast();
  const [mode, setMode] = useState<CenterMode>('image');
  const [hoverPreview, setHoverPreview] = useState<HoverPreview>(null);
  const [imageViewMode, setImageViewMode] = useState<ImageViewMode>('native');
  const [selectedImageJobId, setSelectedImageJobId] = useState<string | null>(null);
  const [selectedGalleryItemId, setSelectedGalleryItemId] = useState<string | null>(null);
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('jobs');
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [isPreviewAlreadyInGallery, setIsPreviewAlreadyInGallery] = useState(false);
  const [isSavingToGallery, setIsSavingToGallery] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [reuseAction, setReuseAction] = useState<ReuseAction | null>(null);

  useEffect(() => {
    if (activeTool === 'speech-sequencer') {
      setMode('video');
    }
  }, [activeTool]);

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('engui:center-mode');
      if (savedMode === 'image' || savedMode === 'video') {
        setMode(savedMode);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('engui:center-mode', mode);
    } catch {
      // ignore storage errors
    }
  }, [mode]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent;
      const detail = (custom.detail ?? null) as HoverPreview;
      setHoverPreview(detail);

      if (detail && detail.type === 'image' && detail.status === 'completed' && detail.url) {
        if (detail.modelId === 'gallery') {
          setSelectedGalleryItemId(detail.id);
        } else {
          setSelectedImageJobId(detail.id);
        }
      }
    };

    const panelModeHandler = (event: Event) => {
      const custom = event as CustomEvent;
      const detail = custom.detail;
      if (detail === 'jobs' || detail === 'gallery') {
        setRightPanelMode(detail);
      }
    };

    const galleryItemsHandler = (event: Event) => {
      const custom = event as CustomEvent;
      const detail = Array.isArray(custom.detail) ? custom.detail : [];
      const nextItems = detail
        .filter((item: any) => item?.type === 'image' && typeof item?.url === 'string' && item.url)
        .map((item: any) => ({
          id: item.id,
          url: item.url,
          prompt: item.prompt,
          modelId: item.modelId,
          workspaceId: item.workspaceId,
          sourceJobId: item.sourceJobId,
          createdAt: item.createdAt,
        } as GalleryItem));
      setGalleryItems(nextItems);
    };

    const gallerySelectionHandler = (event: Event) => {
      const custom = event as CustomEvent<{ id?: string } | null>;
      if (custom.detail?.id) {
        setSelectedGalleryItemId(custom.detail.id);
      }
    };

    if (typeof window !== 'undefined') {
      const savedPanelMode = window.localStorage.getItem('engui.rightPanel.mode');
      if (savedPanelMode === 'jobs' || savedPanelMode === 'gallery') {
        setRightPanelMode(savedPanelMode);
      }
    }

    window.addEventListener('jobHoverPreview', handler as EventListener);
    window.addEventListener('rightPanelModeChanged', panelModeHandler as EventListener);
    window.addEventListener('rightPanelGalleryItemsChanged', galleryItemsHandler as EventListener);
    window.addEventListener('rightPanelGallerySelect', gallerySelectionHandler as EventListener);
    return () => {
      window.removeEventListener('jobHoverPreview', handler as EventListener);
      window.removeEventListener('rightPanelModeChanged', panelModeHandler as EventListener);
      window.removeEventListener('rightPanelGalleryItemsChanged', galleryItemsHandler as EventListener);
      window.removeEventListener('rightPanelGallerySelect', gallerySelectionHandler as EventListener);
    };
  }, []);

  const completedImageJobs = useMemo(() => {
    return [...jobs]
      .filter((job: Job) => job.status === 'completed' && !!job.resultUrl && job.type === 'image')
      .map(job => ({
        id: job.id,
        type: 'image',
        url: job.resultUrl as string,
        prompt: job.prompt,
        modelId: job.modelId,
        workspaceId: job.workspaceId,
        createdAt: job.createdAt,
      }));
  }, [jobs]);

  const latestSuccessfulJob = completedImageJobs[0] || null;

  useEffect(() => {
    if (!selectedImageJobId && latestSuccessfulJob) {
      setSelectedImageJobId(latestSuccessfulJob.id);
      return;
    }
    if (selectedImageJobId && !completedImageJobs.some(job => job.id === selectedImageJobId)) {
      setSelectedImageJobId(latestSuccessfulJob?.id || null);
    }
  }, [selectedImageJobId, latestSuccessfulJob, completedImageJobs]);

  useEffect(() => {
    if (!selectedGalleryItemId && galleryItems.length > 0) {
      setSelectedGalleryItemId(galleryItems[0].id);
      return;
    }
    if (selectedGalleryItemId && !galleryItems.some(item => item.id === selectedGalleryItemId)) {
      setSelectedGalleryItemId(galleryItems[0]?.id || null);
    }
  }, [selectedGalleryItemId, galleryItems]);

  useEffect(() => {
    try {
      const savedViewMode = localStorage.getItem('engui:center-image-view-mode');
      if (savedViewMode === 'native' || savedViewMode === 'fit') {
        setImageViewMode(savedViewMode);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('engui:center-image-view-mode', imageViewMode);
    } catch {}
  }, [imageViewMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (mode !== 'image') return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const navigationItems = rightPanelMode === 'gallery' ? galleryItems : completedImageJobs;
      if (navigationItems.length === 0) return;

      const selectedId = rightPanelMode === 'gallery' ? selectedGalleryItemId : selectedImageJobId;
      const baseId = (hoverPreview && hoverPreview.id) ? hoverPreview.id : (selectedId || navigationItems[0].id);
      const currentIndex = navigationItems.findIndex(item => item.id === baseId);
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;

      const nextIndex = event.key === 'ArrowRight'
        ? (safeIndex + 1) % navigationItems.length
        : (safeIndex - 1 + navigationItems.length) % navigationItems.length;

      setHoverPreview(null);
      if (rightPanelMode === 'gallery') {
        setSelectedGalleryItemId(navigationItems[nextIndex].id);
      } else {
        setSelectedImageJobId(navigationItems[nextIndex].id);
      }
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, hoverPreview, rightPanelMode, selectedImageJobId, selectedGalleryItemId, completedImageJobs, galleryItems]);

  const selectedImageJob = useMemo(() => {
    if (!selectedImageJobId) return latestSuccessfulJob;
    return completedImageJobs.find(job => job.id === selectedImageJobId) || latestSuccessfulJob;
  }, [selectedImageJobId, completedImageJobs, latestSuccessfulJob]);

  const selectedGalleryItem = useMemo(() => {
    if (!selectedGalleryItemId) return null;
    return galleryItems.find(item => item.id === selectedGalleryItemId) || null;
  }, [selectedGalleryItemId, galleryItems]);

  const previewJob = useMemo(() => {
    if (hoverPreview && hoverPreview.status === 'completed' && hoverPreview.url && hoverPreview.type === 'image') {
      return hoverPreview;
    }

    if (rightPanelMode === 'gallery' && selectedGalleryItem?.url) {
      return {
        id: selectedGalleryItem.id,
        type: 'image',
        url: selectedGalleryItem.url,
        prompt: selectedGalleryItem.prompt,
        modelId: selectedGalleryItem.modelId,
        workspaceId: selectedGalleryItem.workspaceId,
        sourceJobId: selectedGalleryItem.sourceJobId,
        status: 'completed',
        createdAt: selectedGalleryItem.createdAt,
      };
    }

    return selectedImageJob;
  }, [hoverPreview, rightPanelMode, selectedGalleryItem, selectedImageJob]);

  const isGalleryPreview = previewJob?.modelId === 'gallery';
  const shouldShowAddToGallery = !!previewJob && !isGalleryPreview && !isPreviewAlreadyInGallery;

  useEffect(() => {
    if (!previewJob || isGalleryPreview) {
      setIsPreviewAlreadyInGallery(false);
      return;
    }

    let cancelled = false;

    const loadGalleryState = async () => {
      try {
        const response = await fetch(`/api/jobs/${previewJob.id}`);
        const data = await response.json();
        if (!cancelled && response.ok && data.success) {
          const firstOutput = Array.isArray(data.job?.outputs) ? data.job.outputs.find((output: any) => output.outputId === 'output-1') || data.job.outputs[0] : null;
          setIsPreviewAlreadyInGallery(!!firstOutput?.alreadyInGallery);
        }
      } catch {
        if (!cancelled) {
          setIsPreviewAlreadyInGallery(false);
        }
      }
    };

    void loadGalleryState();
    return () => {
      cancelled = true;
    };
  }, [previewJob?.id, isGalleryPreview]);

  const dispatchGalleryAssetChanged = (assetId: string, reason: 'created' | 'existing' | 'updated' = 'updated') => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('galleryAssetChanged', {
      detail: {
        workspaceId: previewJob?.workspaceId || activeWorkspaceId,
        assetId,
        reason,
      }
    }));
  };

  const handleAddToGallery = async () => {
    if (!previewJob || isGalleryPreview || isSavingToGallery) return;

    setIsSavingToGallery(true);
    try {
      const response = await fetch('/api/gallery/assets/from-job-output', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: previewJob.id,
          outputId: 'output-1',
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to add output to Gallery');
      }

      if (data.asset?.id) {
        dispatchGalleryAssetChanged(data.asset.id, data.alreadyInGallery ? 'existing' : 'created');
      }
      setIsPreviewAlreadyInGallery(true);

      showToast(data.alreadyInGallery ? 'Output is already in Gallery' : 'Output added to Gallery', 'success');
    } catch (error) {
      console.error('Failed to add center image to gallery:', error);
      showToast(error instanceof Error ? error.message : 'Failed to add output to Gallery', 'error');
    } finally {
      setIsSavingToGallery(false);
    }
  };

  const handleReuse = async (action: ReuseAction) => {
    if (!previewJob || reuseAction) return;

    setReuseAction(action);
    try {
      const reuseUrl = isGalleryPreview
        ? `/api/gallery/assets/${previewJob.id}/reuse`
        : `/api/jobs/${previewJob.id}/reuse`;

      const response = await fetch(reuseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isGalleryPreview ? { action } : { action, outputId: 'output-1' }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.payload) {
        throw new Error(data.error || 'Failed to prepare reuse payload');
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reuseJobInput', {
          detail: data.payload,
        }));
      }

      showToast(`Opened in ${action}`, 'success');
    } catch (error) {
      console.error('Failed to reuse center image:', error);
      showToast(error instanceof Error ? error.message : 'Failed to reuse image', 'error');
    } finally {
      setReuseAction(null);
    }
  };

  const handleOpenInfo = () => {
    if (!previewJob || typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('openPreviewInfo', {
      detail: {
        id: previewJob.id,
        kind: previewJob.modelId === 'gallery' ? 'gallery' : 'job',
      },
    }));
  };

  const handleUpscale = async () => {
    if (!previewJob || isUpscaling) return;
    if (previewJob.type !== 'image' && previewJob.type !== 'video') {
      showToast('Upscale is only available for image and video results', 'error');
      return;
    }

    setIsUpscaling(true);
    showToast(`Starting upscale for ${previewJob.type}...`, 'info');

    try {
      const response = await fetch('/api/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isGalleryPreview ? {
          galleryAssetId: previewJob.id,
          type: previewJob.type,
        } : {
          jobId: previewJob.id,
          type: previewJob.type,
        }),
      });
      const data = await response.json();

      if (data.success && data.job) {
        addJob(data.job);
        showToast('Upscale job created and processing', 'success');
      } else {
        showToast(data.error || 'Failed to create upscale job', 'error');
      }
    } catch (error) {
      console.error('Failed to create center panel upscale job:', error);
      showToast('Failed to create upscale job', 'error');
    } finally {
      setIsUpscaling(false);
    }
  };

  if (mode === 'video') {
    return (
      <div className={mobile ? 'flex flex-1 flex-col h-full overflow-hidden pb-20' : 'flex-1 flex flex-col h-full overflow-hidden'}>
        <div className={`border-b border-border bg-background/80 backdrop-blur-sm ${mobile ? 'px-3 py-2' : 'h-12 px-4'} flex items-center justify-between`}>
          <h2 className="font-semibold text-sm">Workspace</h2>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setMode('image')}
              className="px-3 py-1.5 text-xs bg-transparent hover:bg-muted/40"
            >
              Image
            </button>
            <button
              onClick={() => setMode('video')}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground"
            >
              Video Edit
            </button>
          </div>
        </div>
        <VideoEditorView projectId={activeArtifactId || 'default-project'} />
      </div>
    );
  }

  return (
    <div className={mobile ? 'flex-1 bg-background/50 flex flex-col relative overflow-hidden pb-20' : 'flex-1 bg-background/50 flex flex-col relative overflow-hidden'}>
      <div className={`${mobile ? 'px-3 py-2 gap-2 flex-col items-stretch' : 'h-12 px-4 items-center justify-between'} border-b border-border flex bg-background/80 backdrop-blur-sm z-10`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-sm">Workspace</h2>
          {mobile && previewJob?.modelId && (
            <div className="text-[10px] text-muted-foreground truncate max-w-[45vw] text-right">{previewJob.modelId}</div>
          )}
        </div>
        <div className={`flex items-center gap-2 ${mobile ? 'justify-between' : ''}`}>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setImageViewMode('native')}
              className={`px-2.5 py-1.5 text-xs ${imageViewMode === 'native' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted/40'}`}
            >
              1:1
            </button>
            <button
              onClick={() => setImageViewMode('fit')}
              className={`px-2.5 py-1.5 text-xs ${imageViewMode === 'fit' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted/40'}`}
            >
              Fit
            </button>
          </div>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setMode('image')}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground"
            >
              Image
            </button>
            <button
              onClick={() => setMode('video')}
              className="px-3 py-1.5 text-xs bg-transparent hover:bg-muted/40"
            >
              Video Edit
            </button>
          </div>
        </div>
      </div>

      <div className={`flex-1 min-h-0 overflow-hidden ${mobile ? 'bg-black' : 'bg-black/30'}`}>
        {previewJob && previewJob.url ? (
          <div className="relative w-full h-full">
            <div className={`absolute inset-0 ${mobile ? 'p-0' : 'p-2'} ${imageViewMode === 'fit' ? 'overflow-hidden flex items-center justify-center' : 'overflow-auto'}`}>
              <img
                src={previewJob.url}
                alt={previewJob.prompt || 'Preview'}
                className={imageViewMode === 'fit'
                  ? `${mobile ? 'max-w-full max-h-full object-contain' : 'max-w-full max-h-full object-contain rounded-md border border-border/40 shadow-2xl'}`
                  : `${mobile ? 'block max-w-none max-h-none' : 'block max-w-none max-h-none rounded-md border border-border/40 shadow-2xl'}`}
                draggable={false}
              />
            </div>
            <div className={`absolute flex flex-wrap gap-2 ${mobile ? 'top-3 left-3 right-3 justify-start max-w-none' : 'top-3 right-3 justify-end max-w-[calc(100%-1.5rem)]'}`}>
              <Button
                size={mobile ? 'icon' : 'sm'}
                variant="secondary"
                className={`bg-black/70 hover:bg-black/80 text-white border border-white/10 ${mobile ? 'h-9 w-9' : ''}`}
                onClick={handleOpenInfo}
                aria-label="Open preview info"
                title="Info"
              >
                <Info className={`w-4 h-4 ${mobile ? '' : 'mr-1.5'}`} />
                {!mobile && 'Info'}
              </Button>
              {shouldShowAddToGallery && (
                <Button size="sm" variant="secondary" className={`bg-black/70 hover:bg-black/80 text-white border border-white/10 ${mobile ? 'h-9 px-3 text-xs' : ''}`} onClick={() => void handleAddToGallery()} disabled={isSavingToGallery || isUpscaling || !!reuseAction}>
                  {isSavingToGallery ? 'Adding...' : 'Add to gallery'}
                </Button>
              )}
              <Button size="sm" variant="secondary" className={`bg-black/70 hover:bg-black/80 text-white border border-white/10 ${mobile ? 'h-9 px-3 text-xs' : ''}`} onClick={() => void handleUpscale()} disabled={isUpscaling || !!reuseAction || isSavingToGallery}>
                {isUpscaling ? 'Upscaling...' : 'Upscale'}
              </Button>
              <Button size="sm" variant="secondary" className={`bg-black/70 hover:bg-black/80 text-white border border-white/10 ${mobile ? 'h-9 px-3 text-xs' : ''}`} onClick={() => void handleReuse('txt2img')} disabled={isSavingToGallery || isUpscaling || !!reuseAction}>
                {reuseAction === 'txt2img' ? 'Opening...' : 'To txt2img'}
              </Button>
              <Button size="sm" variant="secondary" className={`bg-black/70 hover:bg-black/80 text-white border border-white/10 ${mobile ? 'h-9 px-3 text-xs' : ''}`} onClick={() => void handleReuse('img2img')} disabled={isSavingToGallery || isUpscaling || !!reuseAction}>
                {reuseAction === 'img2img' ? 'Opening...' : 'To img2img'}
              </Button>
              <Button size="sm" variant="secondary" className={`bg-black/70 hover:bg-black/80 text-white border border-white/10 ${mobile ? 'h-9 px-3 text-xs' : ''}`} onClick={() => void handleReuse('img2vid')} disabled={isSavingToGallery || isUpscaling || !!reuseAction}>
                {reuseAction === 'img2vid' ? 'Opening...' : 'To img2vid'}
              </Button>
            </div>
            <div className={`absolute left-3 right-3 px-3 py-2 bg-black/60 text-white text-xs rounded-md truncate pointer-events-none ${mobile ? 'bottom-24' : 'bottom-3'}`}>
              {hoverPreview
                ? (previewJob.modelId === 'gallery' ? 'Hovered gallery preview' : 'Hovered job preview')
                : rightPanelMode === 'gallery' && previewJob?.modelId === 'gallery'
                  ? 'Last gallery preview'
                  : 'Last job preview'}
              {previewJob.modelId ? ` · ${previewJob.modelId}` : ''}
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground select-none">
            <div className="w-24 h-24 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-accent/20">
              <span className="text-4xl opacity-50">🖼️</span>
            </div>
            <h3 className="text-xl font-medium mb-2 text-foreground">No successful image yet</h3>
            <p className="max-w-md mx-auto text-sm text-muted-foreground/80">
              Generate an image to show it here. Hover jobs or gallery items on the right panel to preview them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
