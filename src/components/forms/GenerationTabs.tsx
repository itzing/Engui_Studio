'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
    PhotoIcon,
    VideoCameraIcon,
    MicrophoneIcon,
    MusicalNoteIcon
} from '@heroicons/react/24/outline';
import { useI18n } from '@/lib/i18n/context';

export type GenerationMode = 'image' | 'video' | 'tts' | 'music';

interface GenerationTabsProps {
    activeMode: GenerationMode;
    onModeChange: (mode: GenerationMode) => void;
    mobile?: boolean;
}

export default function GenerationTabs({ activeMode, onModeChange, mobile = false }: GenerationTabsProps) {
    const { t } = useI18n();
    
    const tabs: { id: GenerationMode; labelKey: string; icon: React.ElementType }[] = [
        { id: 'image', labelKey: 'generationForm.tabs.image', icon: PhotoIcon },
        { id: 'video', labelKey: 'generationForm.tabs.video', icon: VideoCameraIcon },
        { id: 'tts', labelKey: 'generationForm.tabs.voiceover', icon: MicrophoneIcon },
        { id: 'music', labelKey: 'generationForm.tabs.music', icon: MusicalNoteIcon },
    ];

    return (
        <div className={`grid grid-cols-4 gap-1 p-1 bg-muted/20 rounded-lg mb-4 ${mobile ? 'sticky top-0 z-10 backdrop-blur-sm bg-background/95' : ''}`}>
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onModeChange(tab.id)}
                    className={`flex flex-col items-center justify-center rounded-md font-medium transition-all duration-200 ${mobile ? 'py-3 px-1 text-[11px]' : 'py-2 px-1 text-xs'} ${activeMode === tab.id
                            ? 'bg-muted text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                >
                    <tab.icon className={`${mobile ? 'w-5 h-5 mb-1.5' : 'w-4 h-4 mb-1'}`} />
                    {t(tab.labelKey)}
                </button>
            ))}
        </div>
    );
}
