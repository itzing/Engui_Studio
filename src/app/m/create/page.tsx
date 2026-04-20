import MobileAppShell from '@/components/mobile/MobileAppShell';
import MobileCreatePendingActions from '@/components/mobile/MobileCreatePendingActions';
import MobileCreateHome from '@/components/mobile/create/MobileCreateHome';

export default function MobileCreatePage() {
  return (
    <MobileAppShell>
      <MobileCreatePendingActions />
      <MobileCreateHome />
    </MobileAppShell>
  );
}
