import { NextRequest, NextResponse } from 'next/server';
import { uploadMetadataToPinata } from '@/lib/launchService';

export async function POST(request: NextRequest) {
  try {
    const metadata = await request.json();
    const url = await uploadMetadataToPinata(metadata);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Upload metadata error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload metadata' },
      { status: 500 }
    );
  }
}