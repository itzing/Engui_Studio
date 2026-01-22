'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n/context';
import { getModelsByType } from '@/lib/models/modelConfig';
import { useStudio } from '@/lib/context/StudioContext';
import { useElevenLabsVoices } from '@/hooks/useElevenLabsVoices';
import { PlayIcon, SpeakerWaveIcon } from '@heroicons/react/24/outline';

export default function AudioGenerationForm() {
    const { t } = useI18n();
    const { settings, addJob, activeWorkspaceId } = useStudio();
    const [prompt, setPrompt] = useState('');
    const [selectedModel, setSelectedModel] = useState('elevenlabs-tts');
    const [isGenerating, setIsGenerating] = useState(false);

    console.log('🎵 AudioGenerationForm mounted with settings:', { hasApiKey: !!settings.apiKeys?.elevenlabs, selectedModel });

    const ttsModels = getModelsByType('tts');
    const [selectedVoice, setSelectedVoice] = useState('');
    const { voices, isLoading, fetchVoiceSamples, playSample } = useElevenLabsVoices();

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            alert('Please enter a text prompt');
            return;
        }

        const model = ttsModels.find(m => m.id === selectedModel);
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
                formData.append('modelId', 'eleven_multilingual_v2');
                formData.append('stability', '0.8');
                formData.append('similarity', '0.8');
                formData.append('style', '0.0');
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
                    type: 'audio',
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
                <label className="text-sm font-medium">Voice Model</label>
                <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full p-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    {ttsModels.map((model) => (
                        <option key={model.id} value={model.id}>
                            {model.name} ({model.provider})
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Text to Speech</label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter text to convert to speech..."
                    rows={4}
                    className="w-full p-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {selectedModel === 'elevenlabs-tts' && (
                <div className="space-y-2">
                    <label className="text-sm font-medium">Voice</label>
                    <select
                        value={selectedVoice}
                        onChange={(e) => {
                            const voiceId = e.target.value;
                            console.log('🎤 Voice selected:', voiceId);
                            setSelectedVoice(voiceId);
                        }}
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

                    {/* Always show speaker button section when voices are available */}
                    {voices.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                    {selectedVoice
                                        ? (voices.find(v => v.voice_id === selectedVoice)?.description || '')
                                        : 'Select a voice to load samples'
                                    }
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log('🔊 Speaker button clicked for voice:', selectedVoice);
                                            console.log('🎯 fetchVoiceSamples function:', typeof fetchVoiceSamples);
                                            if (fetchVoiceSamples) {
                                                fetchVoiceSamples(selectedVoice);
                                            }
                                        }}
                                        className="p-1 hover:bg-green-600 text-white rounded transition-colors disabled:hover:bg-muted disabled:opacity-50 disabled:text-muted-foreground"
                                        title="Load sample"
                                        disabled={!selectedVoice}
                                        data-testid="speaker-button"
                                    >
                                        <SpeakerWaveIcon className="w-4 h-4" />
                                    </button>
                                    <div className="text-xs text-red-500 font-bold">
                                        Click speaker to load sample
                                    </div>
                                    <button
                                        onClick={() => {
                                            // Clear existing samples and reload
                                            const updatedVoices = voices.map(v =>
                                                v.voice_id === selectedVoice
                                                    ? { ...v, samples: undefined, isLoadingSamples: false }
                                                    : v
                                            );
                                            // This is a workaround - we'll need to update the hook state
                                            console.log('🔄 Cleared existing samples');
                                        }}
                                        className="text-xs text-blue-500 hover:text-blue-700 underline"
                                    >
                                        Refresh
                                    </button>
                                </div>
                            </div>

                            {selectedVoice && voices.find(v => v.voice_id === selectedVoice)?.isLoadingSamples && (
                                <div className="text-xs text-muted-foreground">Loading sample...</div>
                            )}

                            {selectedVoice && (
                                <div className="space-y-1">
                                    {(() => {
                                        const voice = voices.find(v => v.voice_id === selectedVoice);
                                        const hasSamples = voice?.samples;
                                        console.log('🎵 Voice debug:', {
                                            voiceId: selectedVoice,
                                            hasSamples,
                                            sampleLength: hasSamples ? voice.samples.audio_base64?.length : 0
                                        });
                                        return hasSamples ? (
                                            <>
                                                <audio
                                                    controls
                                                    className="w-full h-8"
                                                    src={`data:audio/mpeg;base64,${voice.samples.audio_base64}`}
                                                />
                                                <div className="text-xs text-muted-foreground">
                                                    Sample: "{voice.samples.text}"
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-xs text-muted-foreground">No samples loaded</div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

                    {/* Debug info */}
                    <div className="text-xs text-muted-foreground">
                        Debug: voices={voices.length}, selectedVoice={selectedVoice || 'none'}, selectedModel={selectedModel}
                    </div>

            <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim() || (selectedModel === 'elevenlabs-tts' && (!settings.apiKeys?.elevenlabs || !selectedVoice))}
                className="w-full"
            >
                <PlayIcon className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate Speech'}
            </Button>

            {!settings.apiKeys?.elevenlabs && (
                <div className="p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg text-sm text-yellow-200">
                    ⚠️ Please configure Eleven Labs API key in Settings → General
                </div>
            )}
        </div>
    );
}