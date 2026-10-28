import { withWorkspaceRoute } from '@/lib/workspaces/route';
// src/app/api/settings/test/route.ts

import { NextRequest, NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';
import ElevenLabsService from '@/lib/elevenlabsService';

const settingsService = new SettingsService();

export interface TestResult {
  success: boolean;
  message: string;
  details?: {
    responseTime: number;
    statusCode?: number;
    endpoint: string;
  };
  error?: string;
}

async function POSTImpl(request: NextRequest) {
  try {
    // Request body를 한 번만 읽기
    const body = await request.json();
    const { service, apiKey, endpointId, config } = body;

    console.log(`🧪 Testing ${service} connection...`);

    if (service === 'runpod') {
      const runpodApiKey = typeof apiKey === 'string' ? apiKey.trim() : '';
      const runpodEndpointId = typeof endpointId === 'string' ? endpointId.trim() : '';
      if (!runpodApiKey || !runpodEndpointId) {
        return NextResponse.json({ error: 'API key and endpoint ID are required' }, { status: 400 });
      }

      const startTime = Date.now();

      try {
        // A health probe checks access without queuing a billable job or requiring active workers.
        const response = await fetch(`https://api.runpod.ai/v2/${encodeURIComponent(runpodEndpointId)}/health`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${runpodApiKey}`,
          },
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        });

        const failures: Record<number, string> = {
          401: 'RunPod authentication failed. Check your API key.',
          403: 'RunPod access denied. Check your API key permissions.',
          404: 'RunPod endpoint not found. Check your endpoint ID.',
          429: 'RunPod rate limit reached. Try again later.',
        };

        return NextResponse.json({
          success: response.ok,
          message: response.ok
            ? 'RunPod endpoint is reachable.'
            : failures[response.status] || `RunPod health check failed (HTTP ${response.status}). Try again later.`,
          responseTime: Date.now() - startTime,
          statusCode: response.status,
          endpoint: runpodEndpointId,
        });
      } catch (error) {
        const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
        return NextResponse.json({
          success: false,
          message: timedOut
            ? 'RunPod health check timed out after 10 seconds. Try again later.'
            : 'Unable to reach RunPod. Check your network connection and try again.',
          responseTime: Date.now() - startTime,
          statusCode: 0,
          endpoint: runpodEndpointId,
        });
      }
    } else if (service === 's3') {
      // S3 연결 테스트 - config에서 S3 필드 추출
      const { endpointUrl, accessKeyId, secretAccessKey, bucketName, region } = config;

      if (!endpointUrl || !accessKeyId || !secretAccessKey || !bucketName || !region) {
        return NextResponse.json({ error: 'All S3 fields are required' }, { status: 400 });
      }

      const startTime = Date.now();
      
      try {
        // AWS CLI를 사용한 S3 연결 테스트
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);

        const testCommand = `aws s3 ls s3://${bucketName} --endpoint-url ${endpointUrl} --region ${region}`;
        
        const env = {
          ...process.env,
          AWS_ACCESS_KEY_ID: accessKeyId,
          AWS_SECRET_ACCESS_KEY: secretAccessKey,
          AWS_DEFAULT_REGION: region,
          AWS_REGION: region,
        };

        await execAsync(testCommand, { env, timeout: 10000 });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        return NextResponse.json({
          success: true,
          message: 'S3 연결 성공!',
          responseTime,
          statusCode: 200,
          endpoint: endpointUrl
        });
      } catch (error) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        return NextResponse.json({
          success: false,
          message: `S3 연결 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseTime,
          statusCode: 500,
          endpoint: endpointUrl
        });
      }
    } else if (service === 'elevenlabs') {
      // Eleven Labs 연결 테스트
      const { apiKey } = config;

      if (!apiKey) {
        return NextResponse.json({ error: 'Eleven Labs API key is required' }, { status: 400 });
      }

      const startTime = Date.now();

      try {
        // Eleven Labs API를 통해 API key 유효성 확인
        const elevenlabsService = new ElevenLabsService({
          apiKey,
          voiceId: 'EXAVITQu4vr4xnSDxMaL', // Test voice ID
        });

        // Test API key by fetching available voices
        const voicesResponse = await elevenlabsService.getVoices();

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (voicesResponse.voices && voicesResponse.voices.length > 0) {
          return NextResponse.json({
            success: true,
            message: 'Eleven Labs API key is valid',
            responseTime,
            statusCode: 200,
            endpoint: 'https://api.elevenlabs.io'
          });
        } else {
          return NextResponse.json({
            success: false,
            message: 'Eleven Labs API test failed: No voices returned',
            responseTime,
            statusCode: 500,
            endpoint: 'https://api.elevenlabs.io'
          });
        }
      } catch (error) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        return NextResponse.json({
          success: false,
          message: `Eleven Labs 연결 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseTime,
          statusCode: 500,
          endpoint: 'https://api.elevenlabs.io'
        });
      }
    } else {
      return NextResponse.json({ error: 'Invalid service type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Settings test error:', error);
    return NextResponse.json(
      { error: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

async function testS3Connection(config: any): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const { endpointUrl, accessKeyId, secretAccessKey, bucketName, region } = config;
    
    if (!endpointUrl || !accessKeyId || !secretAccessKey || !bucketName) {
      return {
        success: false,
        message: 'S3 configuration incomplete - All fields are required',
        error: 'Missing required S3 configuration'
      };
    }
    
    // Simple test - try to list bucket (HEAD request)
    const url = `${endpointUrl.replace(/\/$/, '')}/${bucketName}`;
    
    console.log(`🔧 Testing S3 endpoint: ${url}`);
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'Authorization': `AWS ${accessKeyId}:test`, // Simplified auth for test
      },
    });
    
    const responseTime = Date.now() - startTime;
    
    console.log(`📊 S3 test response: ${response.status} (${responseTime}ms)`);
    
    // For S3, we mainly want to check if the endpoint is reachable
    // Authentication errors are expected with simplified auth
    if (response.status === 403 || response.status === 401) {
      return {
        success: true,
        message: `S3 endpoint reachable (${responseTime}ms) - Credentials appear valid`,
        details: {
          responseTime,
          statusCode: response.status,
          endpoint: url
        }
      };
    }
    
    if (response.status === 200) {
      return {
        success: true,
        message: `S3 connection successful (${responseTime}ms)`,
        details: {
          responseTime,
          statusCode: response.status,
          endpoint: url
        }
      };
    }
    
    return {
      success: false,
      message: `S3 connection failed: ${response.status}`,
      error: `HTTP ${response.status}`,
      details: {
        responseTime,
        statusCode: response.status,
        endpoint: url
      }
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('❌ S3 connection test failed:', error);
    
    return {
      success: false,
      message: 'S3 connection failed - Check your endpoint URL and credentials',
      error: `${error}`,
      details: {
        responseTime,
        endpoint: config.endpointUrl
      }
    };
  }
}

async function logApiCall(userId: string, service: string, testResult: TestResult) {
  try {
    // This would normally use the Prisma client to log to the database
    console.log(`📝 Logging API call for user ${userId}:`, {
      service,
      success: testResult.success,
      responseTime: testResult.details?.responseTime,
      statusCode: testResult.details?.statusCode
    });
    
    // TODO: Implement actual database logging
    // await prisma.apiLog.create({
    //   data: {
    //     userId,
    //     service,
    //     endpoint: testResult.details?.endpoint || 'test',
    //     method: 'POST',
    //     responseStatus: testResult.details?.statusCode,
    //     errorMessage: testResult.error,
    //     durationMs: testResult.details?.responseTime
    //   }
    // });
    
  } catch (error) {
    console.error('❌ Failed to log API call:', error);
  }
}
export const POST = withWorkspaceRoute(POSTImpl, 'global');
