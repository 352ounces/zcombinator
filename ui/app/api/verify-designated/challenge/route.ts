import { NextRequest, NextResponse } from 'next/server';
import {
  verifyPrivyAuth,
  generateChallengeMessage,
  checkRateLimit,
  getClientIp,
  logAuditEvent
} from '@/lib/security/verificationAuth';
import {
  createVerificationChallenge,
  getPool
} from '@/lib/db';

export async function POST(request: NextRequest) {
  const pool = getPool();
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // Verify Privy authentication
    let userData;
    try {
      userData = await verifyPrivyAuth(request);
    } catch {
      await logAuditEvent(pool, {
        event_type: 'verification_failed',
        error_message: 'Invalid authentication',
        ip_address: clientIp,
        user_agent: userAgent
      });

      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check rate limiting
    const rateLimitKey = `challenge:${userData.userId}:${clientIp}`;
    if (!checkRateLimit(rateLimitKey, 10, 15 * 60 * 1000)) {
      await logAuditEvent(pool, {
        event_type: 'rate_limit_exceeded',
        wallet_address: userData.externalWallet || userData.embeddedWallet,
        social_twitter: userData.twitterUsername,
        social_github: userData.githubUsername,
        ip_address: clientIp,
        user_agent: userAgent
      });

      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Must have verified social accounts
    if (!userData.twitterVerified && !userData.githubVerified) {
      return NextResponse.json(
        { error: 'At least one verified social account is required' },
        { status: 400 }
      );
    }

    // Must have at least one wallet
    const walletAddress = userData.externalWallet || userData.embeddedWallet;
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'A wallet address is required' },
        { status: 400 }
      );
    }

    // Generate challenge message
    const { nonce, message, expiresAt } = generateChallengeMessage(
      walletAddress,
      userData.twitterUsername,
      userData.githubUsername
    );

    // Store challenge in database
    await createVerificationChallenge(
      walletAddress,
      nonce,
      message,
      expiresAt
    );

    // Log audit event
    await logAuditEvent(pool, {
      event_type: 'verification_attempt',
      wallet_address: walletAddress,
      social_twitter: userData.twitterUsername,
      social_github: userData.githubUsername,
      ip_address: clientIp,
      user_agent: userAgent,
      metadata: {
        challenge_nonce: nonce
      }
    });

    return NextResponse.json({
      success: true,
      challenge: {
        nonce,
        message,
        expiresAt: expiresAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating verification challenge:', error);

    await logAuditEvent(pool, {
      event_type: 'verification_failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      ip_address: clientIp,
      user_agent: userAgent
    });

    return NextResponse.json(
      { error: 'Failed to generate verification challenge' },
      { status: 500 }
    );
  }
}