import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();
    const address = body.address;

    // Proxy the request to the external API
    const response = await fetch(`https://api.zcombinator.io/verify-token/${address}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    // Handle rate limiting gracefully
    if (response.status === 429) {
      // If rate limited, assume token exists (since it was just launched)
      return NextResponse.json({ exists: true }, { status: 200 });
    }

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // Non-JSON response, likely rate limit message
      console.warn(`Non-JSON response for token ${address}, assuming exists`);
      return NextResponse.json({ exists: true }, { status: 200 });
    }

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error verifying token:', error);
    // Default to assuming token exists to avoid blocking users
    return NextResponse.json(
      { exists: true },
      { status: 200 }
    );
  }
}