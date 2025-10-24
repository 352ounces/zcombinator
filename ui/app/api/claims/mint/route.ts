import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Proxy the request to the API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.zcombinator.io';
    const response = await fetch(`${apiUrl}/claims/mint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Handle rate limiting gracefully
    if (response.status === 429) {
      return NextResponse.json(
        { error: 'Rate limited. Please try again later.' },
        { status: 429 }
      );
    }

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Non-JSON response from claims/mint API');
      return NextResponse.json(
        { error: 'Invalid response from server' },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error minting claim:', error);
    return NextResponse.json(
      { error: 'Failed to mint claim transaction' },
      { status: 500 }
    );
  }
}