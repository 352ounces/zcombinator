import { NextRequest, NextResponse } from 'next/server';
import { getTokenHolders, getTokenHolderStats } from '@/lib/db';

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();
    const tokenAddress = body.tokenAddress;

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    const [holders, stats] = await Promise.all([
      getTokenHolders(tokenAddress),
      getTokenHolderStats(tokenAddress)
    ]);

    return NextResponse.json({
      holders,
      stats,
      count: holders.length
    });

  } catch (error) {
    console.error('Error fetching token holders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token holders' },
      { status: 500 }
    );
  }
}