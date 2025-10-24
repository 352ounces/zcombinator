import { NextRequest, NextResponse } from 'next/server';
import { getWalletTokenBalance } from '@/lib/token-balance';

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();
    const tokenAddress = body.tokenAddress;
    const walletAddress = body.walletAddress;

    if (!tokenAddress || !walletAddress) {
      return NextResponse.json(
        { error: 'Token address and wallet address are required' },
        { status: 400 }
      );
    }

    // Basic validation for Solana addresses
    if (tokenAddress.length < 32 || tokenAddress.length > 44 ||
        walletAddress.length < 32 || walletAddress.length > 44) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }

    try {
      const balance = await getWalletTokenBalance(walletAddress, tokenAddress);

      return NextResponse.json({
        walletAddress,
        tokenAddress,
        balance
      });
    } catch (balanceError) {
      // If balance fetch fails, return with balance as '--'
      console.error('Error fetching wallet balance:', balanceError);
      return NextResponse.json({
        walletAddress,
        tokenAddress,
        balance: '--'
      });
    }

  } catch (error) {
    console.error('Error in balance route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet balance' },
      { status: 500 }
    );
  }
}