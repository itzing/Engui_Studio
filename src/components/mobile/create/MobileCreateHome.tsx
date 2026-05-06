'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ImagePlus, Loader2, Sparkles, WandSparkles } from 'lucide-react';
import MobileScreen from '@/components/mobile/MobileScreen';
import MobileCreateModeBar from '@/components/mobile/create/MobileCreateModeBar';
import type { CreateMode } from '@/lib/createDrafts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useMobileCreate } from '@/components/mobile/create/MobileCreateProvider';

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
  const { showToast } = useToast();
  const [showPromptDraftSelector, setShowPromptDraftSelector] = useState(false);
  const {
    currentModel,
    prompt,
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
    randomizeSeed,
    setRandomizeSeed,
    handleParameterChange,
    controlNetEnabled,
    supportsControlNet,
    parameterValues,
    promptDocuments,
    isPromptDocumentsLoading,
    isPromptDraftSyncing,
    selectedPromptDocumentId,
    selectedPromptDocumentTitle,
    isPromptDraftSelected,
    selectPromptDocument,
    clearPromptDocument,
    isGenerating,
    submit,
    message,
    setMessage,
    isLoadingMedia,
  } = useMobileCreate();

  const currentSeed = parameterValues.seed ?? currentModel?.parameters.find((param) => param.name === 'seed')?.default;
  const widthParameter = currentModel?.parameters.find((param) => param.name === 'width');
  const heightParameter = currentModel?.parameters.find((param) => param.name === 'height');
  const currentWidth = widthParameter ? Number(parameterValues[widthParameter.name] ?? widthParameter.default) : undefined;
  const currentHeight = heightParameter ? Number(parameterValues[heightParameter.name] ?? heightParameter.default) : undefined;
  const formatLabel = Number.isFinite(currentWidth) && Number.isFinite(currentHeight)
    ? currentWidth === currentHeight
      ? 'Square'
      : currentWidth > currentHeight
        ? 'Landscape'
        : 'Portrait'
    : 'Resolution';
  const resolutionLabel = Number.isFinite(currentWidth) && Number.isFinite(currentHeight)
    ? `${currentWidth}w × ${currentHeight}h`
    : '—';
  const promptPreview = prompt.trim() ? prompt.trim().replace(/\s+/g, ' ') : 'empty';

  useEffect(() => {
    if (message?.type === 'success') {
      showToast(message.text, 'success', 2200);
      setMessage(null);
    }
  }, [message, setMessage, showToast]);

  return (
    <MobileScreen>
      <MobileCreateModeBar activeMode={activeMode} onModeChange={onModeChange} />

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 custom-scrollbar">
        <div className="space-y-4 pb-0.5">
          {message?.type === 'error' ? <StatusMessage type={message.type} text={message.text} /> : null}

          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" asChild className="min-w-0 h-auto justify-start overflow-hidden px-3 py-3">
                  <Link href="/m/create/model" className="block truncate text-left text-base font-semibold">
                    {currentModel?.name || 'Loading model...'}
                  </Link>
                </Button>

                <Button
                  variant={randomizeSeed ? 'default' : 'outline'}
                  size="sm"
                  className="h-auto flex-col items-start px-3 py-3 text-left"
                  onClick={() => setRandomizeSeed(!randomizeSeed)}
                >
                  <span className="text-base font-semibold leading-none">{randomizeSeed ? 'Random' : 'Fixed'}</span>
                  <span className={`mt-1 text-xs leading-none ${randomizeSeed ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    {currentSeed ?? '—'}
                  </span>
                </Button>

                <button
                  type="button"
                  className="rounded-md border border-border bg-background/40 px-3 py-3 text-left transition-colors hover:bg-accent/40"
                  onClick={() => {
                    if (!widthParameter || !heightParameter || !Number.isFinite(currentWidth) || !Number.isFinite(currentHeight)) {
                      return;
                    }
                    handleParameterChange(widthParameter.name, currentHeight);
                    handleParameterChange(heightParameter.name, currentWidth);
                  }}
                >
                  <div className="text-base font-semibold leading-none text-foreground">{formatLabel}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{resolutionLabel}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground/80">Tap to switch</div>
                </button>

                {supportsControlNet ? (
                  <div className={`rounded-md border px-3 py-3 ${controlNetEnabled ? 'border-primary/30 bg-primary/10' : 'border-border bg-background/40'}`}>
                    <div className="text-base font-semibold leading-none text-foreground">ControlNet</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {controlNetEnabled ? 'Enabled from image input' : 'Disabled, no image selected'}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  className={`col-span-2 rounded-md border px-3 py-3 text-left transition-colors ${isPromptDraftSelected ? 'border-primary/30 bg-primary/10' : 'border-border bg-background/40 hover:bg-accent/40'}`}
                  onClick={() => setShowPromptDraftSelector(true)}
                  data-testid="mobile-prompt-draft-tile"
                >
                  <div className="text-base font-semibold leading-none text-foreground">Prompt draft</div>
                  <div className="mt-1 truncate text-sm text-muted-foreground" data-testid="mobile-prompt-draft-title">
                    {selectedPromptDocumentTitle.trim() || 'Not selected'}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground/80">
                    {isPromptDraftSyncing ? 'Syncing draft...' : isPromptDraftSelected ? 'Tap to change' : 'Tap to choose'}
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          {!isPromptDraftSelected ? (
            <Link href="/m/create/prompt" className="block" aria-label="Open prompt editor">
              <Card className="transition-colors hover:bg-accent/40">
                <CardContent className="pt-6">
                  <p className="truncate text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Prompt:</span>{' '}
                    {promptPreview}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}

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
        </div>
      </div>

      <Dialog open={showPromptDraftSelector} onOpenChange={setShowPromptDraftSelector}>
        <DialogContent className="max-h-[80dvh] w-[calc(100vw-2rem)] max-w-lg overflow-hidden p-0">
          <DialogHeader className="border-b px-4 py-4">
            <DialogTitle>Select Prompt Draft</DialogTitle>
            <DialogDescription>Choose a saved Prompt Constructor draft or keep using a manual prompt.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65dvh] overflow-y-auto px-4 py-4">
            <div className="space-y-2">
              {isPromptDocumentsLoading ? (
                <div className="rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">Loading prompt drafts...</div>
              ) : (
                <>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left ${!isPromptDraftSelected ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-background/40 hover:border-primary/40 hover:bg-primary/5'}`}
                    onClick={() => {
                      clearPromptDocument();
                      setShowPromptDraftSelector(false);
                    }}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="truncate text-sm font-medium text-foreground">Manual prompt</div>
                      <div className="mt-1 text-xs text-muted-foreground">No Prompt Constructor draft selected</div>
                    </div>
                    {!isPromptDraftSelected ? <WandSparkles className="h-4 w-4 shrink-0 text-primary" /> : null}
                  </button>

                  {promptDocuments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                      No saved Prompt Constructor drafts yet.
                    </div>
                  ) : (
                    promptDocuments.map((document) => {
                      const isSelected = isPromptDraftSelected && selectedPromptDocumentId === document.id;
                      return (
                        <button
                          key={document.id}
                          type="button"
                          className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left ${isSelected ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-background/40 hover:border-primary/40 hover:bg-primary/5'}`}
                          onClick={() => {
                            selectPromptDocument(document.id);
                            setShowPromptDraftSelector(false);
                          }}
                        >
                          <div className="min-w-0 pr-3">
                            <div className="truncate text-sm font-medium text-foreground">{document.title}</div>
                            <div className="mt-1 truncate text-xs text-muted-foreground">{document.sceneType || document.templateId}</div>
                          </div>
                          {isSelected ? <WandSparkles className="h-4 w-4 shrink-0 text-primary" /> : null}
                        </button>
                      );
                    })
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="z-20 shrink-0 border-t border-border bg-background/95 px-4 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            disabled={isGenerating || isLoadingMedia || isPromptDraftSyncing}
            onClick={async () => {
              await submit();
            }}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting generation...
              </>
            ) : isPromptDraftSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing draft...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>
      </div>
    </MobileScreen>
  );
}
