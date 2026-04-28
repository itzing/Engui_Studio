'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clapperboard, Download, Heart, Loader2, RefreshCw, Sparkles, Trash2, Type } from 'lucide-react';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMobileGalleryDetails } from '@/hooks/gallery/useMobileGalleryDetails';
import { persistCreateReuseDraft } from '@/lib/create/persistCreateReuseDraft';
import { persistPromptConstructorReuseDraft } from '@/lib/prompt-constructor/persistPromptConstructorReuseDraft';

export default function MobileGalleryDetailsScreen({ assetId }: { assetId: string }) {
  const router = useRouter();
  const { asset, isLoading, error, refresh, setAsset } = useMobileGalleryDetails(assetId);
  const [tagsInput, setTagsInput] = useState('');
  const [isUpscaling, setIsUpscaling] = useState(false);

  useEffect(() => {
    setTagsInput(asset?.userTags.join(', ') || '');
  }, [asset?.id, asset?.userTags]);

  const mediaUrl = useMemo(() => asset?.previewUrl || asset?.originalUrl || '', [asset]);

  const downloadAsset = async () => {
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

  const toggleFavorite = async () => {
    if (!asset) return;
    const nextFavorited = !asset.favorited;
    const response = await fetch(`/api/gallery/assets/${asset.id}/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorited: nextFavorited }),
    });
    const data = await response.json();
    if (response.ok && data.success) {
      setAsset((prev) => prev ? { ...prev, favorited: nextFavorited } : prev);
    }
  };

  const toggleTrash = async () => {
    if (!asset) return;
    const nextTrashed = !asset.trashed;
    const response = await fetch(`/api/gallery/assets/${asset.id}/trash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: nextTrashed }),
    });
    const data = await response.json();
    if (response.ok && data.success) {
      setAsset((prev) => prev ? { ...prev, trashed: nextTrashed } : prev);
      if (nextTrashed) router.push('/m/gallery');
    }
  };

  const saveTags = async () => {
    if (!asset) return;
    const tags = tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean);
    const response = await fetch(`/api/gallery/assets/${asset.id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userTags: tags, autoTags: asset.autoTags }),
    });
    const data = await response.json();
    if (response.ok && data.success) {
      setAsset((prev) => prev ? { ...prev, userTags: data.userTags || tags } : prev);
    }
  };

  const upscale = async () => {
    if (!asset || isUpscaling) return;
    if (asset.type !== 'image' && asset.type !== 'video') return;

    setIsUpscaling(true);
    try {
      const response = await fetch('/api/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryAssetId: asset.id, type: asset.type }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.job) {
        throw new Error(data.error || 'Failed to create upscale job');
      }
      router.push('/m/jobs');
    } catch (error) {
      console.error('Failed to create mobile gallery upscale job:', error);
    } finally {
      setIsUpscaling(false);
    }
  };

  const reuse = async (action: 'txt2img' | 'img2img' | 'img2vid' | 'scene-template-v2') => {
    if (!asset) return;
    const response = await fetch(`/api/gallery/assets/${asset.id}/reuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await response.json();
    if (response.ok && data.success && data.payload) {
      if (action === 'scene-template-v2') {
        persistPromptConstructorReuseDraft(data.payload);
        router.push('/prompt-constructor');
        return;
      }
      persistCreateReuseDraft(data.payload);
      router.push('/m/create');
    }
  };

  return (
    <MobileScreen>
      <MobileHeader
        title="Gallery details"
        subtitle={asset ? `${asset.type} asset` : 'Standalone mobile route for gallery asset details.'}
        backHref="/m/gallery"
        action={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 custom-scrollbar">
        <div className="space-y-4">
          {isLoading ? <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading asset...</div> : null}
          {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
          {!isLoading && !error && !asset ? <div className="rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">Gallery asset not found.</div> : null}

          {asset ? (
            <>
              <Card>
                <CardContent className="p-3">
                  <div className="flex min-h-[18rem] items-center justify-center overflow-hidden rounded-lg border border-border bg-black/30">
                    {asset.type === 'video' ? (
                      <video src={mediaUrl} controls playsInline className="max-h-[70vh] w-full object-contain" />
                    ) : asset.type === 'audio' ? (
                      <audio src={asset.originalUrl} controls className="w-full" />
                    ) : (
                      <img src={mediaUrl} alt={asset.prompt || asset.id} className="max-h-[70vh] w-full object-contain" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Details</CardDescription>
                  <CardTitle className="text-lg">{asset.modelId || asset.id}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><div className="text-muted-foreground">Type</div><div>{asset.type}</div></div>
                    <div><div className="text-muted-foreground">Status</div><div>{asset.trashed ? 'Trashed' : asset.favorited ? 'Favorited' : 'Active'}</div></div>
                    <div><div className="text-muted-foreground">Added</div><div>{new Date(asset.addedToGalleryAt).toLocaleString()}</div></div>
                    <div><div className="text-muted-foreground">Source job</div><div>{asset.sourceJobId || '—'}</div></div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Prompt</div>
                    <div className="whitespace-pre-wrap">{asset.prompt || 'No prompt saved.'}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-muted-foreground">Tags</div>
                    <Input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="portrait, favorites, client-a" className="text-base sm:text-sm" />
                    <Button variant="outline" onClick={() => void saveTags()}>Save tags</Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button variant="outline" onClick={() => void downloadAsset()}><Download className="mr-2 h-4 w-4" />Download</Button>
                <Button variant="outline" onClick={() => void toggleFavorite()}><Heart className="mr-2 h-4 w-4" />{asset.favorited ? 'Unfavorite' : 'Favorite'}</Button>
                {(asset as any).hasSceneSnapshot ? <Button variant="outline" onClick={() => void reuse('scene-template-v2')}><Sparkles className="mr-2 h-4 w-4" />Reuse scene</Button> : null}
                {asset.type === 'image' ? <Button variant="outline" onClick={() => void reuse('txt2img')}><Type className="mr-2 h-4 w-4" />To txt2img</Button> : null}
                {asset.type === 'image' ? <Button onClick={() => void reuse('img2img')}><Sparkles className="mr-2 h-4 w-4" />To img2img</Button> : null}
                {asset.type === 'image' ? <Button variant="outline" onClick={() => void reuse('img2vid')}><Clapperboard className="mr-2 h-4 w-4" />To img2vid</Button> : null}
                {(asset.type === 'image' || asset.type === 'video') ? <Button variant="outline" onClick={() => void upscale()} disabled={isUpscaling}><Sparkles className="mr-2 h-4 w-4" />{isUpscaling ? 'Starting...' : 'Upscale'}</Button> : null}
                <Button variant="destructive" onClick={() => void toggleTrash()}><Trash2 className="mr-2 h-4 w-4" />{asset.trashed ? 'Restore' : 'Move to trash'}</Button>
                {asset.sourceJobId ? <Button variant="ghost" asChild><Link href={`/m/jobs/${asset.sourceJobId}`}>Open source job</Link></Button> : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </MobileScreen>
  );
}
