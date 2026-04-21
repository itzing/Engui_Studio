'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ImagePlus, Loader2, Sparkles, WandSparkles } from 'lucide-react';
import MobileScreen from '@/components/mobile/MobileScreen';
import MobileCreateModeBar from '@/components/mobile/create/MobileCreateModeBar';
import type { CreateMode } from '@/lib/createDrafts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const {
    currentModel,
    promptSummary,
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
              </div>
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

      <div className="z-20 shrink-0 border-t border-border bg-background/95 px-4 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            disabled={isGenerating || isLoadingMedia}
            onClick={async () => {
              await submit();
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
