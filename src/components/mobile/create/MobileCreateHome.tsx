'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, Sparkles, WandSparkles } from 'lucide-react';
import MobileScreen from '@/components/mobile/MobileScreen';
import MobileCreateModeBar from '@/components/mobile/create/MobileCreateModeBar';
import type { CreateMode } from '@/lib/createDrafts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useImageCreateState } from '@/hooks/create/useImageCreateState';

function StatusMessage({ type, text }: { type: 'success' | 'error'; text: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
      {text}
    </div>
  );
}

export default function MobileCreateHome({
  activeMode,
  onModeChange,
}: {
  activeMode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
}) {
  const router = useRouter();
  const {
    currentModel,
    promptSummary,
    selectedScene,
    previewUrl,
    previewUrl2,
    primaryImageVisible,
    secondaryImageVisible,
    primaryImageRequired,
    secondaryImageRequired,
    selectPrimaryImageFile,
    selectSecondaryImageFile,
    clearPrimaryImage,
    clearSecondaryImage,
    basicSummaryItems,
    isGenerating,
    submit,
    message,
    isLoadingMedia,
  } = useImageCreateState();

  return (
    <MobileScreen>
      <MobileCreateModeBar activeMode={activeMode} onModeChange={onModeChange} />

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 custom-scrollbar">
        <div className="space-y-4 pb-4">
          {message ? <StatusMessage type={message.type} text={message.text} /> : null}

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Current model</CardDescription>
              <CardTitle className="text-lg">{currentModel?.name || 'Loading model...'}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3 pt-0">
              <div className="text-xs text-muted-foreground">{currentModel?.provider || 'Image generation model'}</div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/m/create/model">Change</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Prompt</CardDescription>
              <CardTitle className="text-lg">Prompt editor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{promptSummary}</p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/m/create/prompt">Edit prompt</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Scene</CardDescription>
              <CardTitle className="text-lg">{selectedScene?.name || 'No scene selected'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <p className="line-clamp-3 text-sm text-muted-foreground">
                {selectedScene?.generatedScenePrompt || 'Pick a saved scene to apply its prompt and preview image.'}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/m/create/scenes">Browse scenes</Link>
              </Button>
            </CardContent>
          </Card>

          {(primaryImageVisible || secondaryImageVisible) && (
            <div className="grid gap-4">
              {primaryImageVisible && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>{primaryImageRequired ? 'Required input image' : 'Optional input image'}</CardDescription>
                    <CardTitle className="text-lg">Primary image</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Primary input preview" className="h-40 w-full rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
                        No image selected yet
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              selectPrimaryImageFile(file);
                            }
                            event.currentTarget.value = '';
                          }}
                        />
                        <span className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                          <ImagePlus className="mr-2 h-4 w-4" />
                          Choose image
                        </span>
                      </label>
                      {previewUrl && (
                        <Button variant="ghost" size="sm" onClick={clearPrimaryImage}>Clear</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {secondaryImageVisible && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>{secondaryImageRequired ? 'Required second image' : 'Optional second image'}</CardDescription>
                    <CardTitle className="text-lg">Second image</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {previewUrl2 ? (
                      <img src={previewUrl2} alt="Secondary input preview" className="h-40 w-full rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
                        No second image selected yet
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              selectSecondaryImageFile(file);
                            }
                            event.currentTarget.value = '';
                          }}
                        />
                        <span className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                          <ImagePlus className="mr-2 h-4 w-4" />
                          Choose image
                        </span>
                      </label>
                      {previewUrl2 && (
                        <Button variant="ghost" size="sm" onClick={clearSecondaryImage}>Clear</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Key parameters</CardDescription>
              <CardTitle className="text-lg">Quick summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {basicSummaryItems.length > 0 ? (
                basicSummaryItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-right font-medium text-foreground">{item.value}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  No key parameters configured for this model yet.
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      <div className="z-20 shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            disabled={isGenerating || isLoadingMedia}
            onClick={async () => {
              const success = await submit();
              if (success) {
                router.push('/m/jobs');
              }
            }}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting generation...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>

          <Button variant="outline" className="w-full" asChild>
            <Link href="/m/create/prompt">
              <WandSparkles className="mr-2 h-4 w-4" />
              Open focused prompt editor
            </Link>
          </Button>
        </div>
      </div>
    </MobileScreen>
  );
}
