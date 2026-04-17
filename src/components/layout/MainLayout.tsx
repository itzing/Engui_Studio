'use client';

import React, { useEffect, useState } from 'react';
import { StudioProvider } from '@/lib/context/StudioContext';
import LeftPanel from './LeftPanel';
import CenterPanel from './CenterPanel';
import RightPanel from './RightPanel';
import MobileStudioLayout from './MobileStudioLayout';

export default function MainLayout() {
    const [isPhoneLayout, setIsPhoneLayout] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mediaQuery = window.matchMedia('(max-width: 767px)');
        const updateLayout = () => setIsPhoneLayout(mediaQuery.matches);

        updateLayout();
        mediaQuery.addEventListener('change', updateLayout);
        return () => mediaQuery.removeEventListener('change', updateLayout);
    }, []);

    return (
        <StudioProvider>
            {isPhoneLayout ? (
                <MobileStudioLayout />
            ) : (
                <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
                    <LeftPanel />
                    <CenterPanel />
                    <RightPanel />
                </div>
            )}
        </StudioProvider>
    );
}
