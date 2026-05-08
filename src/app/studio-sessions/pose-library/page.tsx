import FStudioPageClient from '@/components/studio-sessions/FStudioPageClient';
import { StudioProvider } from '@/lib/context/StudioContext';

export default function StudioPoseLibraryPage() {
  return (
    <StudioProvider>
      <FStudioPageClient route={{ level: 'poseLibrary' }} />
    </StudioProvider>
  );
}
