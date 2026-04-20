import RightPanel from '@/components/layout/RightPanel';
import MobileAppShell from '@/components/mobile/MobileAppShell';

export default function MobileGalleryPage() {
  return (
    <MobileAppShell>
      <div className="flex h-full min-h-0 w-full">
        <RightPanel mobile mobileMode="gallery" />
      </div>
    </MobileAppShell>
  );
}
