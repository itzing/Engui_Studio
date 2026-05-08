import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default function StudioPoseLibraryAllPage() {
  return (
    <StudioProvider>
      <FStudioPageClient route={{ level: 'poseLibrary', view: 'all' }} />
    </StudioProvider>
  );
}
