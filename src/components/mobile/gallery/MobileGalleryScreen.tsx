'use client';

import { useRouter } from 'next/navigation';
import { FolderOpen, Image as ImageIcon, Loader2, RefreshCw, Search, Video } from 'lucide-react';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useMobileGalleryScreen } from '@/hooks/gallery/useMobileGalleryScreen';
import { useMobilePreviewState } from '@/hooks/mobile/useMobilePreviewState';

export default function MobileGalleryScreen() {
  const router = useRouter();
  const { setPreview } = useMobilePreviewState();
  const { assets, isLoading, error, query, setQuery, refresh, buildPreview } = useMobileGalleryScreen();

  const openAsset = (asset: ReturnType<typeof useMobileGalleryScreen>['assets'][number]) => {
    setPreview(buildPreview(asset));
    router.push('/m/preview');
  };

  return (
    <MobileScreen>
      <MobileHeader
        title="Gallery"
        subtitle="Dedicated gallery route with direct open into mobile Preview."
        action={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 custom-scrollbar">
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tags or asset id..." className="pl-9" />
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading gallery...
            </div>
          ) : null}
          {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
          {!isLoading && !error && assets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              No gallery assets yet for the current workspace.
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            {assets.map((asset) => (
              <button key={asset.id} type="button" className="block text-left" onClick={() => openAsset(asset)}>
                <Card>
                  <CardContent className="space-y-3 p-3">
                    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-border bg-muted/20">
                      {asset.type === 'image' ? (
                        <img src={asset.thumbnailUrl || asset.previewUrl || asset.originalUrl} alt={asset.prompt || asset.id} className="h-full w-full object-cover" />
                      ) : asset.type === 'video' ? (
                        <video src={asset.previewUrl || asset.originalUrl} className="h-full w-full object-cover" muted playsInline />
                      ) : (
                        <FolderOpen className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {asset.type === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : asset.type === 'video' ? <Video className="h-3.5 w-3.5" /> : <FolderOpen className="h-3.5 w-3.5" />}
                        <span>{asset.type}</span>
                      </div>
                      <p className="line-clamp-3 text-xs text-muted-foreground">{asset.prompt || asset.id}</p>
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </div>
      </div>
    </MobileScreen>
  );
}
