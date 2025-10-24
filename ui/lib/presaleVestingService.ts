import {
  getPresaleByTokenAddress,
  getPresaleBids,
  getPresaleClaimByWallet,
  createOrUpdatePresaleClaim,
  recordPresaleClaimTransaction,
  updatePresaleClaimAmount,
  getPool
} from './db';
import BN from 'bn.js';

const VESTING_DURATION_HOURS = 336; // 2 weeks
const HOURS_TO_MILLISECONDS = 60 * 60 * 1000;

export interface VestingInfo {
  totalAllocated: string;
  totalClaimed: string;
  claimableAmount: string;
  vestingProgress: number; // percentage 0-100
  isFullyVested: boolean;
  nextUnlockTime?: Date;
  vestingEndTime: Date;
}

/**
 * Calculate token allocation for a wallet based on their contribution
 */
export async function calculateTokenAllocation(
  tokenAddress: string,
  walletAddress: string
): Promise<string> {
  const presale = await getPresaleByTokenAddress(tokenAddress);

  if (!presale || presale.status !== 'launched') {
    throw new Error('Presale not found or not launched');
  }

  if (!presale.tokens_bought) {
    throw new Error('Tokens bought not recorded');
  }

  // Get all bids for this presale
  const allBids = await getPresaleBids(tokenAddress);

  // Calculate total SOL raised and user's contribution
  let totalRaisedLamports = new BN(0);
  let userContributionLamports = new BN(0);

  for (const bid of allBids) {
    const bidAmount = new BN(bid.amount_lamports.toString());
    totalRaisedLamports = totalRaisedLamports.add(bidAmount);

    if (bid.wallet_address === walletAddress) {
      userContributionLamports = userContributionLamports.add(bidAmount);
    }
  }

  if (userContributionLamports.isZero()) {
    return '0';
  }

  // Calculate pro-rata allocation
  const totalTokens = new BN(presale.tokens_bought);
  const userAllocation = totalTokens
    .mul(userContributionLamports)
    .div(totalRaisedLamports);

  return userAllocation.toString();
}

/**
 * Calculate vesting progress and claimable amount
 */
export async function calculateVestingInfo(
  tokenAddress: string,
  walletAddress: string
): Promise<VestingInfo> {
  const presale = await getPresaleByTokenAddress(tokenAddress);

  if (!presale || presale.status !== 'launched') {
    throw new Error('Presale not found or not launched');
  }

  if (!presale.launched_at) {
    throw new Error('Launch time not recorded');
  }

  // Get or create claim record
  let claimRecord = await getPresaleClaimByWallet(presale.id!, walletAddress);

  if (!claimRecord) {
    // Calculate allocation and create claim record
    const allocation = await calculateTokenAllocation(tokenAddress, walletAddress);

    if (allocation === '0') {
      throw new Error('No allocation for this wallet');
    }

    claimRecord = await createOrUpdatePresaleClaim({
      presale_id: presale.id!,
      wallet_address: walletAddress,
      tokens_allocated: allocation,
      vesting_start_at: presale.launched_at
    });
  }

  const vestingDurationHours = VESTING_DURATION_HOURS;
  const vestingDurationMs = vestingDurationHours * HOURS_TO_MILLISECONDS;

  // Calculate time elapsed since vesting start
  const now = Date.now();
  const vestingStartMs = new Date(claimRecord.vesting_start_at).getTime();
  const elapsedMs = Math.max(0, now - vestingStartMs);

  // Calculate vesting progress (0-100%)
  const vestingProgress = Math.min(100, (elapsedMs / vestingDurationMs) * 100);
  const isFullyVested = vestingProgress >= 100;

  // Calculate total vested amount based on linear vesting
  const totalAllocated = new BN(claimRecord.tokens_allocated);
  const vestedAmount = totalAllocated
    .mul(new BN(Math.floor(vestingProgress * 100)))
    .div(new BN(10000)); // Divide by 10000 for percentage with 2 decimal precision

  // Calculate claimable amount (vested - already claimed)
  const alreadyClaimed = new BN(claimRecord.tokens_claimed);
  const claimableAmount = vestedAmount.sub(alreadyClaimed);

  // Calculate next unlock time based on last claim
  let nextUnlockTime: Date | undefined;
  if (!isFullyVested) {
    // If user has never claimed, they can claim immediately (if vested amount > 0)
    if (claimRecord.last_claim_at) {
      // Enforce minimum time between claims (1 hour)
      // Ensure we're handling the timestamp correctly regardless of how PostgreSQL returns it
      const lastClaimDate = new Date(claimRecord.last_claim_at);
      const lastClaimMs = lastClaimDate.getTime();
      const timeSinceLastClaim = now - lastClaimMs;

      if (timeSinceLastClaim < HOURS_TO_MILLISECONDS) {
        // User must wait until 1 hour after their last claim
        nextUnlockTime = new Date(lastClaimMs + HOURS_TO_MILLISECONDS);
      }
      // If they can claim now, don't set nextUnlockTime (they can claim immediately)
    } else if (claimableAmount.isZero()) {
      // If no tokens have vested yet, show when first tokens will vest
      const nextHourMs = Math.ceil(elapsedMs / HOURS_TO_MILLISECONDS) * HOURS_TO_MILLISECONDS;
      nextUnlockTime = new Date(vestingStartMs + nextHourMs);
    }
    // If user has never claimed and has claimable amount, nextUnlockTime remains undefined (can claim now)
  }

  const vestingEndTime = new Date(vestingStartMs + vestingDurationMs);

  return {
    totalAllocated: claimRecord.tokens_allocated,
    totalClaimed: claimRecord.tokens_claimed,
    claimableAmount: claimableAmount.toString(),
    vestingProgress,
    isFullyVested,
    nextUnlockTime,
    vestingEndTime
  };
}

/**
 * Initialize presale claims after launch
 */
export async function initializePresaleClaims(
  tokenAddress: string,
  baseMintAddress: string,
  tokensBought: string
): Promise<void> {
  const presale = await getPresaleByTokenAddress(tokenAddress);

  if (!presale) {
    throw new Error('Presale not found');
  }

  // Update presale with launch data
  const pool = getPool();
  const updateQuery = `
    UPDATE presales
    SET
      launched_at = CURRENT_TIMESTAMP,
      base_mint_address = $2,
      tokens_bought = $3,
      status = 'launched'
    WHERE token_address = $1
  `;

  await pool.query(updateQuery, [tokenAddress, baseMintAddress, tokensBought]);

  // Pre-calculate allocations for all participants
  const allBids = await getPresaleBids(tokenAddress);
  const uniqueWallets = new Set(allBids.map(bid => bid.wallet_address));

  // Calculate total raised
  let totalRaisedLamports = new BN(0);
  const walletContributions = new Map<string, any>();

  for (const bid of allBids) {
    const bidAmount = new BN(bid.amount_lamports.toString());
    totalRaisedLamports = totalRaisedLamports.add(bidAmount);

    const existing = walletContributions.get(bid.wallet_address) || new BN(0);
    walletContributions.set(bid.wallet_address, existing.add(bidAmount));
  }

  const totalTokens = new BN(tokensBought);
  const launchedAt = new Date();

  // Create claim records for all participants
  for (const wallet of Array.from(uniqueWallets)) {
    const contribution = walletContributions.get(wallet)!;
    const allocation = totalTokens.mul(contribution).div(totalRaisedLamports);

    await createOrUpdatePresaleClaim({
      presale_id: presale.id!,
      wallet_address: wallet,
      tokens_allocated: allocation.toString(),
      vesting_start_at: launchedAt
    });
  }
}

/**
 * Record a successful claim transaction
 */
export async function recordPresaleClaim(
  tokenAddress: string,
  walletAddress: string,
  amountClaimed: string,
  transactionSignature: string,
  blockTime?: number,
  slot?: bigint
): Promise<void> {
  const presale = await getPresaleByTokenAddress(tokenAddress);

  if (!presale || !presale.id) {
    throw new Error('Presale not found');
  }

  // Record the transaction
  await recordPresaleClaimTransaction({
    presale_id: presale.id,
    wallet_address: walletAddress,
    amount_claimed: amountClaimed,
    transaction_signature: transactionSignature,
    block_time: blockTime,
    slot,
    verified_at: new Date()
  });

  // Update the claim record
  await updatePresaleClaimAmount(presale.id, walletAddress, amountClaimed);
}

/**
 * Get aggregated presale stats
 */
export async function getPresaleStats(tokenAddress: string) {
  const presale = await getPresaleByTokenAddress(tokenAddress);

  if (!presale) {
    throw new Error('Presale not found');
  }

  const pool = getPool();

  // Get claim statistics
  const statsQuery = `
    SELECT
      COUNT(DISTINCT wallet_address) as total_participants,
      SUM(CAST(tokens_allocated AS DECIMAL)) as total_allocated,
      SUM(CAST(tokens_claimed AS DECIMAL)) as total_claimed
    FROM presale_claims
    WHERE presale_id = $1
  `;

  const result = await pool.query(statsQuery, [presale.id]);
  const stats = result.rows[0];

  const totalAllocated = stats.total_allocated || '0';
  const totalClaimed = stats.total_claimed || '0';
  const claimedPercentage = totalAllocated === '0' ? 0 :
    (parseFloat(totalClaimed) / parseFloat(totalAllocated)) * 100;

  return {
    totalParticipants: parseInt(stats.total_participants || '0'),
    totalAllocated,
    totalClaimed,
    claimedPercentage,
    vestingDurationHours: VESTING_DURATION_HOURS,
    launchedAt: presale.launched_at,
    status: presale.status
  };
}