import { NextRequest, NextResponse } from 'next/server';
import { getTokenLaunches, getTokenLaunchesBySocials, getTokenLaunchByAddress, TokenLaunch } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const creatorWallet = body.creator;
    const tokenAddress = body.token;
    const twitterUsername = body.twitterUrl; // Actually username, not full URL
    const githubUrl = body.githubUrl;
    const includeSocials = body.includeSocials === 'true' || body.includeSocials === true;
    const limit = parseInt(body.limit || '100', 10);

    let allLaunches: TokenLaunch[] = [];

    // Get launches by creator wallet
    if (creatorWallet) {
      const walletLaunches = await getTokenLaunches(creatorWallet, limit);
      allLaunches = [...walletLaunches];
    }

    // Get launches by token address
    if (tokenAddress && !creatorWallet) {
      const tokenLaunch = await getTokenLaunchByAddress(tokenAddress);
      if (tokenLaunch) {
        allLaunches = [tokenLaunch];
      }
    }

    // Also get launches by social profiles if requested
    if (includeSocials && (twitterUsername || githubUrl)) {
      const socialLaunches = await getTokenLaunchesBySocials(twitterUsername || undefined, githubUrl || undefined, limit);

      // Create a set of tokens where user is designated
      const designatedTokens = new Set(socialLaunches.map(l => l.token_address));

      // Mark existing launches as designated if they match
      allLaunches = allLaunches.map(launch => ({
        ...launch,
        is_creator_designated: designatedTokens.has(launch.token_address)
      }));

      // Add any social launches that aren't already in the list
      const existingAddresses = new Set(allLaunches.map(l => l.token_address));
      socialLaunches.forEach(launch => {
        if (!existingAddresses.has(launch.token_address)) {
          allLaunches.push({
            ...launch,
            is_creator_designated: true // Mark as creator-designated token
          });
        }
      });
    }

    // Sort by launch_time DESC
    allLaunches.sort((a, b) => new Date(b.launch_time).getTime() - new Date(a.launch_time).getTime());

    return NextResponse.json({
      launches: allLaunches,
      count: allLaunches.length
    });

  } catch (error) {
    console.error('Error fetching launches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token launches' },
      { status: 500 }
    );
  }
}