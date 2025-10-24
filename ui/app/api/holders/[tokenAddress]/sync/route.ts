import { NextRequest, NextResponse } from 'next/server';
import { syncTokenHolders } from '@/lib/holders-sync';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tokenAddress: string }> }
) {
  try {
    const { tokenAddress } = await params;

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    // Validate token address format (basic Solana address validation)
    if (tokenAddress.length < 32 || tokenAddress.length > 44) {
      return NextResponse.json(
        { error: 'Invalid token address format' },
        { status: 400 }
      );
    }

    console.log(`Starting holder sync for token: ${tokenAddress}`);

    const result = await syncTokenHolders(tokenAddress);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to sync token holders',
          details: result.error
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${result.holdersCount} token holders`,
      holdersCount: result.holdersCount
    });

  } catch (error) {
    console.error('Error in holder sync API:', error);
    return NextResponse.json(
      { error: 'Failed to sync token holders' },
      { status: 500 }
    );
  }
}