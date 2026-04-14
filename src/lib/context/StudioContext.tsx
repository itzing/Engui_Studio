'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type StudioTool =
    | 'video-generation'
    | 'wan-animate'
    | 'video-upscale'
    | 'flux-kontext'
    | 'flux-krea'
    | 'qwen-image-edit'
    | 'multitalk'
    | 'infinite-talk'
    | 'speech-sequencer'
    | 's3-storage'
    | 'settings';

export interface StudioSettings {
    apiKeys: {
        openai?: string;
        google?: string;
        kling?: string;
        runpod?: string;
        elevenlabs?: string;
    };
    promptHelper?: {
        provider?: 'disabled' | 'local';
        local?: {
            baseUrl?: string;
            model?: string;
            apiKey?: string;
        };
    };
    runpod: {
        endpoints: Record<string, string>; // modelId -> endpointId
        fieldEncKeyB64?: string;
    };
    elevenlabs?: {
        apiKey?: string;
        voiceId?: string;
        model?: string;
        stability?: number;
        similarity?: number;
        style?: number;
        useStreaming?: boolean;
    };
    upscale: {
        endpoint?: string; // Unified upscale endpoint (handles image, video, and frame interpolation)
    };
    storage: {
        endpointUrl?: string;
        bucket?: string;
        region?: string;
        accessKey?: string;
        secretKey?: string;
    };
}

export interface Workspace {
    id: string;
    name: string;
    isDefault: boolean;
    createdAt: string;
}

export interface Job {
    id: string;
    modelId: string;
    type: 'image' | 'video' | 'audio' | 'tts' | 'music';
    status: 'queued' | 'processing' | 'finalizing' | 'completed' | 'failed';
    prompt: string;
    createdAt: number;
    executionMs?: number;
    options?: any;
    resultUrl?: string;
    error?: string;
    endpointId?: string;
    cost?: number;
    workspaceId?: string;
}

// Video Editor Types
export interface VideoProject {
    id: string;
    title: string;
    description: string;
    aspectRatio: '16:9' | '9:16' | '1:1';
    qualityPreset?: string; // '480p' | '720p' | '1080p'
    width?: number;
    height?: number;
    duration: number; // milliseconds
    createdAt: number;
    updatedAt: number;
}

export interface VideoTrack {
    id: string;
    projectId: string;
    type: 'video' | 'music' | 'voiceover';
    label: string;
    locked: boolean;
    order: number;
    volume: number; // 0-200, default 100
    muted: boolean; // default false
}

export interface VideoKeyFrame {
    id: string;
    trackId: string;
    timestamp: number; // milliseconds
    duration: number; // milliseconds
    data: {
        type: 'image' | 'video' | 'music' | 'voiceover';
        mediaId: string;
        url: string;
        prompt?: string;
        originalDuration?: number; // Original media duration in ms (for waveform scaling)
        volume?: number; // 0-200, null means use track volume
        fitMode?: 'contain' | 'cover' | 'fill'; // Media fitting mode for image/video
    };
}

// PlayerRef type for Remotion Player
export type PlayerRef = any; // Will be properly typed when Remotion is installed

const defaultSettings: StudioSettings = {
    apiKeys: {},
    promptHelper: {
        provider: 'disabled',
        local: {
            baseUrl: '',
            model: '',
            apiKey: ''
        }
    },
    runpod: {
        endpoints: {},
        fieldEncKeyB64: ''
    },
    upscale: {},
    storage: {}
};

interface StudioContextType {
    activeTool: StudioTool;
    setActiveTool: (tool: StudioTool) => void;
    selectedModel: string | null;
    setSelectedModel: (model: string | null) => void;
    activeArtifactId: string | null;
    setActiveArtifactId: (id: string | null) => void;
    settings: StudioSettings;
    updateSettings: (settings: Partial<StudioSettings>) => void;

    // Jobs
    jobs: Job[];
    addJob: (job: Job) => void;
    addCompletedJob: (job: Job) => void;
    updateJobStatus: (id: string, status: Job['status'], resultUrl?: string, error?: string, cost?: number, executionMs?: number) => void;
    deleteJob: (id: string) => Promise<boolean>;
    cancelJob: (id: string) => Promise<boolean>;
    clearFinishedJobs: (workspaceId: string | null) => Promise<{ success: boolean; deleted?: number; deletedFiles?: number; error?: string }>;
    reuseJobInput: (jobId: string) => void;

    // Workspaces
    workspaces: Workspace[];
    activeWorkspaceId: string | null;
    createWorkspace: (name: string) => Promise<void>;
    selectWorkspace: (id: string) => void;
    deleteWorkspace: (id: string) => Promise<void>;

    // Video Editor State
    currentProject: VideoProject | null;
    projects: VideoProject[];
    tracks: VideoTrack[];
    keyframes: Record<string, VideoKeyFrame[]>; // trackId -> keyframes
    player: PlayerRef | null;
    playerState: 'playing' | 'paused';
    currentTimestamp: number; // seconds
    zoom: number;
    selectedKeyframeIds: string[];
    exportDialogOpen: boolean;

    // Video Editor Actions
    createProject: (project: Omit<VideoProject, 'id' | 'createdAt' | 'updatedAt'>, options?: { skipDefaultTracks?: boolean }) => Promise<string>;
    loadProject: (projectId: string) => Promise<void>;
    updateProject: (projectId: string, updates: Partial<VideoProject>) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    addTrack: (track: Omit<VideoTrack, 'id'>) => Promise<string>;
    updateTrack: (trackId: string, updates: Partial<Pick<VideoTrack, 'volume' | 'muted'>>) => Promise<void>;
    removeTrack: (trackId: string) => Promise<void>;
    addKeyframe: (keyframe: Omit<VideoKeyFrame, 'id'>) => Promise<string>;
    updateKeyframe: (keyframeId: string, updates: Partial<VideoKeyFrame>) => Promise<void>;
    removeKeyframe: (keyframeId: string) => Promise<void>;
    setPlayer: (player: PlayerRef | null) => void;
    setPlayerState: (state: 'playing' | 'paused') => void;
    setCurrentTimestamp: (timestamp: number) => void;
    setZoom: (zoom: number) => void;
    selectKeyframe: (keyframeId: string) => void;
    deselectKeyframe: (keyframeId: string) => void;
    clearSelection: () => void;
    setExportDialogOpen: (open: boolean) => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

export function StudioProvider({ children }: { children: ReactNode }) {
    const [activeTool, setActiveTool] = useState<StudioTool>('speech-sequencer');
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);

    // Workspace State
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

    // Video Editor State
    const [currentProject, setCurrentProject] = useState<VideoProject | null>(null);
    const [projects, setProjects] = useState<VideoProject[]>([]);
    const [tracks, setTracks] = useState<VideoTrack[]>([]);
    const [keyframes, setKeyframes] = useState<Record<string, VideoKeyFrame[]>>({});
    const [player, setPlayer] = useState<PlayerRef | null>(null);
    const [playerState, setPlayerState] = useState<'playing' | 'paused'>('paused');
    const [currentTimestamp, setCurrentTimestamp] = useState<number>(0);
    const [zoom, setZoom] = useState<number>(1);
    const [selectedKeyframeIds, setSelectedKeyframeIds] = useState<string[]>([]);
    const [exportDialogOpen, setExportDialogOpen] = useState<boolean>(false);

    // Jobs should always come from DB, not localStorage
    const [jobs, setJobs] = useState<Job[]>([]);

    const [settings, setSettings] = useState<StudioSettings>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('engui_settings');
            return saved ? JSON.parse(saved) : defaultSettings;
        }
        return defaultSettings;
    });

    const updateSettings = (newSettings: Partial<StudioSettings>) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            if (typeof window !== 'undefined') {
                localStorage.setItem('engui_settings', JSON.stringify(updated));
            }

            // Sync to server
            // Map 'storage' to 's3' for the API
            const apiSettings: any = { ...updated };
            if (updated.storage) {
                apiSettings.s3 = {
                    endpointUrl: updated.storage.endpointUrl,
                    bucketName: updated.storage.bucket,
                    region: updated.storage.region,
                    accessKeyId: updated.storage.accessKey,
                    secretAccessKey: updated.storage.secretKey
                };
                delete apiSettings.storage;
            }

            // Map 'apiKeys.runpod' to 'runpod.apiKey' for the API
            if (updated.apiKeys?.runpod) {
                if (!apiSettings.runpod) apiSettings.runpod = {};
                apiSettings.runpod.apiKey = updated.apiKeys.runpod;
            }

            // Map 'apiKeys.elevenlabs' to 'elevenlabs.apiKey' for the API
            if (updated.apiKeys?.elevenlabs) {
                if (!apiSettings.elevenlabs) apiSettings.elevenlabs = {};
                apiSettings.elevenlabs.apiKey = updated.apiKeys.elevenlabs;
            }

            fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: apiSettings })
            }).catch(err => console.error('Failed to sync settings:', err));

            return updated;
        });
    };

    // Fetch settings from server on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await fetch('/api/settings');
                const data = await response.json();
                if (data.success && data.settings) {
                    setSettings(prev => {
                        // Deep merge is better, but simple merge for now
                        const merged = { ...prev, ...data.settings };

                        // Map 's3' from API to 'storage' in state
                        if (data.settings.s3) {
                            merged.storage = {
                                ...prev.storage,
                                endpointUrl: data.settings.s3.endpointUrl,
                                bucket: data.settings.s3.bucketName,
                                region: data.settings.s3.region,
                                accessKey: data.settings.s3.accessKeyId,
                                secretKey: data.settings.s3.secretAccessKey
                            };
                            delete (merged as any).s3;
                        }

                        // Map 'runpod.apiKey' from API to 'apiKeys.runpod' in state
                        if (data.settings.runpod?.apiKey) {
                            if (!merged.apiKeys) merged.apiKeys = {};
                            merged.apiKeys.runpod = data.settings.runpod.apiKey;
                        }

                        // Map 'elevenlabs.apiKey' from API to 'apiKeys.elevenlabs' in state
                        if (data.settings.elevenlabs?.apiKey) {
                            if (!merged.apiKeys) merged.apiKeys = {};
                            merged.apiKeys.elevenlabs = data.settings.elevenlabs.apiKey;
                        }

                        // Ensure nested objects exist
                        if (data.settings.runpod) {
                            merged.runpod = { ...prev.runpod, ...data.settings.runpod };
                            if (data.settings.runpod.endpoints) {
                                merged.runpod.endpoints = { ...prev.runpod.endpoints, ...data.settings.runpod.endpoints };
                            }
                        }

                        if (data.settings.promptHelper) {
                            merged.promptHelper = {
                                ...prev.promptHelper,
                                ...data.settings.promptHelper,
                                local: {
                                    ...prev.promptHelper?.local,
                                    ...data.settings.promptHelper.local,
                                }
                            };
                        }

                        if (typeof window !== 'undefined') {
                            localStorage.setItem('engui_settings', JSON.stringify(merged));
                        }
                        return merged;
                    });
                }
            } catch (error) {
                console.error('Failed to fetch settings:', error);
            }
        };

        fetchSettings();
    }, []);

    // --- Workspace Actions ---

    const fetchWorkspaces = async () => {
        try {
            console.log('📂 Fetching workspaces for user: user-with-settings');
            const response = await fetch('/api/workspaces?userId=user-with-settings');
            const data = await response.json();
            console.log('📂 Workspaces response:', data);
            if (data.workspaces) {
                setWorkspaces(data.workspaces);
                console.log('📂 Found workspaces:', data.workspaces.length);

                // Set default workspace if none active
                if (!activeWorkspaceId && data.workspaces.length > 0) {
                    // Try to restore last selected workspace from localStorage
                    const savedWorkspaceId = typeof window !== 'undefined'
                        ? localStorage.getItem('activeWorkspaceId')
                        : null;

                    let workspaceToSelect: Workspace | undefined;

                    if (savedWorkspaceId && data.workspaces.find((w: Workspace) => w.id === savedWorkspaceId)) {
                        // Use saved workspace if it still exists
                        workspaceToSelect = data.workspaces.find((w: Workspace) => w.id === savedWorkspaceId);
                        console.log('✅ Restoring saved workspace:', workspaceToSelect?.id, workspaceToSelect?.name);
                    } else {
                        // Prefer default workspace, otherwise first one
                        workspaceToSelect = data.workspaces.find((w: Workspace) => w.isDefault) || data.workspaces[0];
                        if (workspaceToSelect) {
                            console.log('✅ Setting default workspace:', workspaceToSelect.id, workspaceToSelect.name);
                        }
                    }

                    if (workspaceToSelect) {
                        setActiveWorkspaceId(workspaceToSelect.id);
                    }
                } else if (data.workspaces.length === 0) {
                    console.warn('⚠️ No workspaces found! Creating default workspace...');
                    // Create default workspace
                    await createWorkspace('Default');
                }
            }
        } catch (error) {
            console.error('Failed to fetch workspaces:', error);
        }
    };

    const createWorkspace = async (name: string) => {
        try {
            const response = await fetch('/api/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, userId: 'user-with-settings' })
            });
            const data = await response.json();
            if (data.workspace) {
                setWorkspaces(prev => [...prev, data.workspace]);
                setActiveWorkspaceId(data.workspace.id);
            }
        } catch (error) {
            console.error('Failed to create workspace:', error);
        }
    };

    const deleteWorkspace = async (id: string) => {
        // Optimistic update not ideal here as we need to handle jobs deletion or migration
        // For now, just API call
        // TODO: Implement API for delete
        console.log('Delete workspace not implemented yet in API');
    };

    const selectWorkspace = (id: string) => {
        setActiveWorkspaceId(id);
        // Save to localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem('activeWorkspaceId', id);
        }
    };

    // --- Job Actions ---

    const fetchJobs = async () => {
        if (!activeWorkspaceId) {
            console.log('⚠️ fetchJobs: No active workspace ID');
            return;
        }

        try {
            console.log('🔄 Fetching jobs for workspace:', activeWorkspaceId);
            const response = await fetch(`/api/jobs?userId=user-with-settings&workspaceId=${activeWorkspaceId}&limit=50&page=1`);
            const data = await response.json();
            if (data.success) {
                console.log('✅ Fetched jobs:', data.jobs.length, 'jobs for workspace:', activeWorkspaceId);
                setJobs(data.jobs);
            }
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
        }
    };

    const addJob = async (job: Job) => {
        const jobWithWorkspace = { ...job, workspaceId: activeWorkspaceId || undefined };

        console.log('➕ Adding job:', {
            jobId: job.id,
            workspaceId: activeWorkspaceId,
            assignedWorkspaceId: jobWithWorkspace.workspaceId,
            status: job.status
        });

        // Optimistic update
        setJobs(prev => [jobWithWorkspace, ...prev]);

        try {
            const response = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobWithWorkspace)
            });
            const data = await response.json();
            console.log('✅ Job saved to DB:', data);

            // Update with server response to ensure consistency
            if (data.success && data.job) {
                setJobs(prev => prev.map(j => j.id === job.id ? {
                    ...data.job,
                    createdAt: new Date(data.job.createdAt).getTime()
                } : j));
            }
        } catch (error) {
            console.error('Failed to save job:', error);
            // Rollback optimistic update on error
            setJobs(prev => prev.filter(j => j.id !== job.id));
        }
    };

    /**
     * Adds a job that is already completed and persisted on the server (e.g. synchronous external providers).
     * This updates the local UI state without re-posting the job to the API.
     */
    const addCompletedJob = (job: Job) => {
        const jobWithWorkspace = { ...job, workspaceId: activeWorkspaceId || undefined };
        console.log('➕ Adding completed job (local sync):', job.id);

        // Update jobs list
        setJobs(prev => [jobWithWorkspace, ...prev]);
    };

    const updateJobStatus = async (id: string, status: Job['status'], resultUrl?: string, error?: string, cost?: number, executionMs?: number) => {
        // Find the job to get its details
        const job = jobs.find(j => j.id === id);

        // Optimistic update
        setJobs(prev => prev.map(job =>
            job.id === id ? { ...job, status, resultUrl, error, cost, ...(executionMs !== undefined ? { executionMs } : {}) } : job
        ));

        try {
            await fetch(`/api/jobs/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, resultUrl, error, cost, ...(executionMs !== undefined ? { executionMs } : {}) })
            });
        } catch (error) {
            console.error('Failed to update job:', error);
        }
    };

    const deleteJob = async (id: string) => {
        try {
            const response = await fetch(`/api/jobs/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to delete job');
            }

            setJobs(prev => prev.filter(job => job.id !== id));
            return true;
        } catch (error) {
            console.error('Failed to delete job:', error);
            return false;
        }
    };

    const cancelJob = async (id: string) => {
        try {
            const response = await fetch(`/api/jobs/${id}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success || !data.job) {
                throw new Error(data.error || 'Failed to cancel job');
            }

            setJobs(prev => prev.map(job => job.id === id ? {
                ...job,
                status: 'failed',
                error: 'cancelled',
            } : job));
            return true;
        } catch (error) {
            console.error('Failed to cancel job:', error);
            return false;
        }
    };

    const clearFinishedJobs = async (workspaceId: string | null) => {
        try {
            const response = await fetch('/api/jobs/clear-finished', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId, userId: 'user-with-settings' })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to clear finished jobs');
            }

            setJobs(prev => prev.filter(job => !(job.workspaceId === workspaceId && (job.status === 'completed' || job.status === 'failed'))));
            return { success: true, deleted: data.deleted, deletedFiles: data.deletedFiles };
        } catch (error: any) {
            console.error('Failed to clear finished jobs:', error);
            return { success: false, error: error?.message || 'Failed to clear finished jobs' };
        }
    };

    const reuseJobInput = async (jobId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (!job) {
            console.warn('Job not found:', jobId);
            return;
        }

        console.log('🔄 Reusing job input:', job);

        // Set the model
        setSelectedModel(job.modelId);

        // Fetch full job details from API to get options and media paths
        try {
            const response = await fetch(`/api/jobs/${jobId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch job: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.job) {
                // Parse options JSON safely with error handling
                let options = {};
                try {
                    options = typeof data.job.options === 'string'
                        ? JSON.parse(data.job.options)
                        : (data.job.options || {});
                } catch (parseError) {
                    console.error('Failed to parse job options:', parseError);
                    options = {};
                }

                console.log('📋 Job options:', options);
                console.log('📁 Media paths:', {
                    image: data.job.imageInputPath,
                    video: data.job.videoInputPath,
                    audio: data.job.audioInputPath
                });

                // Dispatch custom event with complete job data including media paths
                // Add a small delay to allow LeftPanel to switch tabs and mount the correct form
                if (typeof window !== 'undefined') {
                    console.log('⏰ Scheduling reuseJobInput event dispatch in 100ms...');
                    setTimeout(() => {
                        try {
                            const shouldReuseImageInput = !(job.modelId === 'z-image' && options.use_controlnet !== true);
                            const resolvedImageInputPath = shouldReuseImageInput ? data.job.imageInputPath : null;

                            console.log('📤 Dispatching reuseJobInput event:', {
                                modelId: job.modelId,
                                type: job.type,
                                hasOptions: !!options,
                                imageInputPath: resolvedImageInputPath,
                                videoInputPath: data.job.videoInputPath,
                                audioInputPath: data.job.audioInputPath,
                                shouldReuseImageInput,
                            });
                            window.dispatchEvent(new CustomEvent('reuseJobInput', {
                                detail: {
                                    modelId: job.modelId,
                                    prompt: job.prompt,
                                    type: job.type,
                                    options: options,
                                    imageInputPath: resolvedImageInputPath,
                                    videoInputPath: data.job.videoInputPath,
                                    audioInputPath: data.job.audioInputPath
                                }
                            }));
                            console.log('✅ Event dispatched successfully');
                        } catch (eventError) {
                            console.error('Failed to dispatch reuseJobInput event:', eventError);
                        }
                    }, 100);
                }
            }
        } catch (error) {
            console.error('Failed to fetch job details:', error);
            // Fallback to basic reuse without options
            // Add a small delay to allow LeftPanel to switch tabs and mount the correct form
            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    try {
                        window.dispatchEvent(new CustomEvent('reuseJobInput', {
                            detail: {
                                modelId: job.modelId,
                                prompt: job.prompt,
                                type: job.type,
                                options: {}
                            }
                        }));
                    } catch (eventError) {
                        console.error('Failed to dispatch fallback reuseJobInput event:', eventError);
                    }
                }, 100);
            }
        }
    };

    // --- Video Project Actions ---

    const fetchProjects = async () => {
        try {
            console.log('📂 Fetching video projects...');
            const response = await fetch('/api/video-projects?userId=user-with-settings');
            const data = await response.json();
            console.log('📂 Projects response:', data);
            if (data.projects) {
                setProjects(data.projects);
                console.log('📂 Found projects:', data.projects.length);
            }
        } catch (error) {
            console.error('Failed to fetch projects:', error);
        }
    };

    // Initial Load
    useEffect(() => {
        console.log('🚀 StudioContext: Initial load, fetching workspaces and projects...');
        fetchWorkspaces();
        fetchProjects();
    }, []);

    // Fetch jobs when workspace changes
    useEffect(() => {
        console.log('🔄 Workspace changed:', activeWorkspaceId);
        if (activeWorkspaceId) {
            // Save to localStorage
            if (typeof window !== 'undefined') {
                localStorage.setItem('activeWorkspaceId', activeWorkspaceId);
            }
            fetchJobs();
        } else {
            console.warn('⚠️ No active workspace ID set');
        }
    }, [activeWorkspaceId]);

    // Polling Logic
    useEffect(() => {
        const interval = setInterval(async () => {
            const activeJobs = jobs.filter(job => job.status === 'queued' || job.status === 'processing' || job.status === 'finalizing');

            if (activeJobs.length === 0) return;

            // Check all active jobs using unified status API
            for (const job of activeJobs) {
                try {

                    // Use unified status API (no headers needed)
                    const response = await fetch(`/api/generate/status?jobId=${job.id}&userId=user-with-settings`);

                    const data = await response.json();

                    if (data.success) {
                        if (data.status === 'IN_QUEUE') {
                            if (job.status !== 'queued') {
                                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'queued' } : j));
                                await fetch(`/api/jobs/${job.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'queued' })
                                });
                            }
                            continue;
                        }

                        if (data.status === 'IN_PROGRESS') {
                            const rawOptions = (job as any).options;
                            const parsedOptions = typeof rawOptions === 'string'
                                ? (() => { try { return JSON.parse(rawOptions); } catch { return {}; } })()
                                : (rawOptions || {});

                            if (!parsedOptions.runStartedAt) {
                                parsedOptions.runStartedAt = Date.now();
                                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'processing', options: parsedOptions } : j));
                                await fetch(`/api/jobs/${job.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'processing', options: JSON.stringify(parsedOptions) })
                                });
                            } else if (job.status !== 'processing') {
                                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'processing' } : j));
                                await fetch(`/api/jobs/${job.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'processing' })
                                });
                            }
                            continue;
                        }

                        if (data.status === 'COMPLETED') {
                            console.log('Job completed:', {
                                jobId: job.id,
                                hasOutput: !!data.output,
                                secureFinalized: data?.meta?.secureFinalized === true,
                            });

                            // RunPod often returns output as an object with 'image_url' or similar, or just a string.
                            // Adjust based on actual model output.
                            let resultUrl = '';

                            if (!data.output) {
                                console.warn('Job completed but no output found');
                            } else if (typeof data.output === 'string') {
                                resultUrl = data.output;
                            } else if (typeof data.output === 'object') {
                                // Common patterns - check S3 paths first
                                if (data.output.s3_path) resultUrl = data.output.s3_path;
                                else if (data.output.output_path) resultUrl = data.output.output_path;
                                else if (data.output.image_path) resultUrl = data.output.image_path;
                                else if (data.output.video_path) resultUrl = data.output.video_path;
                                else if (data.output.image) resultUrl = data.output.image;
                                else if (data.output.image_url) resultUrl = data.output.image_url;
                                else if (data.output.video) resultUrl = data.output.video;
                                else if (data.output.video_url) resultUrl = data.output.video_url;
                                else if (data.output.audioUrl) resultUrl = data.output.audioUrl;
                                else if (data.output.url) resultUrl = data.output.url;
                                else if (data.output.images && Array.isArray(data.output.images) && data.output.images.length > 0) resultUrl = data.output.images[0];
                                else if (data.output.videos && Array.isArray(data.output.videos) && data.output.videos.length > 0) resultUrl = data.output.videos[0];
                                else if (data.output.message) resultUrl = data.output.message;
                                else if (Array.isArray(data.output) && data.output.length > 0) {
                                    // If output is an array of strings
                                    if (typeof data.output[0] === 'string') resultUrl = data.output[0];
                                }
                            }

                            if (!resultUrl) {
                                console.warn('Unknown output format for completed job', {
                                    jobId: job.id,
                                    outputType: Array.isArray(data.output) ? 'array' : typeof data.output,
                                    outputKeys: data.output && typeof data.output === 'object' && !Array.isArray(data.output)
                                        ? Object.keys(data.output)
                                        : undefined,
                                });
                            }

                            // Add base64 prefix if missing and looks like base64
                            if (resultUrl && !resultUrl.startsWith('http') && !resultUrl.startsWith('data:')) {
                                // Simple check for base64 characters
                                if (/^[A-Za-z0-9+/=]+$/.test(resultUrl.substring(0, 100))) {
                                    resultUrl = `data:image/png;base64,${resultUrl}`;
                                }
                            }

                            const rawJobOptions = (job as any).options;
                            const parsedJobOptions = typeof rawJobOptions === 'string'
                                ? (() => { try { return JSON.parse(rawJobOptions); } catch { return {}; } })()
                                : (rawJobOptions || {});
                            const secureMode = parsedJobOptions.secureMode === true || data?.meta?.secureFinalized === true;

                            // Download the result to local workspace only for legacy non-secure jobs.
                            if (resultUrl && !resultUrl.startsWith('/generations/') && !resultUrl.startsWith('/results/')) {
                                if (secureMode) {
                                    console.warn('Secure job returned non-local completed URL, skipping legacy download fallback', {
                                        jobId: job.id,
                                    });
                                } else {
                                    try {
                                        const ext = job.type === 'video' ? '.mp4' : '.png';
                                        // Sanitize modelId to remove slashes and other unsafe characters
                                        const safeModelId = job.modelId.replace(/[^a-zA-Z0-9-_]/g, '_');
                                        const filename = `${safeModelId}-${job.id}${ext}`;

                                        const downloadRes = await fetch('/api/download', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                url: resultUrl,
                                                filename: filename,
                                                folder: 'generations'
                                            })
                                        });

                                        const downloadData = await downloadRes.json();
                                        if (downloadData.success) {
                                            resultUrl = downloadData.path;
                                        } else {
                                            console.error('Failed to download result:', downloadData.error);
                                        }
                                    } catch (err) {
                                        console.error('Error calling download API:', err);
                                    }
                                }
                            }

                            if (secureMode && resultUrl && !resultUrl.startsWith('/generations/') && !resultUrl.startsWith('/results/')) {
                                console.warn('Secure completed job is missing a local finalized result URL', {
                                    jobId: job.id,
                                });
                            }

                            const rawOptions = (job as any).options;
                            const parsedOptions = typeof rawOptions === 'string'
                                ? (() => { try { return JSON.parse(rawOptions); } catch { return {}; } })()
                                : (rawOptions || {});

                            const rawExec = data.executionTime ?? data.execution_time ?? data?.metrics?.executionTime;
                            let executionMs: number | undefined;
                            if (typeof rawExec === 'number' && Number.isFinite(rawExec)) {
                                executionMs = Math.max(0, Math.round(rawExec));
                            } else if (typeof rawExec === 'string' && rawExec.trim() !== '' && !Number.isNaN(Number(rawExec))) {
                                executionMs = Math.max(0, Math.round(Number(rawExec)));
                            }

                            if (executionMs !== undefined) {
                                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, executionMs } : j));
                            }

                            updateJobStatus(job.id, 'completed', resultUrl, undefined, undefined, executionMs);
                        } else if (data.status === 'FAILED') {
                            updateJobStatus(job.id, 'failed', undefined, data.error || 'RunPod job failed');
                        }
                        // If IN_QUEUE or IN_PROGRESS, do nothing (keep polling)
                    }
                } catch (error) {
                    console.error('Polling error for job', job.id, error);
                }
            }
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(interval);
    }, [jobs, settings, activeWorkspaceId]);

    // --- Video Editor Actions ---

    const createProject = async (
        project: Omit<VideoProject, 'id' | 'createdAt' | 'updatedAt'>,
        options?: { skipDefaultTracks?: boolean }
    ): Promise<string> => {
        const newProject: VideoProject = {
            ...project,
            id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        setProjects(prev => [...prev, newProject]);
        setCurrentProject(newProject);

        // Only create default tracks if not skipped (e.g., for JSON import)
        if (!options?.skipDefaultTracks) {
            const defaultTracks = createDefaultTracks(newProject.id);
            const defaultKeyframes: Record<string, VideoKeyFrame[]> = {};
            defaultTracks.forEach(track => {
                defaultKeyframes[track.id] = [];
            });
            setTracks(defaultTracks);
            setKeyframes(defaultKeyframes);
        } else {
            setTracks([]);
            setKeyframes({});
        }

        try {
            const response = await fetch('/api/video-projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProject),
            });
            const data = await response.json();
            if (data.success && data.project) {
                // Update with server-generated ID if different
                setProjects(prev => prev.map(p => p.id === newProject.id ? data.project : p));
                setCurrentProject(data.project);

                // Save default tracks to API only if not skipped
                if (!options?.skipDefaultTracks) {
                    const defaultTracks = createDefaultTracks(data.project.id);
                    for (const track of defaultTracks) {
                        try {
                            await fetch('/api/video-tracks', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(track),
                            });
                        } catch (err) {
                            console.error('Failed to save default track:', err);
                        }
                    }
                }

                return data.project.id;
            }
        } catch (error) {
            console.error('Failed to create project:', error);
        }

        return newProject.id;
    };

    // Helper function to create default tracks for a new project
    const createDefaultTracks = (projectId: string): VideoTrack[] => {
        const timestamp = Date.now();
        return [
            {
                id: `track-${timestamp}-video`,
                projectId,
                type: 'video',
                label: 'Video Track',
                locked: false,
                order: 0,
                volume: 100,
                muted: false,
            },
            {
                id: `track-${timestamp}-music`,
                projectId,
                type: 'music',
                label: 'Music Track',
                locked: false,
                order: 1,
                volume: 100,
                muted: false,
            },
            {
                id: `track-${timestamp}-voiceover`,
                projectId,
                type: 'voiceover',
                label: 'Voiceover Track',
                locked: false,
                order: 2,
                volume: 100,
                muted: false,
            },
        ];
    };

    const loadProject = async (projectId: string): Promise<void> => {
        try {
            const response = await fetch(`/api/video-projects/${projectId}`);

            // If project doesn't exist (404), create a new default project and save to DB
            if (response.status === 404) {
                console.log('Project not found, creating new default project...');

                // Create a default project
                const defaultProject: VideoProject = {
                    id: `project-${Date.now()}`,
                    title: 'My Video Project',
                    description: 'A new video project',
                    aspectRatio: '16:9',
                    duration: 30000, // 30 seconds
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };

                // Create default tracks
                const defaultTracks = createDefaultTracks(defaultProject.id);
                const defaultKeyframes: Record<string, VideoKeyFrame[]> = {};
                defaultTracks.forEach(track => {
                    defaultKeyframes[track.id] = [];
                });

                // Update state first
                setCurrentProject(defaultProject);
                setProjects(prev => [...prev, defaultProject]);
                setTracks(defaultTracks);
                setKeyframes(defaultKeyframes);

                // Save project to DB
                try {
                    const createResponse = await fetch('/api/video-projects', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(defaultProject),
                    });
                    const createData = await createResponse.json();
                    if (createData.success && createData.project) {
                        // Update with server-generated data if needed
                        setCurrentProject(createData.project);
                        setProjects(prev => prev.map(p => p.id === defaultProject.id ? createData.project : p));

                        // Save default tracks to DB
                        for (const track of defaultTracks) {
                            await fetch('/api/video-tracks', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ...track, projectId: createData.project.id }),
                            });
                        }
                        console.log('✅ Default project saved to DB:', createData.project.id);
                    }
                } catch (err) {
                    console.error('Failed to save default project to DB:', err);
                }

                return;
            }

            const data = await response.json();
            if (data.success && data.project) {
                setCurrentProject(data.project);

                // If no tracks exist, create default tracks
                const loadedTracks = data.tracks || [];
                if (loadedTracks.length === 0) {
                    console.log('No tracks found, creating default tracks...');
                    const defaultTracks = createDefaultTracks(data.project.id);
                    setTracks(defaultTracks);

                    // Initialize empty keyframes for default tracks
                    const defaultKeyframes: Record<string, VideoKeyFrame[]> = {};
                    defaultTracks.forEach(track => {
                        defaultKeyframes[track.id] = [];
                    });
                    setKeyframes(defaultKeyframes);

                    // Save default tracks to API
                    for (const track of defaultTracks) {
                        try {
                            await fetch('/api/video-tracks', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(track),
                            });
                        } catch (err) {
                            console.error('Failed to save default track:', err);
                        }
                    }
                } else {
                    // Deduplicate tracks by type - keep only the first track of each type
                    const seenTypes = new Set<string>();
                    const deduplicatedTracks: VideoTrack[] = [];
                    const duplicateTrackIds: string[] = [];

                    for (const track of loadedTracks) {
                        if (!seenTypes.has(track.type)) {
                            seenTypes.add(track.type);
                            deduplicatedTracks.push(track);
                        } else {
                            duplicateTrackIds.push(track.id);
                        }
                    }

                    // Delete duplicate tracks from DB
                    if (duplicateTrackIds.length > 0) {
                        console.log('🧹 Cleaning up duplicate tracks:', duplicateTrackIds);
                        for (const trackId of duplicateTrackIds) {
                            try {
                                await fetch(`/api/video-tracks/${trackId}`, { method: 'DELETE' });
                            } catch (err) {
                                console.error('Failed to delete duplicate track:', err);
                            }
                        }
                    }

                    setTracks(deduplicatedTracks);

                    // Organize keyframes by trackId (only for non-duplicate tracks)
                    const keyframesByTrack: Record<string, VideoKeyFrame[]> = {};
                    if (data.keyframes) {
                        data.keyframes.forEach((kf: VideoKeyFrame) => {
                            // Only include keyframes for tracks that weren't duplicates
                            if (!duplicateTrackIds.includes(kf.trackId)) {
                                if (!keyframesByTrack[kf.trackId]) {
                                    keyframesByTrack[kf.trackId] = [];
                                }
                                keyframesByTrack[kf.trackId].push(kf);
                            }
                        });
                    }
                    setKeyframes(keyframesByTrack);
                }
            } else {
                // If the API returns success: false, create and save default project
                console.log('API returned error, creating default project...');
                await createAndSaveDefaultProject();
            }
        } catch (error) {
            // For any error, create and save default project
            console.log('Error loading project, creating default project...', error);
            await createAndSaveDefaultProject();
        }
    };

    // Helper function to create and save a default project to DB
    const createAndSaveDefaultProject = async () => {
        const defaultProject: VideoProject = {
            id: `project-${Date.now()}`,
            title: 'My Video Project',
            description: 'A new video project',
            aspectRatio: '16:9',
            duration: 30000,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const defaultTracks = createDefaultTracks(defaultProject.id);
        const defaultKeyframes: Record<string, VideoKeyFrame[]> = {};
        defaultTracks.forEach(track => {
            defaultKeyframes[track.id] = [];
        });

        // Update state first
        setCurrentProject(defaultProject);
        setProjects(prev => [...prev, defaultProject]);
        setTracks(defaultTracks);
        setKeyframes(defaultKeyframes);

        // Save to DB
        try {
            const createResponse = await fetch('/api/video-projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(defaultProject),
            });
            const createData = await createResponse.json();
            if (createData.success && createData.project) {
                setCurrentProject(createData.project);
                setProjects(prev => prev.map(p => p.id === defaultProject.id ? createData.project : p));

                // Save default tracks to DB
                for (const track of defaultTracks) {
                    await fetch('/api/video-tracks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...track, projectId: createData.project.id }),
                    });
                }
                console.log('✅ Default project saved to DB:', createData.project.id);
            }
        } catch (err) {
            console.error('Failed to save default project to DB:', err);
        }
    };

    // Debounced auto-save for project updates
    const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);

    const updateProject = async (projectId: string, updates: Partial<VideoProject>): Promise<void> => {
        const updatedProject = { ...updates, updatedAt: Date.now() };

        // Optimistic update
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updatedProject } : p));
        if (currentProject?.id === projectId) {
            setCurrentProject(prev => prev ? { ...prev, ...updatedProject } : null);
        }

        // Clear existing timeout
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
        }

        // Debounce the API call
        const timeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/video-projects/${projectId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedProject),
                });

                // If project doesn't exist (404), create it first
                if (response.status === 404) {
                    console.log('Project not found in DB, creating it...');
                    const projectToCreate = currentProject ? { ...currentProject, ...updatedProject } : {
                        id: projectId,
                        title: 'My Video Project',
                        description: '',
                        aspectRatio: '16:9' as const,
                        duration: 30000,
                        createdAt: Date.now(),
                        ...updatedProject,
                    };

                    const createResponse = await fetch('/api/video-projects', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(projectToCreate),
                    });

                    if (createResponse.ok) {
                        console.log('✅ Project created and saved:', projectId);

                        // Also save tracks if they exist
                        for (const track of tracks) {
                            if (track.projectId === projectId) {
                                await fetch('/api/video-tracks', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(track),
                                }).catch(() => { }); // Ignore errors for tracks
                            }
                        }
                    }
                    return;
                }

                if (!response.ok) {
                    throw new Error(`Auto-save failed with status: ${response.status}`);
                }

                console.log('✅ Project auto-saved:', projectId);
            } catch (error) {
                console.error('❌ Failed to auto-save project:', error);
            }
        }, 500); // 500ms debounce delay

        setAutoSaveTimeout(timeout);
    };

    const deleteProject = async (projectId: string): Promise<void> => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (currentProject?.id === projectId) {
            setCurrentProject(null);
            setTracks([]);
            setKeyframes({});
        }

        try {
            await fetch(`/api/video-projects/${projectId}`, {
                method: 'DELETE',
            });
        } catch (error) {
            console.error('Failed to delete project:', error);
        }
    };

    const addTrack = async (track: Omit<VideoTrack, 'id'>): Promise<string> => {
        const newTrack: VideoTrack = {
            ...track,
            id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };

        setTracks(prev => [...prev, newTrack]);
        setKeyframes(prev => ({ ...prev, [newTrack.id]: [] }));

        try {
            const response = await fetch('/api/video-tracks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTrack),
            });
            const data = await response.json();
            if (data.success && data.track) {
                setTracks(prev => prev.map(t => t.id === newTrack.id ? data.track : t));
                return data.track.id;
            }
        } catch (error) {
            console.error('Failed to add track:', error);
        }

        return newTrack.id;
    };

    const updateTrack = async (trackId: string, updates: Partial<Pick<VideoTrack, 'volume' | 'muted'>>): Promise<void> => {
        setTracks(prev => prev.map(t => t.id === trackId ? { ...t, ...updates } : t));

        try {
            await fetch(`/api/video-tracks/${trackId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
        } catch (error) {
            console.error('Failed to update track:', error);
        }
    };

    const removeTrack = async (trackId: string): Promise<void> => {
        setTracks(prev => prev.filter(t => t.id !== trackId));
        setKeyframes(prev => {
            const updated = { ...prev };
            delete updated[trackId];
            return updated;
        });

        try {
            await fetch(`/api/video-tracks/${trackId}`, {
                method: 'DELETE',
            });
        } catch (error) {
            console.error('Failed to remove track:', error);
        }
    };

    const addKeyframe = async (keyframe: Omit<VideoKeyFrame, 'id'>): Promise<string> => {
        const newKeyframe: VideoKeyFrame = {
            ...keyframe,
            id: `keyframe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };

        setKeyframes(prev => ({
            ...prev,
            [keyframe.trackId]: [...(prev[keyframe.trackId] || []), newKeyframe],
        }));

        try {
            // Transform keyframe data to match API expectations
            const apiPayload = {
                trackId: newKeyframe.trackId,
                timestamp: newKeyframe.timestamp,
                duration: newKeyframe.duration,
                dataType: newKeyframe.data.type,
                mediaId: newKeyframe.data.mediaId,
                url: newKeyframe.data.url,
                prompt: newKeyframe.data.prompt || '',
                originalDuration: newKeyframe.data.originalDuration,
            };

            const response = await fetch('/api/video-keyframes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiPayload),
            });
            const data = await response.json();
            if (data.success && data.keyframe) {
                setKeyframes(prev => ({
                    ...prev,
                    [keyframe.trackId]: prev[keyframe.trackId].map(kf =>
                        kf.id === newKeyframe.id ? data.keyframe : kf
                    ),
                }));
                return data.keyframe.id;
            }
        } catch (error) {
            console.error('Failed to add keyframe:', error);
        }

        return newKeyframe.id;
    };

    const updateKeyframe = async (keyframeId: string, updates: Partial<VideoKeyFrame>): Promise<void> => {
        setKeyframes(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(trackId => {
                updated[trackId] = updated[trackId].map(kf =>
                    kf.id === keyframeId ? { ...kf, ...updates } : kf
                );
            });
            return updated;
        });

        try {
            // Transform updates for API - extract data fields to top level
            const apiUpdates: any = {};

            if (updates.timestamp !== undefined) apiUpdates.timestamp = updates.timestamp;
            if (updates.duration !== undefined) apiUpdates.duration = updates.duration;

            // Extract data fields to top level for API
            if (updates.data) {
                if (updates.data.type !== undefined) apiUpdates.dataType = updates.data.type;
                if (updates.data.mediaId !== undefined) apiUpdates.mediaId = updates.data.mediaId;
                if (updates.data.url !== undefined) apiUpdates.url = updates.data.url;
                if (updates.data.prompt !== undefined) apiUpdates.prompt = updates.data.prompt;
                if (updates.data.fitMode !== undefined) apiUpdates.fitMode = updates.data.fitMode;
                if (updates.data.volume !== undefined) apiUpdates.volume = updates.data.volume;
            }

            await fetch(`/api/video-keyframes/${keyframeId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiUpdates),
            });
        } catch (error) {
            console.error('Failed to update keyframe:', error);
        }
    };

    const removeKeyframe = async (keyframeId: string): Promise<void> => {
        setKeyframes(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(trackId => {
                updated[trackId] = updated[trackId].filter(kf => kf.id !== keyframeId);
            });
            return updated;
        });

        try {
            await fetch(`/api/video-keyframes/${keyframeId}`, {
                method: 'DELETE',
            });
        } catch (error) {
            console.error('Failed to remove keyframe:', error);
        }
    };

    const selectKeyframe = (keyframeId: string) => {
        // Single selection mode - replace existing selection
        setSelectedKeyframeIds([keyframeId]);
    };

    const deselectKeyframe = (keyframeId: string) => {
        setSelectedKeyframeIds(prev => prev.filter(id => id !== keyframeId));
    };

    const clearSelection = () => {
        setSelectedKeyframeIds([]);
    };

    return (
        <StudioContext.Provider value={{
            activeTool,
            setActiveTool,
            selectedModel,
            setSelectedModel,
            activeArtifactId,
            setActiveArtifactId,
            settings,
            updateSettings,

            // Jobs
            jobs,
            addJob,
            addCompletedJob,
            updateJobStatus,
            deleteJob,
            cancelJob,
            clearFinishedJobs,
            reuseJobInput,

            // Workspaces
            workspaces,
            activeWorkspaceId,
            createWorkspace,
            selectWorkspace,
            deleteWorkspace,

            // Video Editor State
            currentProject,
            projects,
            tracks,
            keyframes,
            player,
            playerState,
            currentTimestamp,
            zoom,
            selectedKeyframeIds,
            exportDialogOpen,

            // Video Editor Actions
            createProject,
            loadProject,
            updateProject,
            deleteProject,
            addTrack,
            updateTrack,
            removeTrack,
            addKeyframe,
            updateKeyframe,
            removeKeyframe,
            setPlayer,
            setPlayerState,
            setCurrentTimestamp,
            setZoom,
            selectKeyframe,
            deselectKeyframe,
            clearSelection,
            setExportDialogOpen,
        }}>
            {children}
        </StudioContext.Provider>
    );
}

export function useStudio() {
    const context = useContext(StudioContext);
    if (context === undefined) {
        throw new Error('useStudio must be used within a StudioProvider');
    }
    return context;
}
