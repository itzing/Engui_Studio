'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, WandSparkles, X } from 'lucide-react';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Button } from '@/components/ui/button';
import { useMobileCreate } from '@/components/mobile/create/MobileCreateProvider';

export default function MobilePromptScreen() {
  const router = useRouter();
  const {
    prompt,
    setPrompt,
    promptHelperInstruction,
    setPromptHelperInstruction,
    isPromptHelperConfigured,
    promptHelperError,
    isPromptHelperLoading,
    isPromptDraftSelected,
    selectedPromptDocumentTitle,
    runSavedPromptHelperInstruction,
  } = useMobileCreate();
  const initialPromptRef = useRef(prompt);
  const initialPromptHelperInstructionRef = useRef(promptHelperInstruction);

  useEffect(() => {
    initialPromptRef.current = prompt;
    initialPromptHelperInstructionRef.current = promptHelperInstruction;
  }, []);

  const navigateBackToCreate = useCallback(() => {
    if (typeof document !== 'undefined') {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        activeElement.blur();
      }
    }

    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        router.push('/m/create');
      });
    }, 40);
  }, [router]);

  const handleCancel = () => {
    setPrompt(initialPromptRef.current);
    setPromptHelperInstruction(initialPromptHelperInstructionRef.current);
    navigateBackToCreate();
  };

  const handleSave = () => {
    navigateBackToCreate();
  };

  return (
    <MobileScreen>
      <MobileHeader
        title="Prompt"
        subtitle={isPromptDraftSelected ? 'This prompt is driven by a Prompt Constructor draft.' : 'Fullscreen editing for the keyboard-heavy part of create.'}
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 custom-scrollbar">
        {isPromptDraftSelected ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-4 text-sm text-foreground">
              <div className="text-xs font-medium uppercase tracking-wide text-primary/80">Selected prompt draft</div>
              <div className="mt-2 text-base font-semibold">{selectedPromptDocumentTitle || 'Prompt Constructor draft'}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Manual prompt editing is hidden while a draft is selected. Change or clear the draft from the main mobile create screen.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prompt</label>
                {prompt.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full text-muted-foreground"
                    onClick={() => setPrompt('')}
                    aria-label="Clear prompt"
                    title="Clear prompt"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the image you want to generate..."
                className="min-h-[42vh] w-full rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saved Prompt Helper instruction</label>
              <textarea
                value={promptHelperInstruction}
                onChange={(event) => setPromptHelperInstruction(event.target.value)}
                placeholder="Optional reusable helper instruction, for example: make the prompt cinematic but keep the subject details unchanged."
                className="min-h-[18vh] w-full rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
              />
            </div>

            {promptHelperError ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {promptHelperError}
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                disabled={!isPromptHelperConfigured || !promptHelperInstruction.trim() || isPromptHelperLoading}
                onClick={() => void runSavedPromptHelperInstruction()}
              >
                {isPromptHelperLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Improving prompt...
                  </>
                ) : (
                  <>
                    <WandSparkles className="mr-2 h-4 w-4" />
                    Apply saved Prompt Helper instruction
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="z-20 shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        {isPromptDraftSelected ? (
          <Button size="lg" className="w-full" onClick={navigateBackToCreate}>Back</Button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" onClick={handleCancel}>Cancel</Button>
            <Button size="lg" onClick={handleSave}>Save</Button>
          </div>
        )}
      </div>
    </MobileScreen>
  );
}
