import { NextRequest, NextResponse } from 'next/server';
import {
  verifyPrivyAuth,
  verifyWalletSignature,
  checkRateLimit,
  getClientIp,
  logAuditEvent
} from '@/lib/security/verificationAuth';
import {
  isValidChallengeNonce,
  isValidBase64Signature,
  isValidSolanaAddress
} from '@/lib/validation';
import {
  getDesignatedClaimsBySocials,
  verifyDesignatedClaim,
  getVerificationChallenge,
  markChallengeUsed,
  acquireVerificationLockDB,
  releaseVerificationLockDB,
  incrementVerificationAttempts,
  getPool
} from '@/lib/db';

export async function POST(request: NextRequest) {
  const pool = getPool();
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const lockedTokens: string[] = [];

  try {
    // Parse request body
    const body = await request.json();
    const { challengeNonce, signature } = body;

    if (!challengeNonce || !signature) {
      return NextResponse.json(
        { error: 'Challenge nonce and signature are required' },
        { status: 400 }
      );
    }

    // Validate input formats
    if (!isValidChallengeNonce(challengeNonce)) {
      return NextResponse.json(
        { error: 'Invalid challenge nonce format' },
        { status: 400 }
      );
    }

    if (!isValidBase64Signature(signature)) {
      return NextResponse.json(
        { error: 'Invalid signature format' },
        { status: 400 }
      );
    }

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
    const rateLimitKey = `verify:${userData.userId}:${clientIp}`;
    if (!checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
      await logAuditEvent(pool, {
        event_type: 'rate_limit_exceeded',
        wallet_address: userData.externalWallet || userData.embeddedWallet,
        social_twitter: userData.twitterUsername,
        social_github: userData.githubUsername,
        ip_address: clientIp,
        user_agent: userAgent
      });

      return NextResponse.json(
        { error: 'Too many verification attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Get the challenge from database
    const challenge = await getVerificationChallenge(challengeNonce);
    if (!challenge) {
      await logAuditEvent(pool, {
        event_type: 'verification_failed',
        error_message: 'Invalid or expired challenge',
        wallet_address: userData.externalWallet || userData.embeddedWallet,
        social_twitter: userData.twitterUsername,
        social_github: userData.githubUsername,
        ip_address: clientIp,
        user_agent: userAgent
      });

      return NextResponse.json(
        { error: 'Invalid or expired challenge' },
        { status: 400 }
      );
    }

    // Verify wallet address matches
    const walletAddress = userData.externalWallet || userData.embeddedWallet;

    // Validate wallet address format
    if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
      await logAuditEvent(pool, {
        event_type: 'verification_failed',
        error_message: 'Invalid wallet address format',
        wallet_address: walletAddress,
        ip_address: clientIp,
        user_agent: userAgent
      });

      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    if (challenge.wallet_address !== walletAddress) {
      await logAuditEvent(pool, {
        event_type: 'verification_failed',
        error_message: 'Wallet address mismatch',
        wallet_address: walletAddress,
        social_twitter: userData.twitterUsername,
        social_github: userData.githubUsername,
        ip_address: clientIp,
        user_agent: userAgent
      });

      return NextResponse.json(
        { error: 'Wallet address mismatch' },
        { status: 403 }
      );
    }

    // Verify the signature
    const isValidSignature = verifyWalletSignature(
      challenge.challenge_message,
      signature,
      walletAddress
    );

    if (!isValidSignature) {
      await logAuditEvent(pool, {
        event_type: 'verification_failed',
        error_message: 'Invalid signature',
        wallet_address: walletAddress,
        social_twitter: userData.twitterUsername,
        social_github: userData.githubUsername,
        ip_address: clientIp,
        user_agent: userAgent
      });

      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    // Mark challenge as used
    await markChallengeUsed(challengeNonce);

    // Find designated claims for these social profiles
    const designatedClaims = await getDesignatedClaimsBySocials(
      userData.twitterUsername,
      userData.githubUsername
    );

    if (designatedClaims.length === 0) {
      await logAuditEvent(pool, {
        event_type: 'verification_success',
        wallet_address: walletAddress,
        social_twitter: userData.twitterUsername,
        social_github: userData.githubUsername,
        ip_address: clientIp,
        user_agent: userAgent,
        metadata: {
          message: 'No designated tokens found'
        }
      });

      return NextResponse.json({
        verified: true,
        message: 'Verification successful, but no designated tokens found for these social profiles',
        tokensVerified: []
      });
    }

    // Process each designated claim with locking
    const verifiedTokens = [];
    const failedTokens = [];

    for (const claim of designatedClaims) {
      try {
        // Acquire lock for this token
        const lockAcquired = await acquireVerificationLockDB(claim.token_address);
        if (!lockAcquired) {
          failedTokens.push({
            tokenAddress: claim.token_address,
            error: 'Another verification is in progress'
          });
          continue;
        }

        lockedTokens.push(claim.token_address);

        // Increment verification attempts
        await incrementVerificationAttempts(claim.token_address);

        // Verify the claim
        const verified = await verifyDesignatedClaim(
          claim.token_address,
          walletAddress,
          userData.embeddedWallet
        );

        if (verified) {
          verifiedTokens.push({
            tokenAddress: verified.token_address,
            originalLauncher: verified.original_launcher,
            verifiedWallet: verified.verified_wallet,
            embeddedWallet: verified.verified_embedded_wallet
          });

          await logAuditEvent(pool, {
            event_type: 'verification_success',
            token_address: verified.token_address,
            wallet_address: walletAddress,
            social_twitter: userData.twitterUsername,
            social_github: userData.githubUsername,
            ip_address: clientIp,
            user_agent: userAgent
          });
        }
      } catch (error) {
        console.error(`Error verifying token ${claim.token_address}:`, error);
        failedTokens.push({
          tokenAddress: claim.token_address,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Release all locks
    for (const tokenAddress of lockedTokens) {
      try {
        await releaseVerificationLockDB(tokenAddress);
      } catch (error) {
        console.error(`Error releasing lock for ${tokenAddress}:`, error);
      }
    }

    return NextResponse.json({
      verified: true,
      message: `Successfully verified ${verifiedTokens.length} designated tokens`,
      tokensVerified: verifiedTokens,
      failedTokens: failedTokens.length > 0 ? failedTokens : undefined
    });

  } catch (error) {
    console.error('Error verifying designated claims:', error);

    // Release any acquired locks
    for (const tokenAddress of lockedTokens) {
      try {
        await releaseVerificationLockDB(tokenAddress);
      } catch (error) {
        console.error(`Error releasing lock for ${tokenAddress}:`, error);
      }
    }

    await logAuditEvent(pool, {
      event_type: 'verification_failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      ip_address: clientIp,
      user_agent: userAgent
    });

    return NextResponse.json(
      { error: 'Failed to verify designated claims' },
      { status: 500 }
    );
  }
}