import { NextRequest, NextResponse } from 'next/server';
import { getDesignatedClaimByToken } from '@/lib/db';

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

    const claim = await getDesignatedClaimByToken(tokenAddress);

    return NextResponse.json({
      claim
    });

  } catch (error) {
    console.error('Error fetching designated claim:', error);
    return NextResponse.json(
      { error: 'Failed to fetch designated claim' },
      { status: 500 }
    );
  }
}