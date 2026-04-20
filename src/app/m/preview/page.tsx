import CenterPanel from '@/components/layout/CenterPanel';
import MobileAppShell from '@/components/mobile/MobileAppShell';

export default function MobilePreviewPage() {
  return (
    <MobileAppShell>
      <div className="flex h-full min-h-0 w-full">
        <CenterPanel mobile />
      </div>
    </MobileAppShell>
  );
}
