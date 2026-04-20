'use client';

import Link from 'next/link';
import { Loader2, WandSparkles } from 'lucide-react';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Button } from '@/components/ui/button';
import { useImageCreateState } from '@/hooks/create/useImageCreateState';

export default function MobilePromptScreen() {
  const {
    prompt,
    setPrompt,
    promptHelperInstruction,
    setPromptHelperInstruction,
    isPromptHelperConfigured,
    promptHelperError,
    isPromptHelperLoading,
    runSavedPromptHelperInstruction,
  } = useImageCreateState();

  return (
    <MobileScreen>
      <MobileHeader
        title="Prompt"
        subtitle="Fullscreen editing for the keyboard-heavy part of create."
        backHref="/m/create"
        action={
          <Button size="sm" asChild>
            <Link href="/m/create">Done</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 custom-scrollbar">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prompt</label>
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

            <Button asChild>
              <Link href="/m/create">Save and return</Link>
            </Button>
          </div>
        </div>
      </div>
    </MobileScreen>
  );
}
