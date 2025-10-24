import { NextRequest, NextResponse } from 'next/server';
import { createLaunchTransaction } from '@/lib/launchService';

interface LaunchRequest {
  baseMintPublicKey: string;
  name: string;
  symbol: string;
  uri: string;
  payerPublicKey: string;
  quoteToken?: 'SOL' | 'ZC';
}

export async function POST(request: NextRequest) {
  try {
    const {
      baseMintPublicKey,
      name,
      symbol,
      uri,
      payerPublicKey,
      quoteToken
    }: LaunchRequest = await request.json();

    const result = await createLaunchTransaction(
      baseMintPublicKey,
      name,
      symbol,
      uri,
      payerPublicKey,
      quoteToken || 'SOL'
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error('Launch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create launch transaction' },
      { status: 500 }
    );
  }
}