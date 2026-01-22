'use client';

import { useState, useEffect } from 'react';
import ElevenLabsService, { ElevenLabsVoice } from '@/lib/elevenlabsService';
import { useStudio } from '@/lib/context/StudioContext';

export interface VoiceWithSamples extends ElevenLabsVoice {
  samples?: { audio_base64: string; text: string };
  isLoadingSamples?: boolean;
}

export function useElevenLabsVoices() {
  const { settings } = useStudio();
  const [voices, setVoices] = useState<VoiceWithSamples[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elevenlabsService = settings.apiKeys?.elevenlabs
    ? new ElevenLabsService({ apiKey: settings.apiKeys.elevenlabs })
    : null;

  const fetchVoices = async () => {
    if (!elevenlabsService) return;

    setIsLoading(true);
    setError(null);
    console.log('🔄 fetchVoices called');

    try {
      const response = await elevenlabsService.getVoices();
      console.log('📋 Voices API response:', response);
      const voicesWithSamples: VoiceWithSamples[] = response.voices.map(voice => ({
        ...voice,
        isLoadingSamples: false
      }));
      setVoices(voicesWithSamples);
      console.log('✅ Voices loaded:', voicesWithSamples.length);
    } catch (err) {
      console.error('❌ Failed to fetch voices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch voices');
      setVoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVoiceSamples = async (voiceId: string) => {
    if (!elevenlabsService) {
      console.log('❌ elevenlabsService is null');
      return;
    }

    console.log('🔍 fetchVoiceSamples called with voiceId:', voiceId);
    console.log('🔍 Current voices count:', voices.length);

    // Prevent duplicate calls
    const voice = voices.find(v => v.voice_id === voiceId);
    if (voice?.isLoadingSamples) {
      console.log('⚠️ Voice already loading samples, skipping...');
      return;
    }

    // Force reload even if samples already exist
    console.log('🔄 Setting voice loading state...');
    setVoices(prev => prev.map(v =>
      v.voice_id === voiceId
        ? { ...v, isLoadingSamples: true, samples: undefined }
        : v
    ));

    try {
      console.log('🔍 Starting to fetch voice samples for:', voiceId);

      // First try to get samples using the new API format
      try {
        console.log('📋 Step 1: Getting sample IDs...');
        const sampleResponse = await elevenlabsService.fetchApi(`voices/${voiceId}/samples`);
        console.log('📋 Sample IDs response:', sampleResponse);

        if (sampleResponse && sampleResponse.samples && sampleResponse.samples.length > 0) {
          const sampleId = sampleResponse.samples[0];
          console.log('🎵 Step 2: Getting sample audio for ID:', sampleId);

          const audioResponse = await elevenlabsService.fetchApi(`voices/${voiceId}/samples/${sampleId}/audio`);
          console.log('🎵 Audio response:', audioResponse);

          if (audioResponse && audioResponse.audio_base64) {
            console.log('✅ Successfully loaded voice sample, length:', audioResponse.audio_base64.length);
            setVoices(prev => prev.map(v =>
              v.voice_id === voiceId
                ? { ...v, samples: { audio_base64: audioResponse.audio_base64, text: audioResponse.text || "Voice preview" }, isLoadingSamples: false }
                : v
            ));
            console.log('✅ Successfully loaded voice sample');
            return;
          } else {
            console.log('❌ No audio_base64 in response:', audioResponse);
          }
        } else {
          console.log('⚠️ No samples found in response, trying fallback...');
        }
      } catch (sampleError) {
        console.log('❌ Sample API failed, trying fallback:', sampleError);
      }

      // Fallback to preview URL
      try {
        console.log('🔄 Step 3: Trying fallback to preview URL...');
        const voiceDetails = await elevenlabsService.getVoice(voiceId);
        console.log('📄 Voice details:', voiceDetails);

        if (voiceDetails.preview_url) {
          console.log('🌐 Fetching preview from:', voiceDetails.preview_url);
          const previewResponse = await fetch(voiceDetails.preview_url);

          if (!previewResponse.ok) {
            throw new Error(`Failed to fetch audio: ${previewResponse.status}`);
          }

          const blob = await previewResponse.blob();
          console.log('📦 Got blob, size:', blob.size);

          return new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = (reader.result as string).split(',')[1];
              console.log('🔤 Converted to base64, length:', base64.length);
              setVoices(prev => prev.map(v =>
                v.voice_id === voiceId
                  ? { ...v, samples: { audio_base64: base64, text: "Voice preview" }, isLoadingSamples: false }
                  : v
              ));
              console.log('✅ Fallback: Successfully loaded voice sample');
              resolve();
            };
            reader.onerror = () => {
              console.error('❌ Error reading audio file');
              setVoices(prev => prev.map(v =>
                v.voice_id === voiceId
                  ? { ...v, isLoadingSamples: false }
                  : v
              ));
              reject(new Error('Failed to read audio file'));
            };
            reader.readAsDataURL(blob);
          });
        } else {
          console.log('⚠️ No preview_url found');
          setVoices(prev => prev.map(v =>
            v.voice_id === voiceId
              ? { ...v, isLoadingSamples: false }
              : v
          ));
        }
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        setVoices(prev => prev.map(v =>
          v.voice_id === voiceId
            ? { ...v, isLoadingSamples: false }
            : v
        ));
      }
    } catch (error) {
      console.error('❌ Main error in fetchVoiceSamples:', error);
      setVoices(prev => prev.map(v =>
        v.voice_id === voiceId
          ? { ...v, isLoadingSamples: false }
          : v
      ));
    }
  };

  const playSample = (voiceId: string) => {
    const voice = voices.find(v => v.voice_id === voiceId);
    if (voice?.samples?.audio_base64) {
      // Create proper data URL with base64
      const dataUrl = `data:audio/mpeg;base64,${voice.samples.audio_base64}`;
      const audio = new Audio(dataUrl);
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
      });
    }
  };

  useEffect(() => {
    console.log('🎵 useElevenLabsVoices useEffect triggered:', { hasApiKey: !!settings.apiKeys?.elevenlabs });
    if (settings.apiKeys?.elevenlabs) {
      console.log('🔑 API key found, fetching voices...');
      fetchVoices();
    } else {
      console.log('❌ No API key found for Eleven Labs');
    }
  }, [settings.apiKeys?.elevenlabs]);

  return {
    voices,
    isLoading,
    error,
    fetchVoices,
    fetchVoiceSamples,
    playSample,
    refetch: fetchVoices
  };
}