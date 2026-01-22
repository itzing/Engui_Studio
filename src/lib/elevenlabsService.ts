export interface ElevenLabsConfig {
  apiKey: string;
  voiceId?: string;
  model?: string;
  stability?: number;
  similarity?: number;
  style?: number;
  useStreaming?: boolean;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  preview_url: string;
  description?: string;
  labels?: string[];
  settings?: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
  available_samples?: string[];
}

export interface ElevenLabsModel {
  model_id: string;
  name: string;
  description: string;
  type: string;
}

export interface ElevenLabsVoiceResponse {
  voices: ElevenLabsVoice[];
}

export interface ElevenLabsVoiceSampleResponse {
  audio_base64: string;
  text: string;
}

export interface ElevenLabsModelResponse {
  models: ElevenLabsModel[];
}

export interface ElevenLabsGenerationConfig {
  text: string;
  voice_id: string;
  model_id?: string;
  voice_settings?: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
}

export interface ElevenLabsMusicConfig {
  text: string;
  model_id: string;
  prompt_instrumentation?: string;
  prompt_genre?: string;
  prompt_tempo?: string;
  prompt_structure?: string;
  duration_seconds?: number;
}

class ElevenLabsService {
  private config: ElevenLabsConfig;

  constructor(config: ElevenLabsConfig) {
    this.config = config;
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    const headers = {
      'xi-api-key': this.config.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(`https://api.elevenlabs.io/v1/${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Eleven Labs API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async getVoices(): Promise<ElevenLabsVoiceResponse> {
    return this.fetchApi('voices');
  }

  async getModels(): Promise<ElevenLabsModelResponse> {
    return this.fetchApi('models');
  }

  async getVoice(voiceId: string): Promise<ElevenLabsVoice> {
    return this.fetchApi(`voices/${voiceId}`);
  }

  async getVoiceSamples(voiceId: string, sampleId?: string): Promise<ElevenLabsVoiceSampleResponse> {
    // Using the correct API endpoint as per Eleven Labs JS SDK
    // https://elevenlabs.io/docs/api-reference/voices/samples/get
    const endpoint = sampleId
      ? `voices/${voiceId}/samples/${sampleId}/audio`
      : `voices/${voiceId}/samples/audio`;

    const response = await this.fetchApi(endpoint);
    return response;
  }

  async getVoiceSampleIds(voiceId: string): Promise<string[]> {
    // Get available sample IDs for a voice
    const response = await this.fetchApi(`voices/${voiceId}/samples`);
    return response.samples || [];
  }

  async searchVoices(query: string): Promise<ElevenLabsVoiceResponse> {
    const params = new URLSearchParams({ query });
    return this.fetchApi(`voices/search?${params}`);
  }

  async generateSpeech(config: ElevenLabsGenerationConfig): Promise<Blob> {
    const voiceSettings = config.voice_settings || {
      stability: this.config.stability ?? 0.8,
      similarity_boost: this.config.similarity ?? 0.8,
      style: this.config.style ?? 0.0,
      use_speaker_boost: true,
    };

    const modelId = config.model_id || this.config.model || 'eleven_multilingual_v2';

    const response = await this.fetchApi('text-to-speech/' + config.voice_id, {
      method: 'POST',
      body: JSON.stringify({
        text: config.text,
        model_id: modelId,
        voice_settings: voiceSettings,
      }),
    });

    return response as Blob;
  }

  async generateMusic(config: ElevenLabsMusicConfig): Promise<Blob> {
    const response = await this.fetchApi('music', {
      method: 'POST',
      body: JSON.stringify({
        text: config.text,
        model_id: config.model_id,
        ...(config.prompt_instrumentation && { prompt_instrumentation: config.prompt_instrumentation }),
        ...(config.prompt_genre && { prompt_genre: config.prompt_genre }),
        ...(config.prompt_tempo && { prompt_tempo: config.prompt_tempo }),
        ...(config.prompt_structure && { prompt_structure: config.prompt_structure }),
        ...(config.duration_seconds && { duration_seconds: config.duration_seconds }),
      }),
    });

    return response as Blob;
  }

  async generateWithStreaming(config: ElevenLabsGenerationConfig, onAudioData: (chunk: ArrayBuffer) => void): Promise<void> {
    const voiceSettings = config.voice_settings || {
      stability: this.config.stability ?? 0.8,
      similarity_boost: this.config.similarity ?? 0.8,
      style: this.config.style ?? 0.0,
      use_speaker_boost: true,
    };

    const modelId = config.model_id || this.config.model || 'eleven_multilingual_v2';

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: config.text,
        model_id: modelId,
        voice_settings: voiceSettings,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Eleven Labs API Error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Failed to get stream reader');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        onAudioData(value);
      }
    }
  }

  async convertToAudio(
    text: string,
    voiceId?: string,
    modelId?: string,
    voiceSettings?: {
      stability?: number;
      similarity_boost?: number;
      style?: number;
      use_speaker_boost?: boolean;
    }
  ): Promise<Blob> {
    const config: ElevenLabsGenerationConfig = {
      text,
      voice_id: voiceId || this.config.voiceId || 'EXAVITQu4vr4xnSDxMaL',
      model_id,
      voice_settings: voiceSettings,
    };

    return this.generateSpeech(config);
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.apiKey) {
      errors.push('API key is required');
    }

    if (!this.config.voiceId) {
      errors.push('Voice ID is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default ElevenLabsService;
export { ElevenLabsService };