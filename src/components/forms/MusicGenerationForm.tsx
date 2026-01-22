'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n/context';
import { getModelsByType } from '@/lib/models/modelConfig';
import { useStudio } from '@/lib/context/StudioContext';
import { useElevenLabsVoices } from '@/hooks/useElevenLabsVoices';
import { MusicalNoteIcon, SpeakerWaveIcon } from '@heroicons/react/24/outline';

export default function MusicGenerationForm() {
    const { t } = useI18n();
    const { settings, addJob, activeWorkspaceId } = useStudio();
    const [prompt, setPrompt] = useState('');
    const [selectedModel, setSelectedModel] = useState('elevenlabs-music');
    const [duration, setDuration] = useState(60);
    const [isGenerating, setIsGenerating] = useState(false);

    const musicModels = getModelsByType('music');
    const [selectedVoice, setSelectedVoice] = useState('');
    const { voices, isLoading, fetchVoiceSamples, playSample } = useElevenLabsVoices();

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            alert('Please enter a music prompt');
            return;
        }

        const model = musicModels.find(m => m.id === selectedModel);
        if (!model) {
            alert('Invalid model selected');
            return;
        }

        if (model.provider === 'Eleven Labs' && !settings.apiKeys?.elevenlabs) {
            alert('Please configure Eleven Labs API key in settings');
            return;
        }

        if (model.provider === 'Eleven Labs' && !selectedVoice) {
            alert('Please select a voice');
            return;
        }

        setIsGenerating(true);
        try {
            // Construct FormData for API submission
            const formData = new FormData();
            formData.append('userId', 'user-with-settings');
            formData.append('modelId', model.id);
            formData.append('prompt', prompt.trim());

            // Add workspace ID
            if (activeWorkspaceId) {
                formData.append('workspaceId', activeWorkspaceId);
            }

            // Add Eleven Labs specific parameters
            if (model.provider === 'Eleven Labs') {
                formData.append('voiceId', selectedVoice);
                formData.append('modelId', 'music_generator_v2');
                formData.append('duration_seconds', duration.toString());
            }

            // Construct Headers from Settings
            const headers: Record<string, string> = {};
            if (settings.apiKeys.elevenlabs) headers['X-ElevenLabs-Key'] = settings.apiKeys.elevenlabs;
            if (settings.apiKeys.openai) headers['X-OpenAI-Key'] = settings.apiKeys.openai;
            if (settings.apiKeys.google) headers['X-Google-Key'] = settings.apiKeys.google;
            if (settings.apiKeys.kling) headers['X-Kling-Key'] = settings.apiKeys.kling;
            if (settings.apiKeys.runpod) headers['X-RunPod-Key'] = settings.apiKeys.runpod;

            // Use unified API route for all models
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: headers,
                body: formData,
            });

            const data = await response.json();

            if (response && response.ok && data.success) {
                console.log('Generation started successfully', data);

                // Add job to context
                addJob({
                    id: data.jobId,
                    modelId: model.id,
                    type: 'audio', // Music is treated as audio
                    status: 'queued',
                    prompt: prompt,
                    createdAt: Date.now(),
                    endpointId: headers['X-RunPod-Endpoint-Id']
                });
            } else {
                console.error('Generation failed', data);
                alert(data.error || 'Generation failed');
            }

        } catch (error) {
            console.error('Error submitting form:', error);
            alert('An unexpected error occurred');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">Music Model</label>
                <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full p-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    {musicModels.map((model) => (
                        <option key={model.id} value={model.id}>
                            {model.name} ({model.provider})
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Music Description</label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the music you want to create (e.g., 'upbeat electronic music with piano melody')"
                    rows={4}
                    className="w-full p-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {selectedModel === 'elevenlabs-music' && (
                <div className="space-y-2">
                    <label className="text-sm font-medium">Voice</label>
                    <select
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="w-full p-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        disabled={isLoading}
                    >
                        <option value="">Select a voice</option>
                        {voices.map((voice) => (
                            <option key={voice.voice_id} value={voice.voice_id}>
                                {voice.name} ({voice.category})
                            </option>
                        ))}
                        {isLoading && voices.length === 0 && (
                            <option value="">Loading voices...</option>
                        )}
                    </select>

                    {voices.length > 0 && selectedVoice && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                    {voices.find(v => v.voice_id === selectedVoice)?.description || ''}
                                </span>
                                <button
                                    onClick={() => {
                                        fetchVoiceSamples(selectedVoice);
                                    }}
                                    className="p-1 hover:bg-muted rounded transition-colors"
                                    title="Load sample"
                                >
                                    <SpeakerWaveIcon className="w-4 h-4" />
                                </button>
                            </div>

                            {voices.find(v => v.voice_id === selectedVoice)?.isLoadingSamples && (
                                <div className="text-xs text-muted-foreground">Loading sample...</div>
                            )}

                            {voices.find(v => v.voice_id === selectedVoice)?.samples && (
                                <div className="space-y-1">
                                    <audio
                                        controls
                                        className="w-full h-8"
                                        src={`data:audio/mpeg;base64,${voices.find(v => v.voice_id === selectedVoice)?.samples?.audio_base64}`}
                                    />
                                    <div className="text-xs text-muted-foreground">
                                        Sample: "{voices.find(v => v.voice_id === selectedVoice)?.samples?.text}"
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-2">
                <label className="text-sm font-medium">Duration (seconds)</label>
                <Input
                    type="number"
                    min="30"
                    max="300"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Duration must be between 30 and 300 seconds</p>
            </div>

            <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim() || (selectedModel === 'elevenlabs-music' && (!settings.apiKeys?.elevenlabs || !selectedVoice))}
                className="w-full"
            >
                <MusicalNoteIcon className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating Music...' : 'Generate Music'}
            </Button>

            {!settings.apiKeys?.elevenlabs && (
                <div className="p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg text-sm text-yellow-200">
                    ⚠️ Please configure Eleven Labs API key in Settings → General
                </div>
            )}
        </div>
    );
}