'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { CogIcon, FolderOpenIcon, UserGroupIcon, SparklesIcon, XMarkIcon, SwatchIcon, HandRaisedIcon, RectangleGroupIcon } from '@heroicons/react/24/outline';
import VideoGenerationForm from '../forms/VideoGenerationForm';
import ImageGenerationForm from '../forms/ImageGenerationForm';
import AudioGenerationForm from '../forms/AudioGenerationForm';
import MusicGenerationForm from '../forms/MusicGenerationForm';
import GenerationTabs, { GenerationMode } from '../forms/GenerationTabs';
import SettingsDialog from '../settings/SettingsDialog';
import { S3BucketViewerDialog } from '../storage/S3BucketViewerDialog';
import CharacterManagerPanel from '../characters/CharacterManagerPanel';
import VibeManagerPanel from '../vibes/VibeManagerPanel';
import PoseManagerPanel from '../poses/PoseManagerPanel';
import SceneManagerPanel from '../scenes/SceneManagerPanel';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { getActiveMode, setActiveMode } from '@/lib/createDrafts';

// Simple icons for social media
const DiscordIcon = ({ className }: { className?: string }) => (
    <svg fill="currentColor" viewBox="0 0 24 24" className={className}>
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.956 2.42-2.157 2.42zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.42-2.157 2.42z" />
    </svg>
);

const GithubIcon = ({ className }: { className?: string }) => (
    <svg fill="currentColor" viewBox="0 0 24 24" className={className}>
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
    <svg fill="currentColor" viewBox="0 0 24 24" className={className}>
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
);

export default function LeftPanel({ mobile = false }: { mobile?: boolean }) {
    const [generationMode, setGenerationMode] = useState<GenerationMode>('image');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isStorageOpen, setIsStorageOpen] = useState(false);
    const [isCharacterManagerOpen, setIsCharacterManagerOpen] = useState(false);
    const [isVibeManagerOpen, setIsVibeManagerOpen] = useState(false);
    const [isPoseManagerOpen, setIsPoseManagerOpen] = useState(false);
    const [isSceneManagerOpen, setIsSceneManagerOpen] = useState(false);

    useEffect(() => {
        const savedMode = getActiveMode();
        if (savedMode === 'image' || savedMode === 'video' || savedMode === 'tts' || savedMode === 'music') {
            setGenerationMode(savedMode);
        }
    }, []);

    useEffect(() => {
        setActiveMode(generationMode);
    }, [generationMode]);

    // Listen for job reuse events and switch to appropriate tab
    React.useEffect(() => {
        const handleReuseInput = (event: CustomEvent) => {
            const { type, _redispatched } = event.detail;

            // Ignore re-dispatched events to prevent infinite loop
            if (_redispatched) {
                return;
            }

            console.log('🎯 LeftPanel received reuseJobInput event, type:', type);

            if (type === 'video') {
                setGenerationMode('video');
                // Re-dispatch event after tab switch to ensure form is mounted
                setTimeout(() => {
                    console.log('🔄 Re-dispatching event after tab switch');
                    window.dispatchEvent(new CustomEvent('reuseJobInput', {
                        detail: { ...event.detail, _redispatched: true }
                    }));
                }, 150);
            } else if (type === 'image') {
                setGenerationMode('image');
                // Re-dispatch event after tab switch to ensure form is mounted
                setTimeout(() => {
                    console.log('🔄 Re-dispatching event after tab switch');
                    window.dispatchEvent(new CustomEvent('reuseJobInput', {
                        detail: { ...event.detail, _redispatched: true }
                    }));
                }, 150);
            } else if (type === 'music') {
                setGenerationMode('music');
                // Re-dispatch event after tab switch to ensure form is mounted
                setTimeout(() => {
                    console.log('🔄 Re-dispatching event after tab switch');
                    window.dispatchEvent(new CustomEvent('reuseJobInput', {
                        detail: { ...event.detail, _redispatched: true }
                    }));
                }, 150);
            } else if (type === 'audio' || type === 'tts') {
                setGenerationMode('tts');
                // Re-dispatch event after tab switch to ensure form is mounted
                setTimeout(() => {
                    console.log('🔄 Re-dispatching event after tab switch');
                    window.dispatchEvent(new CustomEvent('reuseJobInput', {
                        detail: { ...event.detail, _redispatched: true }
                    }));
                }, 150);
            }
        };

        window.addEventListener('reuseJobInput', handleReuseInput as any);
        return () => window.removeEventListener('reuseJobInput', handleReuseInput as any);
    }, []);

    return (
        <div className={mobile ? 'flex h-full bg-card' : 'flex h-full border-r border-border bg-card'}>
            {/* Form Area */}
            <div className={mobile ? 'w-full flex flex-col overflow-hidden' : 'w-[340px] flex flex-col overflow-hidden flex-shrink-0'}>
                {/* Header with Logo, Socials, and Settings */}
                <div className={mobile ? 'p-3 border-b border-border flex items-center justify-between gap-3 bg-muted/10' : 'p-4 border-b border-border flex items-center justify-between gap-3 bg-muted/10'}>
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 relative">
                            <Image
                                src="/logo.png"
                                alt="EnguiStudio"
                                fill
                                className="object-contain"
                            />
                        </div>
                        <span className={`${mobile ? 'font-bold text-base tracking-tight truncate' : 'font-bold text-lg tracking-tight'}`}>EnguiStudio</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {!mobile && (
                            <>
                                <a href="https://discord.gg/8Xhq9f77fK" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" title="Discord">
                                    <DiscordIcon className="w-5 h-5" />
                                </a>
                                <a href="https://github.com/wlsdml1114/Engui_Studio" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" title="GitHub">
                                    <GithubIcon className="w-5 h-5" />
                                </a>
                                <a href="https://www.youtube.com/@enguistudio" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" title="YouTube">
                                    <YoutubeIcon className="w-5 h-5" />
                                </a>
                                <div className="w-px h-4 bg-border mx-1"></div>
                            </>
                        )}
                        <button
                            onClick={() => setIsStorageOpen(true)}
                            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
                            title="Storage"
                        >
                            <FolderOpenIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
                            title="Settings"
                        >
                            <CogIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className={mobile ? 'flex-1 overflow-y-auto p-3 pb-24 custom-scrollbar' : 'flex-1 overflow-y-auto p-4 custom-scrollbar'}>
                    <div className={`grid ${mobile ? 'grid-cols-3' : 'grid-cols-5'} gap-1 p-1 bg-muted/20 rounded-lg mb-4 ${mobile ? 'sticky top-0 z-10 backdrop-blur-sm bg-background/95' : ''}`}>
                        <button
                            type="button"
                            className="flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all duration-200 bg-muted text-foreground shadow-sm"
                        >
                            <SparklesIcon className="w-4 h-4" />
                            Generate
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsCharacterManagerOpen(true)}
                            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all duration-200 ${isCharacterManagerOpen
                                ? 'bg-muted text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                        >
                            <UserGroupIcon className="w-4 h-4" />
                            Characters
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsVibeManagerOpen(true)}
                            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all duration-200 ${isVibeManagerOpen
                                ? 'bg-muted text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                        >
                            <SwatchIcon className="w-4 h-4" />
                            Vibes
                        </button>
                        {!mobile && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setIsPoseManagerOpen(true)}
                                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all duration-200 ${isPoseManagerOpen
                                        ? 'bg-muted text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                        }`}
                                >
                                    <HandRaisedIcon className="w-4 h-4" />
                                    Poses
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsSceneManagerOpen(true)}
                                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all duration-200 ${isSceneManagerOpen
                                        ? 'bg-muted text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                        }`}
                                >
                                    <RectangleGroupIcon className="w-4 h-4" />
                                    Scenes
                                </button>
                            </>
                        )}
                    </div>

                    <>
                        <GenerationTabs activeMode={generationMode} onModeChange={setGenerationMode} mobile={mobile} />
                        {generationMode === 'image' && <ImageGenerationForm />}
                        {generationMode === 'video' && <VideoGenerationForm />}
                        {generationMode === 'tts' && <AudioGenerationForm />}
                        {generationMode === 'music' && <MusicGenerationForm />}
                    </>
                </div>
            </div>

            <Dialog open={isCharacterManagerOpen} onOpenChange={setIsCharacterManagerOpen}>
                <DialogContent className="w-[96vw] max-w-[1600px] h-[94vh] p-0 gap-0 overflow-hidden flex flex-col">
                    <DialogHeader className="border-b border-border px-5 py-4 pr-14 space-y-1 text-left">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="text-base">Character Manager</DialogTitle>
                                <DialogDescription className="text-xs">
                                    Manage saved characters in a dedicated full-canvas workspace.
                                </DialogDescription>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCharacterManagerOpen(false)}
                                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <XMarkIcon className="h-4 w-4" />
                                Close
                            </button>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-5">
                        <CharacterManagerPanel />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isVibeManagerOpen} onOpenChange={(open) => {
                if (open) {
                    setIsVibeManagerOpen(true);
                }
            }}>
                <DialogContent
                    className="w-[96vw] max-w-[1600px] h-[94vh] p-0 gap-0 overflow-hidden flex flex-col [&>button]:hidden"
                    onEscapeKeyDown={(event) => event.preventDefault()}
                    onPointerDownOutside={(event) => event.preventDefault()}
                    onInteractOutside={(event) => event.preventDefault()}
                >
                    <DialogHeader className="border-b border-border px-5 py-4 pr-14 space-y-1 text-left">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="text-base">Vibe Manager</DialogTitle>
                                <DialogDescription className="text-xs">
                                    Manage reusable vibe presets in a dedicated full-canvas workspace.
                                </DialogDescription>
                            </div>
                            <button
                                type="button"
                                onClick={() => window.dispatchEvent(new CustomEvent('vibe-manager-request-close'))}
                                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <XMarkIcon className="h-4 w-4" />
                                Close
                            </button>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-5">
                        <VibeManagerPanel onRequestClose={() => setIsVibeManagerOpen(false)} />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isPoseManagerOpen} onOpenChange={(open) => {
                if (open) {
                    setIsPoseManagerOpen(true);
                }
            }}>
                <DialogContent
                    className="w-[96vw] max-w-[1700px] h-[94vh] p-0 gap-0 overflow-hidden flex flex-col [&>button]:hidden"
                    onEscapeKeyDown={(event) => event.preventDefault()}
                    onPointerDownOutside={(event) => event.preventDefault()}
                    onInteractOutside={(event) => event.preventDefault()}
                >
                    <DialogHeader className="border-b border-border px-5 py-4 pr-14 space-y-1 text-left">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="text-base">Pose Manager</DialogTitle>
                                <DialogDescription className="text-xs">
                                    Manage reusable pose presets in a dedicated desktop workspace.
                                </DialogDescription>
                            </div>
                            <button
                                type="button"
                                onClick={() => window.dispatchEvent(new CustomEvent('pose-manager-request-close'))}
                                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <XMarkIcon className="h-4 w-4" />
                                Close
                            </button>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-5">
                        <PoseManagerPanel onRequestClose={() => setIsPoseManagerOpen(false)} />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isSceneManagerOpen} onOpenChange={(open) => {
                if (open) {
                    setIsSceneManagerOpen(true);
                }
            }}>
                <DialogContent
                    className="w-[96vw] max-w-[1800px] h-[94vh] p-0 gap-0 overflow-hidden flex flex-col [&>button]:hidden"
                    onEscapeKeyDown={(event) => event.preventDefault()}
                    onPointerDownOutside={(event) => event.preventDefault()}
                    onInteractOutside={(event) => event.preventDefault()}
                >
                    <DialogHeader className="border-b border-border px-5 py-4 pr-14 space-y-1 text-left">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="text-base">Scene Manager</DialogTitle>
                                <DialogDescription className="text-xs">
                                    Compose reusable scenes from characters, poses, vibes, and scene instructions.
                                </DialogDescription>
                            </div>
                            <button
                                type="button"
                                onClick={() => window.dispatchEvent(new CustomEvent('scene-manager-request-close'))}
                                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <XMarkIcon className="h-4 w-4" />
                                Close
                            </button>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-5">
                        <SceneManagerPanel onRequestClose={() => setIsSceneManagerOpen(false)} />
                    </div>
                </DialogContent>
            </Dialog>

            <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            <S3BucketViewerDialog open={isStorageOpen} onOpenChange={setIsStorageOpen} />
        </div>
    );
}
