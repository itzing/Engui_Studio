'use client';

export type CreateWorkflow = 'image' | 'video' | 'tts' | 'music';
export type CreateDraftVersion = 2;

export type CreateMediaRef =
  | {
      kind: 'remote-url';
      url: string;
      mimeType?: string;
      source?: 'scene' | 'gallery' | 'job' | 'external';
      sourceId?: string;
    }
  | {
      kind: 'gallery-asset';
      assetId: string;
      url: string;
      mimeType?: string;
    }
  | {
      kind: 'job-output';
      jobId: string;
      outputId?: string;
      url: string;
      mimeType?: string;
    }
  | {
      kind: 'idb-media';
      mediaId: string;
      fileName?: string;
      mimeType?: string;
      size?: number;
      lastModified?: number;
    };

export type CommonCreateDraftFields = {
  prompt?: string;
  showAdvanced?: boolean;
  parameterValues?: Record<string, unknown>;
};

export type ImageCreateDraftV2 = CommonCreateDraftFields & {
  randomizeSeed?: boolean | string | number;
  selectedSceneId?: string;
  inputs?: {
    primary?: CreateMediaRef | null;
    secondary?: CreateMediaRef | null;
  };
  previewUrl?: string;
  previewUrl2?: string;
};

export type VideoCreateDraftV2 = CommonCreateDraftFields & {
  inputs?: {
    image?: CreateMediaRef | null;
    video?: CreateMediaRef | null;
    audio?: CreateMediaRef | null;
  };
};

export type TtsCreateDraftV2 = CommonCreateDraftFields;
export type MusicCreateDraftV2 = CommonCreateDraftFields;

export type DraftEnvelope<TDraft = unknown> = {
  modelId: string;
  updatedAt: number;
  draft: TDraft;
};

export type WorkflowDraftBucket<TDraft = unknown> = {
  activeModel?: string;
  drafts: Record<string, DraftEnvelope<TDraft>>;
};

export type UnifiedCreateDraftState = {
  version: CreateDraftVersion;
  activeMode: CreateWorkflow;
  workflows: {
    image: WorkflowDraftBucket<ImageCreateDraftV2>;
    video: WorkflowDraftBucket<VideoCreateDraftV2>;
    tts: WorkflowDraftBucket<TtsCreateDraftV2>;
    music: WorkflowDraftBucket<MusicCreateDraftV2>;
  };
};

export const CREATE_DRAFT_STATE_VERSION: CreateDraftVersion = 2;
export const CREATE_DRAFT_STATE_STORAGE_KEY = 'engui.create.state.v2';
export const LEGACY_CREATE_DRAFT_STATE_STORAGE_KEY = 'engui.create.state.v1';

export const createEmptyWorkflowBucket = <TDraft = unknown>(): WorkflowDraftBucket<TDraft> => ({
  activeModel: undefined,
  drafts: {},
});

export const createDefaultUnifiedCreateDraftState = (): UnifiedCreateDraftState => ({
  version: CREATE_DRAFT_STATE_VERSION,
  activeMode: 'image',
  workflows: {
    image: createEmptyWorkflowBucket<ImageCreateDraftV2>(),
    video: createEmptyWorkflowBucket<VideoCreateDraftV2>(),
    tts: createEmptyWorkflowBucket<TtsCreateDraftV2>(),
    music: createEmptyWorkflowBucket<MusicCreateDraftV2>(),
  },
});
