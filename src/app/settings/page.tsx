'use client';

import { useState, useEffect } from 'react';
import {
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  LanguageIcon
} from '@heroicons/react/24/outline';
import { useI18n } from '@/lib/i18n/context';
import { MODELS } from '@/lib/models/modelConfig';

interface ServiceConfig {
  runpod: {
    apiKey: string;
    endpoints: {
      image: string;
      video: string;
      multitalk: string;
      'flux-kontext': string; // FLUX KONTEXT endpoint 추가
      'flux-krea': string; // FLUX KREA endpoint 추가
      wan22: string; // WAN 2.2 endpoint 추가
      'wan-animate': string; // WAN Animate endpoint 추가
      'infinite-talk': string; // Infinite Talk endpoint 추가
      'video-upscale': string; // Video Upscale endpoint 추가
      'qwen-image-edit': string; // Qwen Image Edit endpoint 추가
    };
    generateTimeout?: number; // RunPod AI 생성 작업 타임아웃 (초 단위)
  };
  elevenlabs: {
    apiKey: string;
    voiceId?: string;
    model?: string;
    stability?: number;
    similarity?: number;
    style?: number;
    useStreaming?: boolean;
  };
  s3: {
    endpointUrl: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    region: string;
    timeout: number;
    useGlobalNetworking?: boolean;
  };
}

interface ServiceStatus {
  runpod: 'configured' | 'partial' | 'missing';
  elevenlabs: 'configured' | 'partial' | 'missing';
  s3: 'configured' | 'partial' | 'missing';
}

interface TestResult {
  success: boolean;
  message: string;
  responseTime?: number; // 응답 시간 추가
  statusCode?: number; // 상태 코드 추가
  details?: {
    responseTime: number;
    statusCode?: number;
    endpoint: string;
  };
  error?: string;
}

export default function SettingsPage() {
  const { language, setLanguage, t } = useI18n();
  
  // modelConfig에서 RunPod 모델들을 가져오기
  const runpodModels = MODELS.filter(model => model.api.type === 'runpod');
  console.log('🔍 RunPod Models:', runpodModels.length, runpodModels.map(m => m.id));
  
  const [settings, setSettings] = useState<Partial<ServiceConfig>>({
    runpod: {
      apiKey: '',
      endpoints: {
        image: '',
        video: '',
        multitalk: '',
        'flux-kontext': '', // FLUX KONTEXT endpoint 추가
        'flux-krea': '', // FLUX KREA endpoint 추가
        wan22: '', // WAN 2.2 endpoint 추가
        'wan-animate': '', // WAN Animate endpoint 추가
        'infinite-talk': '', // Infinite Talk endpoint 추가
        'video-upscale': '', // Video Upscale endpoint 추가
        'qwen-image-edit': '' // Qwen Image Edit endpoint 추가
      },
      generateTimeout: 3600 // 기본값 3600초 (1시간)
    },
    elevenlabs: {
      apiKey: '',
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
      model: 'eleven_multilingual_v2',
      stability: 0.8,
      similarity: 0.8,
      style: 0.0,
      useStreaming: false
    },
    s3: {
      endpointUrl: '',
      accessKeyId: '',
      secretAccessKey: '',
      bucketName: '',
      region: '',
      timeout: 3600,
      useGlobalNetworking: false
    }
  });
  
  const [status, setStatus] = useState<ServiceStatus>({
    runpod: 'missing',
    elevenlabs: 'missing',
    s3: 'missing'
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const clearDatabase = async () => {
    if (!confirm(t('settings.clearDatabaseWarning'))) {
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      
      const response = await fetch('/api/settings/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: t('settings.databaseCleared', { count: data.clearedCount }) });
        // Reload settings after clearing
        await loadSettings();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `${t('settings.databaseClearFailed')} ${error}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const testConnection = async (service: 'runpod' | 'elevenlabs' | 's3', endpoint?: string) => {
    const testKey = endpoint ? `${service}-${endpoint}` : service;

    try {
      setTesting(prev => ({ ...prev, [testKey]: true }));
      setTestResults(prev => ({ ...prev, [testKey]: { success: false, message: 'Testing...' } }));

      const config = service === 'runpod'
        ? { apiKey: settings.runpod?.apiKey }
        : service === 'elevenlabs'
        ? { apiKey: settings.elevenlabs?.apiKey }
        : settings.s3;

      const response = await fetch('/api/settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service,
          config,
          endpoint
        }),
      });

      const result = await response.json();
      setTestResults(prev => ({ ...prev, [testKey]: result }));

    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [testKey]: {
          success: false,
          message: 'Test failed',
          error: `${error}`
        }
      }));
    } finally {
      setTesting(prev => ({ ...prev, [testKey]: false }));
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/settings');
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.settings);
        setStatus(data.status);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to load settings: ${error}` });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.settings);
        setStatus(data.status);
        setMessage({ type: 'success', text: t('settings.settingsSaved') });
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to save settings: ${error}` });
    } finally {
      setSaving(false);
    }
  };

  
  // Endpoint 테스트 함수
  const testEndpoint = async (endpointType: 'multitalk' | 'flux-kontext' | 'flux-krea' | 'wan22' | 'wan-animate' | 'infinite-talk' | 'video-upscale' | 'qwen-image-edit') => {
    if (!settings.runpod?.apiKey || !settings.runpod?.endpoints?.[endpointType]) {
      return;
    }

    setTesting(prev => ({ ...prev, [endpointType]: true }));
    
    try {
      const startTime = Date.now();
      const response = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'runpod',
          endpointType,
          apiKey: settings.runpod.apiKey,
          endpointId: settings.runpod.endpoints[endpointType]
        })
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      if (response.ok) {
        setTestResults(prev => ({
          ...prev,
          [endpointType]: {
            success: true,
            message: t('settings.connectionSuccess'),
            responseTime,
            statusCode: response.status
          }
        }));
      } else {
        const errorData = await response.json();
        setTestResults(prev => ({
          ...prev,
          [endpointType]: {
            success: false,
            message: `${t('settings.connectionFailed')} ${errorData.error || 'Unknown error'}`,
            responseTime,
            statusCode: response.status
          }
        }));
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [endpointType]: {
          success: false,
          message: `${t('settings.connectionError')} ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseTime: 0,
          statusCode: 0
        }
      }));
    } finally {
      setTesting(prev => ({ ...prev, [endpointType]: false }));
    }
  };

  const updateSetting = (service: 'runpod' | 'elevenlabs' | 's3', key: string, value: string | number, subKey?: string) => {
    let finalValue = value;

    // S3 region을 자동으로 소문자로 변환
    if (service === 's3' && key === 'region' && typeof value === 'string') {
      finalValue = value.toLowerCase();
    }

    setSettings(prev => ({
      ...prev,
      [service]: {
        ...prev[service],
        ...(subKey
          ? { [key]: { ...(prev[service] as any)?.[key], [subKey]: finalValue } }
          : { [key]: finalValue }
        )
      }
    } as any));
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Mask sensitive data: show first 4 characters, rest as asterisks
  const maskSensitiveValue = (value: string, show: boolean): string => {
    if (!value || show) return value;
    if (value.length <= 4) return '*'.repeat(value.length);
    return value.substring(0, 4) + '*'.repeat(value.length - 4);
  };

  const getStatusIcon = (serviceStatus: 'configured' | 'partial' | 'missing') => {
    switch (serviceStatus) {
      case 'configured':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'partial':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'missing':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusText = (serviceStatus: 'configured' | 'partial' | 'missing') => {
    switch (serviceStatus) {
      case 'configured':
        return t('settings.fullyConfigured');
      case 'partial':
        return t('settings.partiallyConfigured');
      case 'missing':
        return t('settings.notConfigured');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">{t('settings.loading')}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <CogIcon className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-900/50 border border-green-500 text-green-200'
              : 'bg-red-900/50 border border-red-500 text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Language Selector */}
        <div className="mb-6 bg-secondary p-6 rounded-lg border border-border">
          <div className="flex items-center gap-3 mb-4">
            <LanguageIcon className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold">{t('language.selectLanguage')}</h2>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setLanguage('ko')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                language === 'ko'
                  ? 'bg-primary text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t('language.korean')}
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                language === 'en'
                  ? 'bg-primary text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t('language.english')}
            </button>
          </div>
        </div>

        {/* 간단한 사용 안내 */}
        <div className="mb-6 p-4 bg-green-900/30 border border-green-500/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-300 font-medium">✅ {t('settings.simpleSetup')}</span>
          </div>
          <div className="text-sm text-green-200">
            <p className="mb-2">{t('settings.personalUse')}</p>
            <div className="text-xs text-green-300">
              💡 <strong>{t('settings.howToUse')}</strong>: {t('settings.howToUseDesc')}
            </div>
          </div>
        </div>

        {/* RunPod Configuration */}
        <div className="mb-8 bg-secondary p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              RunPod Configuration
              {getStatusIcon(status.runpod)}
              <span className="text-sm font-normal text-foreground/70">
                {getStatusText(status.runpod)}
              </span>
            </h2>
          </div>

          <div className="space-y-4">
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium mb-2">RunPod API Key</label>
              <input
                type="password"
                value={settings.runpod?.apiKey || ''}
                onChange={(e) => updateSetting('runpod', 'apiKey', e.target.value)}
                placeholder="Enter your RunPod API key"
                className="w-full p-2 border rounded-md bg-background"
              />
            </div>

            {/* Generate Timeout */}
            <div>
              <label className="block text-sm font-medium mb-2">{t('settings.generateTimeout')}</label>
              <input
                type="number"
                value={settings.runpod?.generateTimeout || 3600}
                onChange={(e) => updateSetting('runpod', 'generateTimeout', parseInt(e.target.value))}
                placeholder="3600"
                className="w-full p-2 border rounded-md bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('settings.generateTimeoutDesc')}
              </p>
            </div>

            {/* RunPod Model Endpoints - 동적 생성 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {runpodModels.map((model) => (
                <div key={model.id}>
                <label className="block text-sm font-medium mb-2">{model.name} Endpoint ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={(settings.runpod?.endpoints as any)?.[model.id] || ''}
                    onChange={(e) => updateSetting('runpod', 'endpoints', e.target.value, model.id)}
                    placeholder={`Enter ${model.name} endpoint ID`}
                    className="flex-1 p-2 border rounded-md bg-background"
                  />
                  <button
                    onClick={() => testEndpoint(model.id as any)}
                    disabled={!settings.runpod?.apiKey || !(settings.runpod?.endpoints as any)?.[model.id] || testing[model.id]}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {testing[model.id] ? 'Testing...' : 'Test'}
                  </button>
                </div>
                {testResults[model.id] && (
                  <div className={`mt-2 p-2 rounded-md text-sm ${
                    testResults[model.id].success
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}>
                    {testResults[model.id].message}
                    {testResults[model.id].responseTime && (
                      <span className="ml-2">({testResults[model.id].responseTime}ms)</span>
                    )}
                    {testResults[model.id].statusCode && (
                      <span className="ml-2">Status: {testResults[model.id].statusCode}</span>
                    )}
                  </div>
                )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Eleven Labs Configuration */}
        <div className="mb-8 bg-secondary p-6 rounded-lg border border-border border-purple-500/30 shadow-lg shadow-purple-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
              <h2 className="text-xl font-semibold text-purple-300 flex items-center gap-2">
                Eleven Labs Configuration
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(status.elevenlabs)}
              <span className="text-sm font-normal text-foreground/70">
                {getStatusText(status.elevenlabs)}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium mb-2">Eleven Labs API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showSecrets['elevenlabs-api-key'] ? 'text' : 'password'}
                    value={settings.elevenlabs?.apiKey || ''}
                    onChange={(e) => updateSetting('elevenlabs', 'apiKey', e.target.value)}
                    placeholder="Enter your Eleven Labs API key"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecretVisibility('elevenlabs-api-key')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-foreground/60 hover:text-foreground"
                  >
                    {showSecrets['elevenlabs-api-key'] ? (
                      <EyeSlashIcon className="w-4 h-4" />
                    ) : (
                      <EyeIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => testConnection('elevenlabs')}
                  disabled={!settings.elevenlabs?.apiKey || testing['elevenlabs']}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {testing['elevenlabs'] ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
              {testResults['elevenlabs'] && (
                <div className={`mt-2 p-2 rounded-md text-sm ${
                  testResults['elevenlabs'].success
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {testResults['elevenlabs'].message}
                  {testResults['elevenlabs'].responseTime && (
                    <span className="ml-2">({testResults['elevenlabs'].responseTime}ms)</span>
                  )}
                  {testResults['elevenlabs'].statusCode && (
                    <span className="ml-2">Status: {testResults['elevenlabs'].statusCode}</span>
                  )}
                </div>
              )}
            </div>

            {/* Voice Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Voice ID</label>
              <input
                type="text"
                value={settings.elevenlabs?.voiceId || ''}
                onChange={(e) => updateSetting('elevenlabs', 'voiceId', e.target.value)}
                placeholder="EXAVITQu4vr4xnSDxMaL"
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                You can find voice IDs in the Eleven Labs dashboard
              </p>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Model</label>
              <select
                value={settings.elevenlabs?.model || 'eleven_multilingual_v2'}
                onChange={(e) => updateSetting('elevenlabs', 'model', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="eleven_multilingual_v2">Multilingual V2</option>
                <option value="eleven_english_v2">English V2</option>
                <option value="eleven_turbo_v2">Turbo V2</option>
                <option value="eleven_monolingual_v1">Monolingual V1</option>
              </select>
            </div>

            {/* Voice Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Stability</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.elevenlabs?.stability || 0.8}
                  onChange={(e) => updateSetting('elevenlabs', 'stability', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  How stable the voice should be (0-1)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Similarity</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.elevenlabs?.similarity || 0.8}
                  onChange={(e) => updateSetting('elevenlabs', 'similarity', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  How similar to the original voice (0-1)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Style</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.elevenlabs?.style || 0.0}
                  onChange={(e) => updateSetting('elevenlabs', 'style', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  How much style to apply (0-1)
                </p>
              </div>
            </div>

            {/* Streaming Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium mb-2">Use Streaming</label>
                <p className="text-xs text-muted-foreground">
                  Enable streaming for real-time audio generation
                </p>
              </div>
              <button
                onClick={() => updateSetting('elevenlabs', 'useStreaming', (!settings.elevenlabs?.useStreaming) ? 1 : 0)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  settings.elevenlabs?.useStreaming
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                {settings.elevenlabs?.useStreaming ? '✅ Enabled' : '🔒 Disabled'}
              </button>
            </div>
          </div>
        </div>

        {/* S3 Configuration */}
        <div className="mb-8 bg-secondary p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              S3 Storage Configuration
              {getStatusIcon(status.s3)}
              <span className="text-sm font-normal text-foreground/70">
                {getStatusText(status.s3)}
              </span>
            </h2>
          </div>

          {/* Global Network Toggle */}
          <div className="mb-6 p-4 bg-background border border-border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Global Network Mode
                </label>
                <p className="text-xs text-foreground/60">
                  {settings.s3?.useGlobalNetworking
                    ? '✅ Global network mode enabled - Uses direct API calls'
                    : '⚠️ Local network mode - Uses AWS CLI with standard networking'}
                </p>
              </div>
              <button
                onClick={() => updateSetting('s3', 'useGlobalNetworking', (!settings.s3?.useGlobalNetworking) ? 1 : 0)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  settings.s3?.useGlobalNetworking
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                {settings.s3?.useGlobalNetworking ? '🌍 Enabled' : '🔒 Disabled'}
              </button>
            </div>
            <div className="mt-3 p-3 bg-secondary border border-border rounded text-xs text-foreground/70">
              <strong>📋 Upload Methods:</strong>
              <ul className="mt-2 space-y-1">
                <li>• <strong>Global Network (Enabled):</strong> Direct S3 API calls with global network access</li>
                <li>• <strong>Local Network (Disabled):</strong> AWS CLI-based uploads suitable for restricted networks</li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Endpoint URL
              </label>
              <input
                type="text"
                value={settings.s3?.endpointUrl || ''}
                onChange={(e) => updateSetting('s3', 'endpointUrl', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="https://s3api-region.runpod.io/"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Region
              </label>
              <input
                type="text"
                value={settings.s3?.region || ''}
                onChange={(e) => updateSetting('s3', 'region', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="eu-ro-1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Access Key ID
              </label>
              <div className="relative">
                <input
                  type={showSecrets['s3-access-key'] ? 'text' : 'password'}
                  value={settings.s3?.accessKeyId || ''}
                  onChange={(e) => updateSetting('s3', 'accessKeyId', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Access key ID"
                />
                <button
                  type="button"
                  onClick={() => toggleSecretVisibility('s3-access-key')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-foreground/60 hover:text-foreground"
                >
                  {showSecrets['s3-access-key'] ? (
                    <EyeSlashIcon className="w-4 h-4" />
                  ) : (
                    <EyeIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Bucket Name
              </label>
              <div className="relative">
                <input
                  type={showSecrets['s3-bucket-name'] ? 'text' : 'password'}
                  value={settings.s3?.bucketName || ''}
                  onChange={(e) => updateSetting('s3', 'bucketName', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="bucket-name"
                />
                <button
                  type="button"
                  onClick={() => toggleSecretVisibility('s3-bucket-name')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-foreground/60 hover:text-foreground"
                >
                  {showSecrets['s3-bucket-name'] ? (
                    <EyeSlashIcon className="w-4 h-4" />
                  ) : (
                    <EyeIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                {t('settings.s3UploadTimeout')}
              </label>
              <input
                type="number"
                min="60"
                max="7200"
                step="60"
                value={settings.s3?.timeout || 3600}
                onChange={(e) => updateSetting('s3', 'timeout', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="3600"
              />
              <p className="text-xs text-foreground/60 mt-1">
                {t('settings.s3UploadTimeoutDesc')}
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Secret Access Key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showSecrets['s3-secret'] ? 'text' : 'password'}
                    value={settings.s3?.secretAccessKey || ''}
                    onChange={(e) => updateSetting('s3', 'secretAccessKey', e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Secret access key"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecretVisibility('s3-secret')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-foreground/60 hover:text-foreground"
                  >
                    {showSecrets['s3-secret'] ? (
                      <EyeSlashIcon className="w-4 h-4" />
                    ) : (
                      <EyeIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => testConnection('s3')}
                  disabled={!settings.s3?.endpointUrl || !settings.s3?.accessKeyId || testing['s3']}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {testing['s3'] ? 'Testing...' : 'Test S3'}
                </button>
              </div>
              {testResults['s3'] && (
                <div className={`mt-2 p-2 rounded-md text-sm ${
                  testResults['s3'].success 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {testResults['s3'].message}
                  {testResults['s3'].responseTime && (
                    <span className="ml-2">({testResults['s3'].responseTime}ms)</span>
                  )}
                  {testResults['s3'].statusCode && (
                    <span className="ml-2">Status: {testResults['s3'].statusCode}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-between items-center">
          <button
            onClick={clearDatabase}
            disabled={loading}
            className="px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            🗑️ {t('settings.clearDatabase')}
          </button>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {t('settings.saving')}
              </>
            ) : (
              t('settings.saveSettings')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}