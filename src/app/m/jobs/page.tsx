import RightPanel from '@/components/layout/RightPanel';
import MobileAppShell from '@/components/mobile/MobileAppShell';

export default function MobileJobsPage() {
  return (
    <MobileAppShell>
      <div className="flex h-full min-h-0 w-full">
        <RightPanel mobile mobileMode="jobs" />
      </div>
    </MobileAppShell>
  );
}
