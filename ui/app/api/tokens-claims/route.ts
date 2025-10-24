import { NextResponse } from 'next/server';
import { calculateClaimEligibility } from '@/lib/helius';
import { getTokenLaunchTime } from '@/lib/db';

// Simple in-memory cache with TTL
interface ClaimData {
  totalClaimed: string;
  availableToClaim: string;
  [key: string]: unknown;
}

interface CacheEntry {
  data: ClaimData;
  timestamp: number;
}

const claimCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 1000; // 60 seconds

export async function POST(request: Request) {
  try {
    const { tokenAddresses } = await request.json();

    if (!tokenAddresses || !Array.isArray(tokenAddresses)) {
      return NextResponse.json(
        { error: 'tokenAddresses array is required' },
        { status: 400 }
      );
    }

    const now = Date.now();
    const results: Record<string, ClaimData> = {};

    // Process in parallel batches
    const BATCH_SIZE = 20;
    for (let i = 0; i < tokenAddresses.length; i += BATCH_SIZE) {
      const batch = tokenAddresses.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (tokenAddress: string) => {
        // Check cache first
        const cached = claimCache.get(tokenAddress);
        if (cached && (now - cached.timestamp) < CACHE_TTL) {
          return { tokenAddress, data: cached.data };
        }

        try {
          const launchTime = await getTokenLaunchTime(tokenAddress);
          if (!launchTime) {
            return { tokenAddress, data: { totalClaimed: '0', availableToClaim: '0' } };
          }

          const claimData = await calculateClaimEligibility(tokenAddress, launchTime);
          const result = {
            totalClaimed: claimData.totalClaimed.toString(),
            availableToClaim: claimData.availableToClaim.toString(),
          };

          // Cache the result
          claimCache.set(tokenAddress, { data: result, timestamp: now });

          return { tokenAddress, data: result };
        } catch (error) {
          console.error(`Error fetching claim data for ${tokenAddress}:`, error);
          return { tokenAddress, data: { totalClaimed: '0', availableToClaim: '0' } };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ tokenAddress, data }) => {
        results[tokenAddress] = data;
      });
    }

    // Clean up old cache entries
    for (const [key, value] of claimCache.entries()) {
      if (now - value.timestamp > CACHE_TTL * 10) {
        claimCache.delete(key);
      }
    }

    return NextResponse.json({ claims: results });
  } catch (error) {
    console.error('Error fetching token claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}