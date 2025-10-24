import { NextRequest, NextResponse } from 'next/server';
import { getDesignatedClaimsBySocials } from '@/lib/db';

// This endpoint is READ-ONLY for checking if designated claims exist
// Actual verification happens through /api/verify-designated/verify with proper authentication


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const twitterUsername = body.twitter;
    const githubUsername = body.github;

    // Find any designated claims for these social profiles
    const designatedClaims = await getDesignatedClaimsBySocials(
      twitterUsername || undefined,
      githubUsername || undefined
    );

    // Only return minimal information (don't expose sensitive data)
    return NextResponse.json({
      claims: designatedClaims.map(claim => ({
        token_address: claim.token_address,
        has_verified_wallet: !!claim.verified_wallet,
        // Don't expose actual wallet addresses or other sensitive info
      })),
      count: designatedClaims.length
    });

  } catch (error) {
    console.error('Error fetching designated claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch designated claims' },
      { status: 500 }
    );
  }
}