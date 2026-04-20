'use client';

import { useEffect, useState } from 'react';
import MobileAppShell from '@/components/mobile/MobileAppShell';
import MobileCreateHome from '@/components/mobile/create/MobileCreateHome';
import MobileCreateModeBar from '@/components/mobile/create/MobileCreateModeBar';
import MobileScreen from '@/components/mobile/MobileScreen';
import VideoGenerationForm from '@/components/forms/VideoGenerationForm';
import AudioGenerationForm from '@/components/forms/AudioGenerationForm';
import MusicGenerationForm from '@/components/forms/MusicGenerationForm';
import { getActiveMode, setActiveMode, type CreateMode } from '@/lib/createDrafts';

export default function MobileCreatePage() {
  const [activeMode, setActiveModeState] = useState<CreateMode>('image');

  useEffect(() => {
    setActiveModeState(getActiveMode());
  }, []);

  const handleModeChange = (mode: CreateMode) => {
    setActiveMode(mode);
    setActiveModeState(mode);
  };

  return (
    <MobileAppShell>
      {activeMode === 'image' ? (
        <MobileCreateHome activeMode={activeMode} onModeChange={handleModeChange} />
      ) : (
        <MobileScreen>
          <MobileCreateModeBar activeMode={activeMode} onModeChange={handleModeChange} />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
            {activeMode === 'video' ? <VideoGenerationForm /> : null}
            {activeMode === 'tts' ? <AudioGenerationForm /> : null}
            {activeMode === 'music' ? <MusicGenerationForm /> : null}
          </div>
        </MobileScreen>
      )}
    </MobileAppShell>
  );
}
