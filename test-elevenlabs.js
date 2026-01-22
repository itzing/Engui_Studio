#!/usr/bin/env node

const ElevenLabsService = require('./src/lib/elevenlabsService.ts');

// Test configuration
const config = {
  apiKey: process.env.ELEVENLABS_API_KEY || 'your-api-key-here',
  voiceId: 'EXAVITQu4vr4xnSDxMaL',
  model: 'eleven_multilingual_v2',
  stability: 0.8,
  similarity: 0.8,
  style: 0.0,
  useStreaming: false,
};

async function testElevenLabs() {
  console.log('🎵 Testing Eleven Labs integration...\n');

  const elevenlabsService = new ElevenLabsService(config);

  try {
    // Test 1: Check configuration
    console.log('📝 Testing configuration validation...');
    const validation = elevenlabsService.validateConfig();
    if (!validation.valid) {
      console.error('❌ Configuration validation failed:', validation.errors);
      process.exit(1);
    }
    console.log('✅ Configuration validation passed\n');

    // Test 2: Get available voices
    console.log('🎤 Testing voice listing...');
    const voices = await elevenlabsService.getVoices();
    console.log(`✅ Found ${voices.voices.length} voices`);
    console.log('Sample voices:', voices.voices.slice(0, 3).map(v => ({ id: v.voice_id, name: v.name })));
    console.log();

    // Test 3: Get available models
    console.log('🎼 Testing model listing...');
    const models = await elevenlabsService.getModels();
    console.log(`✅ Found ${models.models.length} models`);
    console.log('Sample models:', models.models.slice(0, 3).map(m => ({ id: m.model_id, name: m.name })));
    console.log();

    // Test 4: Generate TTS (if API key is provided)
    if (config.apiKey && config.apiKey !== 'your-api-key-here') {
      console.log('🗣️ Testing TTS generation...');
      const ttsConfig = {
        text: "Hello, this is a test of Eleven Labs text-to-speech functionality.",
        voice_id: config.voiceId,
        model_id: config.model,
        voice_settings: {
          stability: config.stability,
          similarity_boost: config.similarity,
          style: config.style,
          use_speaker_boost: true,
        },
      };

      const audioBlob = await elevenlabsService.generateSpeech(ttsConfig);
      console.log(`✅ TTS generation successful, audio size: ${audioBlob.size} bytes`);
      console.log('Audio format:', audioBlob.type);
    } else {
      console.log('⚠️ Skipping TTS test - no API key provided');
    }

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
testElevenLabs();