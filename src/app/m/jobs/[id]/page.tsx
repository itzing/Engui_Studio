import MobileAppShell from '@/components/mobile/MobileAppShell';
import MobileJobDetailsScreen from '@/components/mobile/jobs/MobileJobDetailsScreen';

export default async function MobileJobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <MobileAppShell>
      <MobileJobDetailsScreen jobId={id} />
    </MobileAppShell>
  );
}
