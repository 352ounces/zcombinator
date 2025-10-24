import { NextRequest, NextResponse } from 'next/server';
import { updateTokenHolderLabels } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tokenAddress: string; walletAddress: string }> }
) {
  try {
    const { tokenAddress, walletAddress } = await params;

    if (!tokenAddress || !walletAddress) {
      return NextResponse.json(
        { error: 'Token address and wallet address are required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { telegram_username, x_username, discord_username, custom_label } = body;

    // Validate that at least one label is provided
    if (!telegram_username && !x_username && !discord_username && !custom_label) {
      return NextResponse.json(
        { error: 'At least one label must be provided' },
        { status: 400 }
      );
    }

    const updatedHolder = await updateTokenHolderLabels(
      tokenAddress,
      walletAddress,
      {
        telegram_username: telegram_username || null,
        x_username: x_username || null,
        discord_username: discord_username || null,
        custom_label: custom_label || null
      }
    );

    if (!updatedHolder) {
      return NextResponse.json(
        { error: 'Token holder not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      holder: updatedHolder
    });

  } catch (error) {
    console.error('Error updating token holder labels:', error);
    return NextResponse.json(
      { error: 'Failed to update token holder labels' },
      { status: 500 }
    );
  }
}