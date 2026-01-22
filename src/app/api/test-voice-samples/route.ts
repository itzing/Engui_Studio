import { NextRequest, NextResponse } from 'next/server';
import ElevenLabsService from '@/lib/elevenlabsService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const voiceId = searchParams.get('voiceId');
    const apiKey = request.headers.get('xi-api-key');

    if (!voiceId) {
      return NextResponse.json({ error: 'Voice ID is required' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'Eleven Labs API key is required' }, { status: 401 });
    }

    const service = new ElevenLabsService({ apiKey });

    // Test different endpoints
    const results = {
      voiceId,
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Get voice samples endpoint
    try {
      const samplesResponse = await service.fetchApi(`voices/${voiceId}/samples`);
      results.tests.samples = {
        success: true,
        data: samplesResponse,
        sampleCount: samplesResponse?.samples?.length || 0
      };
    } catch (error) {
      results.tests.samples = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 2: Get voice details
    try {
      const voiceDetails = await service.getVoice(voiceId);
      results.tests.voiceDetails = {
        success: true,
        data: {
          name: voiceDetails.name,
          category: voiceDetails.category,
          hasPreviewUrl: !!voiceDetails.preview_url,
          availableSamples: voiceDetails.available_samples
        }
      };
    } catch (error) {
      results.tests.voiceDetails = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 3: Try to get audio with first sample if available
    try {
      const samplesResponse = await service.fetchApi(`voices/${voiceId}/samples`);
      if (samplesResponse?.samples?.length > 0) {
        const sampleId = samplesResponse.samples[0];
        const audioResponse = await service.fetchApi(`voices/${voiceId}/samples/${sampleId}/audio`);
        results.tests.audioSample = {
          success: true,
          sampleId,
          hasAudioBase64: !!audioResponse?.audio_base64,
          audioLength: audioResponse?.audio_base64?.length || 0,
          hasText: !!audioResponse?.text
        };
      }
    } catch (error) {
      results.tests.audioSample = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}