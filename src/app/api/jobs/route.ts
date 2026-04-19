import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { maybeGenerateJobThumbnail } from '@/lib/jobPreviewDerivatives';

// 간단한 메모리 캐시 (프로덕션에서는 Redis 사용 권장)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5000; // 5초 캐시

async function maybePopulateJobThumbnail(job: any) {
  const thumbnailUrl = await maybeGenerateJobThumbnail({
    id: job.id,
    modelId: job.modelId,
    type: job.type,
    resultUrl: job.resultUrl,
    thumbnailUrl: job.thumbnailUrl,
  });

  if (!thumbnailUrl || thumbnailUrl === job.thumbnailUrl) {
    return job;
  }

  return prisma.job.update({
    where: { id: job.id },
    data: { thumbnailUrl },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id, // RunPod ID or custom ID
      userId = 'user-with-settings', // Default user if not provided (must match GET default)
      workspaceId,
      type,
      status = 'queued',
      prompt,
      resultUrl,
      thumbnailUrl,
      options,
      modelId,
      endpointId,
      error,
      cost,
      createdAt,
      executionMs
    } = body;

    // 필수 필드 검증
    if (!type) {
      return NextResponse.json(
        { error: 'Missing required fields: type' },
        { status: 400 }
      );
    }

    // Job 생성 또는 업데이트 (upsert)
    const upsertedJob = await prisma.job.upsert({
      where: { id: id || 'new-job-' + Date.now() },
      update: {
        status,
        resultUrl,
        thumbnailUrl: thumbnailUrl || null,
        error,
        cost,
        completedAt: status === 'completed' ? new Date() : null,
        executionMs: typeof executionMs === 'number' ? executionMs : null
      },
      create: {
        id: id || undefined, // Use provided ID if available
        userId,
        workspaceId: workspaceId || null,
        type,
        status,
        prompt: prompt || null,
        resultUrl,
        thumbnailUrl: thumbnailUrl || null,
        options: options ? JSON.stringify(options) : null,
        modelId: modelId || 'unknown',
        endpointId,
        error,
        cost,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        completedAt: status === 'completed' ? new Date() : null,
        executionMs: typeof executionMs === 'number' ? executionMs : null
      }
    });

    const job = await maybePopulateJobThumbnail(upsertedJob);

    // 캐시 완전 무효화 (모든 캐시 제거)
    cache.clear();
    console.log('🗑️ All cache cleared after job creation/update');

    return NextResponse.json({ success: true, job }, { status: 201 });
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const userId = searchParams.get('userId') || 'user-with-settings';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const onlyProcessing = searchParams.get('onlyProcessing') === 'true';
    const workspaceId = searchParams.get('workspaceId'); // 워크스페이스 필터 추가
    const type = (searchParams.get('type') || '').toLowerCase(); // image | video | audio or csv

    if (jobId) {
      // 특정 작업 조회
      const job = await prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, job });
    } else {
      // 캐시 키 생성 (워크스페이스 필터 포함)
      const cacheKey = `jobs-${userId}-${page}-${limit}-${onlyProcessing}-${workspaceId || 'all'}-${type || 'all'}`;
      const cached = cache.get(cacheKey);

      // 캐시가 유효한지 확인
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return NextResponse.json({ success: true, ...cached.data });
      }

      // 쿼리 조건 구성
      const whereCondition: any = { userId };
      if (onlyProcessing) {
        whereCondition.status = 'processing';
      }

      // 워크스페이스 필터링
      if (workspaceId) {
        if (workspaceId === 'unassigned') {
          // 워크스페이스에 할당되지 않은 작업들
          whereCondition.workspaceId = null;
        } else {
          // 특정 워크스페이스의 작업들
          whereCondition.workspaceId = workspaceId;
        }
      }

      // 타입 필터링
      if (type) {
        const types = Array.from(new Set(type.split(',').map((entry) => entry.trim()).filter(Boolean)));
        if (types.length === 1 && types[0] === 'audio') {
          whereCondition.type = { in: ['audio', 'tts', 'music'] };
        } else if (types.length > 0) {
          const expandedTypes = types.flatMap((entry) => entry === 'audio' ? ['audio', 'tts', 'music'] : entry);
          whereCondition.type = { in: Array.from(new Set(expandedTypes.filter((entry) => entry === 'image' || entry === 'video' || entry === 'audio' || entry === 'tts' || entry === 'music'))) };
        }
      }

      // 페이지네이션과 함께 작업 조회 (필요한 필드만 선택)
      const [jobs, totalCount] = await Promise.all([
        prisma.job.findMany({
          where: whereCondition,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                color: true
              }
            }
          }
        }),
        prisma.job.count({ where: whereCondition })
      ]);

      const hydratedJobs = await Promise.all(jobs.map(async (job) => {
        if (job.status !== 'completed' || !job.resultUrl || job.thumbnailUrl) {
          return job;
        }

        return maybePopulateJobThumbnail(job);
      }));

      // Format jobs for frontend
      const formattedJobs = hydratedJobs.map(job => ({
        id: job.id,
        modelId: job.modelId,
        type: job.type,
        status: job.status,
        prompt: job.prompt || '',
        createdAt: job.createdAt.getTime(),
        executionMs: (job as any).executionMs ?? undefined,
        options: job.options,
        secureState: (job as any).secureState ?? null,
        resultUrl: job.resultUrl,
        error: job.error,
        endpointId: job.endpointId,
        thumbnailUrl: job.thumbnailUrl,
        workspaceId: job.workspaceId,
        workspace: job.workspace,
        cost: job.cost
      }));

      const result = {
        jobs: formattedJobs,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1,
        }
      };

      // 캐시에 저장
      cache.set(cacheKey, { data: result, timestamp: Date.now() });

      return NextResponse.json({ success: true, ...result });
    }
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}