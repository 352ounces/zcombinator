import { NextRequest, NextResponse } from 'next/server';
import { getPresaleByTokenAddress } from '@/lib/db';

export async function GET(
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

    const presale = await getPresaleByTokenAddress(tokenAddress);

    if (!presale) {
      return NextResponse.json(
        { error: 'Presale not found' },
        { status: 404 }
      );
    }

    // Remove private keys from response for security
    const { escrow_priv_key, base_mint_priv_key, ...publicPresaleData } = presale;

    return NextResponse.json(publicPresaleData);

  } catch (error) {
    console.error('Error fetching presale:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch presale' },
      { status: 500 }
    );
  }
}
