'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useStudio, Job } from '@/lib/context/StudioContext';
import { VideoEditorView } from '@/components/video-editor/VideoEditorView';

type CenterMode = 'image' | 'video';
type ImageViewMode = 'native' | 'fit';

type GalleryItem = {
  id: string;
  url: string;
  prompt?: string;
  modelId?: string;
  createdAt?: number;
};

type HoverPreview = {
  id: string;
  type: string;
  url?: string;
  prompt?: string;
  modelId?: string;
  status?: string;
  createdAt?: number;
} | null;

export default function CenterPanel() {
  const { activeArtifactId, activeTool, jobs } = useStudio();
  const [mode, setMode] = useState<CenterMode>('image');
  const [hoverPreview, setHoverPreview] = useState<HoverPreview>(null);
  const [imageViewMode, setImageViewMode] = useState<ImageViewMode>('native');
  const [selectedImageJobId, setSelectedImageJobId] = useState<string | null>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);

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
        setGalleryItems(prev => {
          const next = [...prev.filter(item => item.id !== detail.id), {
            id: detail.id,
            url: detail.url,
            prompt: detail.prompt,
            modelId: detail.modelId,
            createdAt: detail.createdAt,
          }];
          return next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        });
      }
    };

    window.addEventListener('jobHoverPreview', handler as EventListener);
    return () => window.removeEventListener('jobHoverPreview', handler as EventListener);
  }, []);

  useEffect(() => {
    const fromJobs: GalleryItem[] = [...jobs]
      .filter((job: Job) => job.status === 'completed' && !!job.resultUrl && job.type === 'image')
      .map(job => ({
        id: job.id,
        url: job.resultUrl as string,
        prompt: job.prompt,
        modelId: job.modelId,
        createdAt: job.createdAt,
      }));

    if (fromJobs.length === 0) return;

    setGalleryItems(prev => {
      const map = new Map<string, GalleryItem>();
      for (const item of prev) map.set(item.id, item);
      for (const item of fromJobs) map.set(item.id, item);
      return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    });
  }, [jobs]);

  const completedImageJobs = useMemo(() => galleryItems, [galleryItems]);

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
      if (completedImageJobs.length === 0) return;

      const baseId = (hoverPreview && hoverPreview.id) ? hoverPreview.id : (selectedImageJobId || completedImageJobs[0].id);
      const currentIndex = completedImageJobs.findIndex(job => job.id === baseId);
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;

      // ArrowRight -> older (next index), ArrowLeft -> newer (prev index)
      const nextIndex = event.key === 'ArrowRight'
        ? (safeIndex + 1) % completedImageJobs.length
        : (safeIndex - 1 + completedImageJobs.length) % completedImageJobs.length;

      setHoverPreview(null);
      setSelectedImageJobId(completedImageJobs[nextIndex].id);
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, hoverPreview, selectedImageJobId, completedImageJobs]);

  const selectedImageJob = useMemo(() => {
    if (!selectedImageJobId) return latestSuccessfulJob;
    return completedImageJobs.find(job => job.id === selectedImageJobId) || latestSuccessfulJob;
  }, [selectedImageJobId, completedImageJobs, latestSuccessfulJob]);

  const previewJob = useMemo(() => {
    if (hoverPreview && hoverPreview.status === 'completed' && hoverPreview.url && hoverPreview.type === 'image') {
      return hoverPreview;
    }
    return selectedImageJob;
  }, [hoverPreview, selectedImageJob]);

  if (mode === 'video') {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm">
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
    <div className="flex-1 bg-background/50 flex flex-col relative overflow-hidden">
      <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm z-10">
        <h2 className="font-semibold text-sm">Workspace</h2>
        <div className="flex items-center gap-2">
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

      <div className="flex-1 min-h-0 overflow-hidden bg-black/30">
        {previewJob && previewJob.url ? (
          <div className="relative w-full h-full">
            <div className={`absolute inset-0 p-2 ${imageViewMode === 'fit' ? 'overflow-hidden flex items-center justify-center' : 'overflow-auto'}`}>
              <img
                src={previewJob.url}
                alt={previewJob.prompt || 'Preview'}
                className={imageViewMode === 'fit'
                  ? 'max-w-full max-h-full object-contain rounded-md border border-border/40 shadow-2xl'
                  : 'block max-w-none max-h-none rounded-md border border-border/40 shadow-2xl'}
                draggable={false}
              />
            </div>
            <div className="absolute bottom-3 left-3 right-3 px-3 py-2 bg-black/60 text-white text-xs rounded-md truncate pointer-events-none">
              {hoverPreview ? (previewJob.modelId === 'gallery' ? 'Hovered gallery preview' : 'Hovered job preview') : 'Latest successful image'}
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
