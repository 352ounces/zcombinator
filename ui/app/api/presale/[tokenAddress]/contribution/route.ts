import { NextRequest, NextResponse } from 'next/server';
import { getUserPresaleContribution } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenAddress: string }> }
) {
  try {
    const { tokenAddress } = await params;
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const contributionLamports = await getUserPresaleContribution(tokenAddress, walletAddress);
    const contributionSol = Number(contributionLamports) / 1_000_000;

    return NextResponse.json({
      contributionSol
    });

  } catch (error) {
    console.error('Error fetching user contribution:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch user contribution' },
      { status: 500 }
    );
  }
}
