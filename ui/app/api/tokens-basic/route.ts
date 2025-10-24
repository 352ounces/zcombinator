import { NextResponse } from 'next/server';
import { getTokenLaunches } from '@/lib/db';

export async function POST() {
  try {
    // Fetch all token launches without claim data for fast initial load
    const tokens = await getTokenLaunches(undefined, 1000);

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 }
    );
  }
}