'use client';

import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';

export default function MobileScenesScreen() {
  return (
    <MobileScreen>
      <MobileHeader title="Scenes" subtitle="Scene selection moved to Prompt Constructor." backHref="/m/create" />
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 custom-scrollbar">
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          Saved scene selection and reuse now live in Prompt Constructor. Build or open a scene there, then send it into Create via the Prompt Constructor flow.
        </div>
      </div>
    </MobileScreen>
  );
}
