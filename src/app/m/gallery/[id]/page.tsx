import MobileAppShell from '@/components/mobile/MobileAppShell';
import MobileGalleryDetailsScreen from '@/components/mobile/gallery/MobileGalleryDetailsScreen';

export default async function MobileGalleryDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <MobileAppShell>
      <MobileGalleryDetailsScreen assetId={id} />
    </MobileAppShell>
  );
}
