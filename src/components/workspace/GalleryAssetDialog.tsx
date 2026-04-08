'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Trash2 } from 'lucide-react';

export type GalleryAssetDialogAsset = {
  id: string;
  workspaceId: string;
  type: 'image' | 'video' | 'audio';
  originalUrl: string;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  favorited: boolean;
  trashed: boolean;
  userTags?: string[];
  sourceJobId?: string | null;
  sourceOutputId?: string | null;
  addedToGalleryAt: string;
};

interface GalleryAssetDialogProps {
  asset: GalleryAssetDialogAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleFavorite: () => void;
  onTrash: () => void;
  onSaveTags: (tags: string[]) => Promise<void> | void;
  onTagClick: (tag: string) => void;
}

export function GalleryAssetDialog({ asset, open, onOpenChange, onToggleFavorite, onTrash, onSaveTags, onTagClick }: GalleryAssetDialogProps) {
  const safeOpen = open && !!asset;
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    setTagsInput((asset?.userTags || []).join(', '));
  }, [asset?.id, asset?.userTags]);

  const handleDownload = async () => {
    if (!asset) return;
    try {
      const response = await fetch(asset.originalUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gallery-${asset.id}.${asset.type === 'video' ? 'mp4' : asset.type === 'audio' ? 'mp3' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      window.open(asset.originalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Dialog open={safeOpen} onOpenChange={onOpenChange}>
      {asset && (
        <DialogContent className="max-w-4xl w-[90vw] h-[85vh] p-0 gap-0 bg-background border-border overflow-hidden flex flex-col md:flex-row">
          <div className="flex-1 bg-black/90 flex items-center justify-center relative min-h-[300px] md:h-full overflow-hidden p-4">
            {asset.type === 'video' ? (
              <video src={asset.previewUrl || asset.originalUrl} controls className="max-w-full max-h-full object-contain" />
            ) : asset.type === 'audio' ? (
              <div className="flex flex-col items-center justify-center w-full max-w-md gap-6 p-8 bg-zinc-900/50 rounded-xl border border-white/10 backdrop-blur-sm">
                <div className="text-orange-400 text-sm font-medium">Audio Asset</div>
                <audio src={asset.originalUrl} controls className="w-full" />
              </div>
            ) : (
              <img src={asset.previewUrl || asset.originalUrl} alt="Gallery asset" className="max-w-full max-h-full object-contain" />
            )}
          </div>

          <div className="w-full md:w-[350px] flex flex-col border-t md:border-t-0 md:border-l border-border bg-card">
            <DialogHeader className="p-4 border-b border-border">
              <DialogTitle className="text-lg font-semibold">Gallery Asset</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-mono flex flex-col gap-1">
                <span className="truncate">ID: {asset.id}</span>
                <span>Type: {asset.type}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Source Job</span>
                  <div className="text-sm font-medium break-all">{asset.sourceJobId || '—'}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Source Output</span>
                  <div className="text-sm font-medium">{asset.sourceOutputId || '—'}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Added to Gallery</span>
                  <div className="text-sm font-medium">{new Date(asset.addedToGalleryAt).toLocaleString()}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                    {asset.favorited && <span className="text-[11px] px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20">Favorited</span>}
                    {!asset.trashed ? <span className="text-[11px] px-2 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20">Active</span> : <span className="text-[11px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">Trashed</span>}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Tags</span>
                  <input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="portrait, favorites, client-a"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-1">
                    {(asset.userTags || []).map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => onTagClick(tag)}
                        className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSaveTags(tagsInput.split(',').map(tag => tag.trim()).filter(Boolean))}
                  >
                    Save Tags
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-muted/10 flex gap-2">
              <Button className="flex-1" variant="outline" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button className="flex-1" variant="default" onClick={onToggleFavorite}>
                {asset.favorited ? 'Unfavorite' : 'Favorite'}
              </Button>
              <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={onTrash} title={asset.trashed ? 'Restore' : 'Move to trash'}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
