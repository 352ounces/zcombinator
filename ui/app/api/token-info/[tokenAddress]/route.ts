import { NextRequest, NextResponse } from 'next/server';

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

    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Helius API key not configured' },
        { status: 500 }
      );
    }

    // Fetch token account info to get supply and decimals
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenSupply',
        params: [tokenAddress]
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius RPC error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }

    const supply = data.result?.value?.amount || '1000000000';
    const decimals = data.result?.value?.decimals || 6;

    // Convert raw supply to human readable format
    const humanReadableSupply = (parseFloat(supply) / Math.pow(10, decimals)).toLocaleString();

    return NextResponse.json({
      supply: humanReadableSupply,
      rawSupply: supply,
      decimals
    });

  } catch (error) {
    console.error('Error fetching token info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token info' },
      { status: 500 }
    );
  }
}