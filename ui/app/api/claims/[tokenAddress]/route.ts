import { NextResponse } from 'next/server';

export async function POST(
  request: Request
) {
  const body = await request.json();
  const tokenAddress = body.tokenAddress;
  const wallet = body.wallet;

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.zcombinator.io';
    const response = await fetch(`${apiUrl}/claims/${tokenAddress}?wallet=${wallet}`);

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch claim info' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching claim info:', error);
    return NextResponse.json({ error: 'Failed to fetch claim info' }, { status: 500 });
  }
}