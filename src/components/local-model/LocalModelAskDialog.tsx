'use client';

import React, { useState } from 'react';
import { Check, Clipboard, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface LocalModelAskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function LocalModelAskDialog({ open, onOpenChange }: LocalModelAskDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const canSubmit = prompt.trim().length > 0 && !isLoading;

  async function submitRequest() {
    const requestText = prompt.trim();
    if (!requestText || isLoading) {
      return;
    }

    setError(null);
    setAnswer('');
    setHasCopied(false);
    setIsLoading(true);

    try {
      const response = await fetch('/api/local-model/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: requestText }),
      });
      const text = await response.text();

      if (!response.ok) {
        throw new Error(text || 'Local model request failed');
      }

      setAnswer(text);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Local model request failed');
    } finally {
      setIsLoading(false);
    }
  }

  async function copyAnswer() {
    if (!answer) {
      return;
    }

    await navigator.clipboard.writeText(answer);
    setHasCopied(true);
    window.setTimeout(() => setHasCopied(false), 1200);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[86vh] max-w-3xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4 pr-14 text-left">
          <DialogTitle>Ask Local Model</DialogTitle>
          <DialogDescription>Send one request to the configured local text model.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Request</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault();
                  void submitRequest();
                }
              }}
              className="min-h-40 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Ask anything..."
              disabled={isLoading}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" onClick={() => void submitRequest()} disabled={!canSubmit}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {isLoading ? 'Sending...' : 'Send'}
            </Button>
            <Button type="button" variant="outline" onClick={() => void copyAnswer()} disabled={!answer || isLoading}>
              {hasCopied ? <Check className="mr-2 h-4 w-4" /> : <Clipboard className="mr-2 h-4 w-4" />}
              {hasCopied ? 'Copied' : 'Copy answer'}
            </Button>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <section className="min-h-48 rounded-md border border-border bg-muted/20">
            <div className="border-b border-border px-3 py-2 text-sm font-medium text-muted-foreground">Answer</div>
            <div className="min-h-40 whitespace-pre-wrap break-words px-3 py-3 text-sm leading-6 text-foreground">
              {answer || (isLoading ? 'Waiting for the model...' : 'The response will appear here.')}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

