import { NextRequest, NextResponse } from 'next/server';
import { confirmAndRecordLaunch } from '@/lib/launchService';

interface ConfirmLaunchRequest {
  transactionSignature: string;
  baseMint: string;
  name: string;
  symbol: string;
  uri: string;
  creatorWallet: string;
  creatorTwitter?: string;
  creatorGithub?: string;
}

export async function POST(request: NextRequest) {
  try {
    const {
      transactionSignature,
      baseMint,
      name,
      symbol,
      uri,
      creatorWallet,
      creatorTwitter,
      creatorGithub
    }: ConfirmLaunchRequest = await request.json();

    // Validate required parameters
    if (!transactionSignature || !baseMint || !creatorWallet) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const result = await confirmAndRecordLaunch(
      transactionSignature,
      baseMint,
      name,
      symbol,
      uri,
      creatorWallet,
      creatorTwitter,
      creatorGithub
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error('Confirmation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm launch' },
      { status: 500 }
    );
  }
}