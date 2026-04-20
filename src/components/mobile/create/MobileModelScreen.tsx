'use client';

import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Card, CardContent } from '@/components/ui/card';
import { useImageCreateState } from '@/hooks/create/useImageCreateState';
import { PENDING_MOBILE_IMAGE_MODEL_KEY } from '@/hooks/create/useImageCreateDraftPersistence';

export default function MobileModelScreen() {
  const router = useRouter();
  const { imageModels, selectedModel, selectModel } = useImageCreateState();

  return (
    <MobileScreen>
      <MobileHeader title="Model" subtitle="Choose the image model for the current draft." backHref="/m/create" />
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 custom-scrollbar">
        <div className="space-y-3">
          {imageModels.map((model) => {
            const active = model.id === selectedModel;
            return (
              <button
                key={model.id}
                type="button"
                className="block w-full text-left"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    try {
                      window.localStorage.setItem(PENDING_MOBILE_IMAGE_MODEL_KEY, model.id);
                    } catch {
                      // ignore storage errors
                    }
                  }
                  selectModel(model.id);
                  router.push('/m/create');
                }}
              >
                <Card className={active ? 'border-primary/50 bg-primary/10' : ''}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{model.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{model.provider}</div>
                    </div>
                    {active ? <Check className="h-5 w-5 text-primary" /> : null}
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      </div>
    </MobileScreen>
  );
}
