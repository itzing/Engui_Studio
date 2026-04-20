import LeftPanel from '@/components/layout/LeftPanel';
import MobileAppShell from '@/components/mobile/MobileAppShell';
import MobileCreatePendingActions from '@/components/mobile/MobileCreatePendingActions';

export default function MobileCreatePage() {
  return (
    <MobileAppShell>
      <MobileCreatePendingActions />
      <div className="flex h-full min-h-0 w-full">
        <LeftPanel mobile />
      </div>
    </MobileAppShell>
  );
}
