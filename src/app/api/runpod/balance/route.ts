import { NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RunPodBalanceResponse = {
  data?: {
    myself?: {
      clientBalance?: number | null;
      currentSpendPerHr?: number | null;
      spendLimit?: number | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

let settingsService: SettingsService;

function formatCurrencyAmount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export async function GET() {
  try {
    if (!settingsService) {
      settingsService = new SettingsService();
    }

    const { settings } = await settingsService.getSettings('user-with-settings');
    const apiKey = settings.runpod?.apiKey?.trim();

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'RunPod API key is not configured' },
        { status: 400 }
      );
    }

    const response = await fetch('https://api.runpod.io/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query RunPodBalance {
            myself {
              clientBalance
              currentSpendPerHr
              spendLimit
            }
          }
        `,
      }),
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => null)) as RunPodBalanceResponse | null;

    if (!response.ok || !payload) {
      return NextResponse.json(
        { success: false, error: `RunPod balance request failed: HTTP ${response.status}` },
        { status: 502 }
      );
    }

    if (payload.errors?.length) {
      return NextResponse.json(
        { success: false, error: payload.errors.map((error) => error.message || 'Unknown RunPod error').join('; ') },
        { status: 502 }
      );
    }

    const balance = payload.data?.myself?.clientBalance;

    if (typeof balance !== 'number' || !Number.isFinite(balance)) {
      return NextResponse.json(
        { success: false, error: 'RunPod balance is unavailable' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      balance,
      formattedBalance: formatCurrencyAmount(balance),
      currentSpendPerHr: payload.data?.myself?.currentSpendPerHr ?? null,
      spendLimit: payload.data?.myself?.spendLimit ?? null,
      checkedAt: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error('Failed to fetch RunPod balance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch RunPod balance' },
      { status: 500 }
    );
  }
}
