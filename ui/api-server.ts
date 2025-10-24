/*
 * Z Combinator - Solana Token Launchpad
 * Copyright (C) 2025 Z Combinator
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as crypto from 'crypto';
import nacl from 'tweetnacl';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
  MintClaimRequestBody,
  ConfirmClaimRequestBody,
  MintClaimResponseBody,
  ConfirmClaimResponseBody,
  ClaimInfoResponseBody,
  ErrorResponseBody
} from './types/server';
import { Connection, Keypair, Transaction, PublicKey, ComputeBudgetProgram, SystemProgram } from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getMint,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount
} from '@solana/spl-token';
import bs58 from 'bs58';
import BN from 'bn.js';
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import {
  prepareTokenLaunch,
  confirmAndRecordLaunch,
  generateTokenKeypair
} from './lib/launchService';
import {
  getTokenLaunchTime,
  hasRecentClaim,
  preRecordClaim,
  getTokenCreatorWallet,
  getDesignatedClaimByToken,
  getVerifiedClaimWallets,
  getPresaleByTokenAddress,
  getUserPresaleContribution,
  getPresaleBids,
  getTotalPresaleBids,
  recordPresaleBid,
  getPresaleBidBySignature,
  getEmissionSplits,
  hasClaimRights
} from './lib/db';
import { calculateClaimEligibility } from './lib/helius';
import {
  calculateVestingInfo,
  recordPresaleClaim,
  getPresaleStats,
  initializePresaleClaims,
  type VestingInfo
} from './lib/presaleVestingService';
import { decryptEscrowKeypair } from './lib/presale-escrow';
import { decrypt } from './lib/crypto';
import { updatePresaleStatus } from './lib/db';
import {
  isValidSolanaAddress,
  isValidTransactionSignature,
} from './lib/validation';
import { verifyPresaleTokenTransaction } from './lib/solana-verification';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// In-memory storage for base mint keypairs
// Maps baseMint public key -> private key
const baseMintKeypairs = new Map<string, string>();

// In-memory storage for claim transactions
// Maps "token:timestamp" -> claim data (token-based to prevent multi-wallet exploits)
interface ClaimTransaction {
  tokenAddress: string;
  userWallet: string;
  claimAmount: string;
  mintDecimals: number;
  timestamp: number;
}
const claimTransactions = new Map<string, ClaimTransaction>();

// Mutex locks for preventing concurrent claim processing
// Maps token address -> Promise that resolves when processing is done
// Lock is per-token since claim eligibility is global per token
const claimLocks = new Map<string, Promise<void>>();

async function acquireClaimLock(token: string): Promise<() => void> {
  const key = token.toLowerCase();

  // Wait for any existing lock to be released
  while (claimLocks.has(key)) {
    await claimLocks.get(key);
  }

  // Create a new lock
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  claimLocks.set(key, lockPromise);

  // Return the release function
  return () => {
    claimLocks.delete(key);
    releaseLock();
  };
}

const limiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 16, // 16 requests per IP per window
  keyGenerator: (req) => {
    // Cloudflare sends the real client IP in the CF-Connecting-IP header
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string') return ipKeyGenerator(cfIp);
    if (Array.isArray(cfIp)) return ipKeyGenerator(cfIp[0]);
    return ipKeyGenerator(req.ip || 'unknown');
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for presale claim endpoints
    return req.path.includes('/presale/') && req.path.includes('/claims');
  }
});

// Separate rate limiter for presale claim endpoints (more lenient)
const presaleClaimLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute (more lenient for claim operations)
  keyGenerator: (req) => {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string') return ipKeyGenerator(cfIp);
    if (Array.isArray(cfIp)) return ipKeyGenerator(cfIp[0]);
    return ipKeyGenerator(req.ip || 'unknown');
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many claim requests, please wait a moment.'
});

// Apply CORS first (before rate limiting) to ensure headers are always sent
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Apply general rate limiter
app.use(limiter);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: {
      hasRPC: !!process.env.RPC_URL,
      hasConfig: !!process.env.CONFIG_ADDRESS,
      hasStorage: !!process.env.DB_URL
    }
  });
});

// Launch token endpoint - returns unsigned transaction
app.post('/launch', async (req: Request, res: Response) => {
  try {
    const {
      name,
      symbol,
      description,
      image,
      website,
      twitter,
      caEnding,
      payerPublicKey,
      quoteToken
    } = req.body;

    // Validate required fields
    if (!name || !symbol || !payerPublicKey) {
      return res.status(400).json({
        error: 'Missing required fields: name, symbol, and payerPublicKey are required'
      });
    }

    // Validate optional fields
    if (caEnding && caEnding.length > 3) {
      return res.status(400).json({
        error: 'CA ending must be 3 characters or less'
      });
    }

    if (caEnding && /[0OIl]/.test(caEnding)) {
      return res.status(400).json({
        error: 'CA ending contains invalid Base58 characters (0, O, I, l)'
      });
    }

    // Prepare token launch (without recording to database)
    const result = await prepareTokenLaunch({
      name,
      symbol,
      description,
      image,
      website,
      twitter,
      caEnding,
      payerPublicKey,
      quoteToken: quoteToken || 'SOL'
    });

    // Store the token keypair in memory (not sent to client)
    baseMintKeypairs.set(result.baseMint, result.tokenKeypair);

    res.json({
      success: true,
      transaction: result.transaction,
      baseMint: result.baseMint,
      metadataUrl: result.metadataUrl,
      message: 'Sign this transaction and submit to /confirm-launch'
    });

  } catch (error) {
    console.error('Launch error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create launch transaction'
    });
  }
});

// Confirm launch endpoint - receives partially signed tx, adds base mint signature, sends on-chain
app.post('/confirm-launch', async (req: Request, res: Response) => {
  try {
    const {
      signedTransaction,
      baseMint,
      metadataUrl,
      name,
      symbol,
      payerPublicKey
    } = req.body;

    // Validate required fields
    if (!signedTransaction || !baseMint || !name || !symbol || !payerPublicKey) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    // Retrieve the token keypair from memory
    const tokenKeypair = baseMintKeypairs.get(baseMint);
    if (!tokenKeypair) {
      return res.status(400).json({
        error: 'Token keypair not found. Please call /launch first.'
      });
    }

    // Deserialize the partially signed transaction
    const connection = new Connection(process.env.RPC_URL!, 'confirmed');
    const transactionBuffer = bs58.decode(signedTransaction);
    const transaction = Transaction.from(transactionBuffer);

    // Add base mint keypair signature (after user has already signed)
    const baseMintKeypair = Keypair.fromSecretKey(bs58.decode(tokenKeypair));
    transaction.partialSign(baseMintKeypair);

    // Send the fully signed transaction
    const signature = await connection.sendRawTransaction(transaction.serialize());

    // Wait for confirmation and record in database
    const confirmResult = await confirmAndRecordLaunch(
      signature,
      baseMint,
      name,
      symbol,
      metadataUrl || '',
      payerPublicKey
    );

    // Clean up the keypair from memory after successful launch
    baseMintKeypairs.delete(baseMint);

    res.json({
      success: true,
      transactionSignature: signature,
      baseMint,
      metadataUrl,
      confirmation: confirmResult
    });

  } catch (error) {
    console.error('Confirm launch error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to confirm launch'
    });
  }
});

// Get claim eligibility info for a wallet and token
const getClaimInfo = async (req: Request, res: Response<ClaimInfoResponseBody | ErrorResponseBody>) => {
  try {
    const { tokenAddress } = req.params;
    const walletAddress = req.query.wallet as string;

    if (!walletAddress) {
      return res.status(400).json({
        error: 'Wallet address is required'
      });
    }

    // Get token launch time from database
    const tokenLaunchTime = await getTokenLaunchTime(tokenAddress);

    if (!tokenLaunchTime) {
      return res.status(404).json({
        error: 'Token not found'
      });
    }

    // Get claim data from on-chain with DB launch time
    const claimData = await calculateClaimEligibility(tokenAddress, tokenLaunchTime);

    const timeUntilNextClaim = Math.max(0, claimData.nextInflationTime.getTime() - new Date().getTime());

    res.json({
      walletAddress,
      tokenAddress,
      totalClaimed: claimData.totalClaimed.toString(),
      availableToClaim: claimData.availableToClaim.toString(),
      maxClaimableNow: claimData.maxClaimableNow.toString(),
      tokensPerPeriod: '1000000',
      inflationPeriods: claimData.inflationPeriods,
      tokenLaunchTime,
      nextInflationTime: claimData.nextInflationTime,
      canClaimNow: claimData.canClaimNow,
      timeUntilNextClaim,
    });
  } catch (error) {
    console.error('Error fetching claim info:', error);
    res.status(500).json({
      error: 'Failed to fetch claim information'
    });
  }
};

app.get('/claims/:tokenAddress', getClaimInfo);

// Create unsigned mint transaction for claiming
const createMintTransaction = async (req: Request<Record<string, never>, MintClaimResponseBody | ErrorResponseBody, MintClaimRequestBody>, res: Response<MintClaimResponseBody | ErrorResponseBody>) => {
  try {
    console.log("claim/mint request body:", req.body);
    const { tokenAddress, userWallet, claimAmount } = req.body;
    console.log("mint request", tokenAddress, userWallet, claimAmount);

    // Validate required environment variables
    const RPC_URL = process.env.RPC_URL;
    const PROTOCOL_PRIVATE_KEY = process.env.PROTOCOL_PRIVATE_KEY;
    const ADMIN_WALLET = process.env.ADMIN_WALLET || 'PLACEHOLDER_ADMIN_WALLET';

    if (!RPC_URL) {
      const errorResponse = { error: 'RPC_URL not configured' };
      console.log("claim/mint error response:", errorResponse);
      return res.status(500).json(errorResponse);
    }

    if (!PROTOCOL_PRIVATE_KEY) {
      const errorResponse = { error: 'PROTOCOL_PRIVATE_KEY not configured' };
      console.log("claim/mint error response:", errorResponse);
      return res.status(500).json(errorResponse);
    }

    if (!ADMIN_WALLET || ADMIN_WALLET === 'PLACEHOLDER_ADMIN_WALLET') {
      const errorResponse = { error: 'ADMIN_WALLET not configured' };
      console.log("claim/mint error response:", errorResponse);
      return res.status(500).json(errorResponse);
    }

    // Validate required parameters
    if (!tokenAddress || !userWallet || !claimAmount) {
      const errorResponse = { error: 'Missing required parameters' };
      console.log("claim/mint error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // Initialize connection
    const connection = new Connection(RPC_URL, "confirmed");
    const protocolKeypair = Keypair.fromSecretKey(bs58.decode(PROTOCOL_PRIVATE_KEY));
    const tokenMint = new PublicKey(tokenAddress);
    const userPublicKey = new PublicKey(userWallet);
    const adminPublicKey = new PublicKey(ADMIN_WALLET);

    // Get token launch time from database
    const tokenLaunchTime = await getTokenLaunchTime(tokenAddress);

    if (!tokenLaunchTime) {
      const errorResponse = { error: 'Token not found' };
      console.log("claim/mint error response:", errorResponse);
      return res.status(404).json(errorResponse);
    }

    // Validate claim amount input
    if (!claimAmount || typeof claimAmount !== 'string') {
      const errorResponse = { error: 'Invalid claim amount: must be a string' };
      console.log("claim/mint error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    if (!/^\d+$/.test(claimAmount)) {
      const errorResponse = { error: 'Invalid claim amount: must contain only digits' };
      console.log("claim/mint error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    const requestedAmount = BigInt(claimAmount);

    // Check for valid amount bounds
    if (requestedAmount <= BigInt(0)) {
      const errorResponse = { error: 'Invalid claim amount: must be greater than 0' };
      console.log("claim/mint error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    if (requestedAmount > BigInt(Number.MAX_SAFE_INTEGER)) {
      const errorResponse = { error: 'Invalid claim amount: exceeds maximum safe value' };
      console.log("claim/mint error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // Calculate 90/10 split (claimers get 90%, admin gets 10%)
    const claimersTotal = (requestedAmount * BigInt(9)) / BigInt(10);
    const adminAmount = requestedAmount - claimersTotal; // Ensures total equals exactly requestedAmount

    // Validate claim eligibility from on-chain data
    const claimEligibility = await calculateClaimEligibility(tokenAddress, tokenLaunchTime);

    if (requestedAmount > claimEligibility.availableToClaim) {
      const errorResponse = { error: 'Requested amount exceeds available claim amount' };
      console.log("claim/mint error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // Check if this is a designated token and validate the claimer
    const designatedClaim = await getDesignatedClaimByToken(tokenAddress);

    if (designatedClaim) {
      // This is a designated token
      const { verifiedWallet, embeddedWallet, originalLauncher } = await getVerifiedClaimWallets(tokenAddress);

      // Block the original launcher
      if (userWallet === originalLauncher) {
        const errorResponse = { error: 'This token has been designated to someone else. The designated user must claim it.' };
        console.log("claim/mint error response: Original launcher blocked from claiming designated token");
        return res.status(403).json(errorResponse);
      }

      // Check if the current user is authorized
      if (verifiedWallet || embeddedWallet) {
        if (userWallet !== verifiedWallet && userWallet !== embeddedWallet) {
          const errorResponse = { error: 'Only the verified designated user can claim this token' };
          console.log("claim/mint error response: Unauthorized wallet attempting to claim designated token");
          return res.status(403).json(errorResponse);
        }
      } else {
        const errorResponse = { error: 'The designated user must verify their social accounts before claiming' };
        console.log("claim/mint error response: Designated user not yet verified");
        return res.status(403).json(errorResponse);
      }
    } else {
      // Check for emission splits OR fall back to creator-only
      const hasRights = await hasClaimRights(tokenAddress, userWallet);
      if (!hasRights) {
        const errorResponse = { error: 'You do not have claim rights for this token' };
        console.log("claim/mint error response: User does not have claim rights");
        return res.status(403).json(errorResponse);
      }
    }

    // User can claim now if they have available tokens to claim
    if (claimEligibility.availableToClaim <= BigInt(0)) {
      const errorResponse = {
        error: 'No tokens available to claim yet',
        nextInflationTime: claimEligibility.nextInflationTime
      };
      console.log("claim/mint error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // Get mint info to calculate amount with decimals
    const mintInfo = await getMint(connection, tokenMint);
    const decimals = mintInfo.decimals;
    const adminAmountWithDecimals = adminAmount * BigInt(10 ** decimals);

    // Verify protocol has mint authority
    if (!mintInfo.mintAuthority || !mintInfo.mintAuthority.equals(protocolKeypair.publicKey)) {
      const errorResponse = { error: 'Protocol does not have mint authority for this token' };
      console.log("claim/mint error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // Query emission splits to determine distribution
    const emissionSplits = await getEmissionSplits(tokenAddress);

    // Calculate split amounts and prepare recipients
    interface SplitRecipient {
      wallet: string;
      amount: bigint;
      amountWithDecimals: bigint;
      label?: string;
    }

    const splitRecipients: SplitRecipient[] = [];

    if (emissionSplits.length > 0) {
      // Distribute according to configured splits
      console.log(`Found ${emissionSplits.length} emission splits for token ${tokenAddress}`);

      for (const split of emissionSplits) {
        const splitAmount = (claimersTotal * BigInt(Math.floor(split.split_percentage * 100))) / BigInt(10000);
        const splitAmountWithDecimals = splitAmount * BigInt(10 ** decimals);

        splitRecipients.push({
          wallet: split.recipient_wallet,
          amount: splitAmount,
          amountWithDecimals: splitAmountWithDecimals,
          label: split.label || undefined
        });

        console.log(`Split: ${split.split_percentage}% to ${split.recipient_wallet}${split.label ? ` (${split.label})` : ''}`);
      }
    } else {
      // No splits configured - fall back to 100% to creator
      const creatorWallet = await getTokenCreatorWallet(tokenAddress);
      if (!creatorWallet) {
        const errorResponse = { error: 'Token creator not found' };
        console.log("claim/mint error response:", errorResponse);
        return res.status(400).json(errorResponse);
      }

      splitRecipients.push({
        wallet: creatorWallet.trim(),
        amount: claimersTotal,
        amountWithDecimals: claimersTotal * BigInt(10 ** decimals),
        label: 'Creator'
      });

      console.log(`No emission splits found - 100% to creator ${creatorWallet}`);
    }

    // Get admin token account address
    const adminTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      adminPublicKey,
      true // allowOwnerOffCurve
    );

    // Create mint transaction
    const transaction = new Transaction();

    // Add idempotent instruction to create admin account (user pays)
    const createAdminAccountInstruction = createAssociatedTokenAccountIdempotentInstruction(
      userPublicKey, // payer
      adminTokenAccount,
      adminPublicKey, // owner
      tokenMint
    );
    transaction.add(createAdminAccountInstruction);

    // Create token accounts and mint instructions for each split recipient
    for (const recipient of splitRecipients) {
      const recipientPublicKey = new PublicKey(recipient.wallet);
      const recipientTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        recipientPublicKey
      );

      // Add idempotent instruction to create recipient account (user pays)
      const createRecipientAccountInstruction = createAssociatedTokenAccountIdempotentInstruction(
        userPublicKey, // payer
        recipientTokenAccount,
        recipientPublicKey, // owner
        tokenMint
      );
      transaction.add(createRecipientAccountInstruction);

      // Add mint instruction for this recipient
      const recipientMintInstruction = createMintToInstruction(
        tokenMint,
        recipientTokenAccount,
        protocolKeypair.publicKey,
        recipient.amountWithDecimals
      );
      transaction.add(recipientMintInstruction);
    }

    // Add mint instruction for admin (10%)
    const adminMintInstruction = createMintToInstruction(
      tokenMint,
      adminTokenAccount,
      protocolKeypair.publicKey,
      adminAmountWithDecimals
    );
    transaction.add(adminMintInstruction);

    // Get latest blockhash and set fee payer to user
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    // Clean up old transactions FIRST (older than 5 minutes) to prevent race conditions
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    for (const [key, data] of claimTransactions.entries()) {
      if (data.timestamp < fiveMinutesAgo) {
        claimTransactions.delete(key);
      }
    }

    // Create a unique key for this transaction with random component to prevent collisions
    const transactionKey = `${tokenAddress}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // Store transaction data for later confirmation
    claimTransactions.set(transactionKey, {
      tokenAddress,
      userWallet,
      claimAmount,
      mintDecimals: decimals,
      timestamp: Date.now()
    });

    // Store split recipients and admin info for validation in confirm endpoint
    const transactionMetadata = {
      splitRecipients: splitRecipients.map(r => ({
        wallet: r.wallet,
        amount: r.amount.toString(),
        label: r.label
      })),
      adminAmount: adminAmount.toString(),
      adminTokenAccount: adminTokenAccount.toString()
    };
    claimTransactions.set(`${transactionKey}_metadata`, transactionMetadata as any);

    // Serialize transaction for user to sign
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false
    });

    const successResponse = {
      success: true as const,
      transaction: bs58.encode(serializedTransaction),
      transactionKey,
      claimAmount: requestedAmount.toString(),
      splitRecipients: splitRecipients.map(r => ({
        wallet: r.wallet,
        amount: r.amount.toString(),
        label: r.label
      })),
      adminAmount: adminAmount.toString(),
      mintDecimals: decimals,
      message: 'Sign this transaction and submit to /claims/confirm'
    };

    console.log("claim/mint successful response:", successResponse);
    res.json(successResponse);

  } catch (error) {
    console.error('Mint transaction creation error:', error);
    const errorResponse = {
      error: 'Failed to create mint transaction',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    console.log("claim/mint error response:", errorResponse);
    res.status(500).json(errorResponse);
  }
};

app.post('/claims/mint', createMintTransaction);

// Confirm claim - receives user-signed tx, adds protocol signature, and submits
const confirmClaim = async (req: Request<Record<string, never>, ConfirmClaimResponseBody | ErrorResponseBody, ConfirmClaimRequestBody>, res: Response<ConfirmClaimResponseBody | ErrorResponseBody>) => {
  let releaseLock: (() => void) | null = null;

  try {
    console.log("claim/confirm request body:", req.body);
    const { signedTransaction, transactionKey } = req.body;

    // Validate required parameters
    if (!signedTransaction || !transactionKey) {
      const errorResponse = { error: 'Missing required fields: signedTransaction and transactionKey' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // Retrieve the transaction data from memory
    const claimData = claimTransactions.get(transactionKey);
    if (!claimData) {
      const errorResponse = { error: 'Transaction data not found. Please call /claims/mint first.' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // Retrieve the metadata with split amounts
    const metadata = claimTransactions.get(`${transactionKey}_metadata`) as any;
    if (!metadata) {
      const errorResponse = { error: 'Transaction metadata not found. Please call /claims/mint first.' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // Acquire lock IMMEDIATELY after getting claim data to prevent race conditions
    releaseLock = await acquireClaimLock(claimData.tokenAddress);

    // Check if ANY user has claimed this token recently
    const hasRecent = await hasRecentClaim(claimData.tokenAddress, 360);
    if (hasRecent) {
      const errorResponse = { error: 'This token has been claimed recently. Please wait before claiming again.' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // Pre-record the claim in database for audit trail
    // Global token lock prevents race conditions
    await preRecordClaim(
      claimData.userWallet,
      claimData.tokenAddress,
      claimData.claimAmount
    );

    // Validate required environment variables
    const RPC_URL = process.env.RPC_URL;
    const PROTOCOL_PRIVATE_KEY = process.env.PROTOCOL_PRIVATE_KEY;
    const ADMIN_WALLET = process.env.ADMIN_WALLET || 'PLACEHOLDER_ADMIN_WALLET';

    if (!RPC_URL || !PROTOCOL_PRIVATE_KEY) {
      const errorResponse = { error: 'Server configuration error' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(500).json(errorResponse);
    }

    if (!ADMIN_WALLET || ADMIN_WALLET === 'PLACEHOLDER_ADMIN_WALLET') {
      const errorResponse = { error: 'ADMIN_WALLET not configured' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(500).json(errorResponse);
    }

    // Initialize connection and keypair
    const connection = new Connection(RPC_URL, "confirmed");
    const protocolKeypair = Keypair.fromSecretKey(bs58.decode(PROTOCOL_PRIVATE_KEY));

    // Re-validate claim eligibility (security check)
    const tokenLaunchTime = await getTokenLaunchTime(claimData.tokenAddress);
    if (!tokenLaunchTime) {
      const errorResponse = { error: 'Token not found' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(404).json(errorResponse);
    }

    const claimEligibility = await calculateClaimEligibility(
      claimData.tokenAddress,
      tokenLaunchTime
    );

    const requestedAmount = BigInt(claimData.claimAmount);
    if (requestedAmount > claimEligibility.availableToClaim) {
      const errorResponse = { error: 'Claim eligibility has changed. Requested amount exceeds available claim amount.' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    if (claimEligibility.availableToClaim <= BigInt(0)) {
      const errorResponse = { error: 'No tokens available to claim anymore' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // Check if this token has a designated claim
    const designatedClaim = await getDesignatedClaimByToken(claimData.tokenAddress);

    let authorizedClaimWallet: string | null = null;
    let isDesignated = false;

    if (designatedClaim) {
      // This is a designated token
      isDesignated = true;

      // Check if the designated user has verified their account
      const { verifiedWallet, embeddedWallet, originalLauncher } = await getVerifiedClaimWallets(claimData.tokenAddress);

      // Block the original launcher from claiming designated tokens
      if (claimData.userWallet === originalLauncher) {
        const errorResponse = { error: 'This token has been designated to someone else. The designated user must claim it.' };
        console.log("claim/confirm error response: Original launcher blocked from claiming designated token");
        return res.status(403).json(errorResponse);
      }

      // Check if the current user is authorized to claim
      if (verifiedWallet || embeddedWallet) {
        // Allow either the verified wallet or embedded wallet to claim
        if (claimData.userWallet === verifiedWallet || claimData.userWallet === embeddedWallet) {
          authorizedClaimWallet = claimData.userWallet;
          console.log("Designated user authorized to claim:", { userWallet: claimData.userWallet, verifiedWallet, embeddedWallet });
        } else {
          const errorResponse = { error: 'Only the verified designated user can claim this token' };
          console.log("claim/confirm error response: Unauthorized wallet attempting to claim designated token");
          return res.status(403).json(errorResponse);
        }
      } else {
        // Designated user hasn't verified yet
        const errorResponse = { error: 'The designated user must verify their social accounts before claiming' };
        console.log("claim/confirm error response: Designated user not yet verified");
        return res.status(403).json(errorResponse);
      }
    } else {
      // Normal token - check if user has claim rights (via emission splits or creator status)
      const hasRights = await hasClaimRights(claimData.tokenAddress, claimData.userWallet);

      if (!hasRights) {
        const errorResponse = { error: 'You do not have claim rights for this token' };
        console.log("claim/confirm error response: User does not have claim rights");
        return res.status(403).json(errorResponse);
      }

      authorizedClaimWallet = claimData.userWallet;
      console.log("User has claim rights (via emission splits or creator status):", claimData.userWallet);
    }

    // At this point, authorizedClaimWallet is set to the wallet allowed to claim
    console.log("Authorized claim wallet:", authorizedClaimWallet);

    // Deserialize the user-signed transaction
    const transactionBuffer = bs58.decode(signedTransaction);
    const transaction = Transaction.from(transactionBuffer);

    // SECURITY: Validate transaction has recent blockhash to prevent replay attacks
    if (!transaction.recentBlockhash) {
      const errorResponse = { error: 'Invalid transaction: missing blockhash' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // Check if blockhash is still valid (within last 150 slots ~60 seconds)
    const isBlockhashValid = await connection.isBlockhashValid(
      transaction.recentBlockhash,
      { commitment: 'confirmed' }
    );

    if (!isBlockhashValid) {
      const errorResponse = { error: 'Invalid transaction: blockhash is expired. Please create a new transaction.' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // CRITICAL SECURITY: Verify the transaction is cryptographically signed by the authorized wallet
    console.log("About to create PublicKey from authorizedClaimWallet:", { authorizedClaimWallet });
    let authorizedPublicKey;
    try {
      authorizedPublicKey = new PublicKey(authorizedClaimWallet!);
      console.log("Successfully created authorizedPublicKey:", authorizedPublicKey.toBase58());
    } catch (error) {
      console.error("Error creating PublicKey from authorizedClaimWallet:", error);
      const errorResponse = { error: 'Invalid authorized wallet format' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }
    let validAuthorizedSigner = false;

    // Compile the transaction message for signature verification
    const message = transaction.compileMessage();
    const messageBytes = message.serialize();

    // Find the authorized wallet's signer index
    const authorizedSignerIndex = message.accountKeys.findIndex(key =>
      key.equals(authorizedPublicKey)
    );

    if (authorizedSignerIndex >= 0 && authorizedSignerIndex < transaction.signatures.length) {
      const signature = transaction.signatures[authorizedSignerIndex];
      if (signature.signature) {
        // CRITICAL: Verify the signature is cryptographically valid using nacl
        const isValid = nacl.sign.detached.verify(
          messageBytes,
          signature.signature,
          authorizedPublicKey.toBytes()
        );
        validAuthorizedSigner = isValid;
      }
    }

    if (!validAuthorizedSigner) {
      const errorResponse = { error: isDesignated ? 'Invalid transaction: must be cryptographically signed by the verified designated wallet' : 'Invalid transaction: must be cryptographically signed by the token creator wallet' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // CRITICAL SECURITY: Derive the creator's Associated Token Account (ATA) address
    console.log("About to create mintPublicKey from tokenAddress:", { tokenAddress: claimData.tokenAddress });
    let mintPublicKey;
    try {
      mintPublicKey = new PublicKey(claimData.tokenAddress);
      console.log("Successfully created mintPublicKey:", mintPublicKey.toBase58());
    } catch (error) {
      console.error("Error creating PublicKey from tokenAddress:", error);
      const errorResponse = { error: 'Invalid token address format' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // Mathematically derive the creator's ATA address (no blockchain calls)
    console.log("About to create PDA with program constants");
    console.log("TOKEN_PROGRAM_ID:", TOKEN_PROGRAM_ID.toBase58());
    console.log("ASSOCIATED_TOKEN_PROGRAM_ID:", ASSOCIATED_TOKEN_PROGRAM_ID.toBase58());

    const [authorizedTokenAccountAddress] = PublicKey.findProgramAddressSync(
      [
        authorizedPublicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(), // SPL Token program
        mintPublicKey.toBuffer()
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID // Associated Token program
    );
    console.log("Successfully created authorizedTokenAccountAddress:", authorizedTokenAccountAddress.toBase58());

    // CRITICAL SECURITY: Derive the admin's ATA address
    const adminPublicKey = new PublicKey(ADMIN_WALLET);
    const [adminTokenAccountAddress] = PublicKey.findProgramAddressSync(
      [
        adminPublicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mintPublicKey.toBuffer()
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log("Successfully created adminTokenAccountAddress:", adminTokenAccountAddress.toBase58());

    // CRITICAL SECURITY: Validate that the transaction has exactly TWO mint instructions with correct amounts
    let mintInstructionCount = 0;
    let validDeveloperMint = false;
    let validAdminMint = false;

    console.log("Validating transaction with", transaction.instructions.length, "instructions");

    // First pass: count mint instructions
    for (const instruction of transaction.instructions) {
      if (instruction.programId.equals(TOKEN_PROGRAM_ID) &&
          instruction.data.length >= 9 &&
          instruction.data[0] === 7) {
        mintInstructionCount++;
      }
    }

    // Reject if not exactly TWO mint instructions
    if (mintInstructionCount === 0) {
      const errorResponse = { error: 'Invalid transaction: no mint instructions found' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    if (mintInstructionCount === 1) {
      const errorResponse = { error: 'Invalid transaction: missing admin mint instruction' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    if (mintInstructionCount > 2) {
      const errorResponse = { error: 'Invalid transaction: only two mint instructions allowed (developer + admin)' };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // Get the token decimals to convert claim amounts to base units
    const mintInfo = await getMint(connection, mintPublicKey);
    const expectedDeveloperAmountWithDecimals = BigInt(metadata.developerAmount) * BigInt(10 ** mintInfo.decimals);
    const expectedAdminAmountWithDecimals = BigInt(metadata.adminAmount) * BigInt(10 ** mintInfo.decimals);

    console.log("Expected amounts:", {
      developerAmount: metadata.developerAmount,
      adminAmount: metadata.adminAmount,
      developerAmountWithDecimals: expectedDeveloperAmountWithDecimals.toString(),
      adminAmountWithDecimals: expectedAdminAmountWithDecimals.toString()
    });

    // Second pass: validate BOTH mint instructions
    for (let i = 0; i < transaction.instructions.length; i++) {
      const instruction = transaction.instructions[i];
      console.log(`Instruction ${i}:`, {
        programId: instruction.programId.toString(),
        dataLength: instruction.data.length,
        keysLength: instruction.keys.length,
        firstByte: instruction.data.length > 0 ? instruction.data[0] : undefined
      });

      // Check if this is a mintTo instruction (SPL Token program)
      if (instruction.programId.equals(TOKEN_PROGRAM_ID)) {
        // Parse mintTo instruction - first byte is instruction type (7 = mintTo)
        if (instruction.data.length >= 9 && instruction.data[0] === 7) {
          console.log("Found mintTo instruction!");

          // Validate mint amount (bytes 1-8 are amount as little-endian u64)
          const mintAmount = instruction.data.readBigUInt64LE(1);

          // Validate complete mint instruction structure
          if (instruction.keys.length >= 3) {
            const mintAccount = instruction.keys[0].pubkey; // mint account
            const recipientAccount = instruction.keys[1].pubkey; // recipient token account
            const mintAuthority = instruction.keys[2].pubkey; // mint authority

            console.log("Mint instruction validation:", {
              mintAccount: mintAccount.toBase58(),
              expectedMint: mintPublicKey.toBase58(),
              mintMatches: mintAccount.equals(mintPublicKey),
              recipientAccount: recipientAccount.toBase58(),
              mintAmount: mintAmount.toString(),
              mintAuthority: mintAuthority.toBase58(),
              expectedAuthority: protocolKeypair.publicKey.toBase58(),
              authorityMatches: mintAuthority.equals(protocolKeypair.publicKey)
            });

            // CRITICAL SECURITY: Check if this is the developer mint instruction
            if (mintAccount.equals(mintPublicKey) &&
                recipientAccount.equals(authorizedTokenAccountAddress) &&
                mintAuthority.equals(protocolKeypair.publicKey) &&
                mintAmount === expectedDeveloperAmountWithDecimals) {
              validDeveloperMint = true;
              console.log("✓ Valid developer mint instruction found");
            }
            // CRITICAL SECURITY: Check if this is the admin mint instruction
            else if (mintAccount.equals(mintPublicKey) &&
                     recipientAccount.equals(adminTokenAccountAddress) &&
                     mintAuthority.equals(protocolKeypair.publicKey) &&
                     mintAmount === expectedAdminAmountWithDecimals) {
              validAdminMint = true;
              console.log("✓ Valid admin mint instruction found");
            }
            // SECURITY: Reject any mint instruction that doesn't match expected parameters
            else {
              const errorResponse = { error: 'Invalid transaction: mint instruction contains invalid parameters' };
              console.log("claim/confirm error response:", errorResponse);
              console.log("Rejected mint instruction:", {
                recipientMatches: recipientAccount.equals(authorizedTokenAccountAddress) || recipientAccount.equals(adminTokenAccountAddress),
                amountMatches: mintAmount === expectedDeveloperAmountWithDecimals || mintAmount === expectedAdminAmountWithDecimals,
                mintAmount: mintAmount.toString(),
                expectedDeveloper: expectedDeveloperAmountWithDecimals.toString(),
                expectedAdmin: expectedAdminAmountWithDecimals.toString()
              });
              return res.status(400).json(errorResponse);
            }
          }
        }
      }
    }

    // CRITICAL SECURITY: Ensure BOTH mint instructions were found and valid
    if (!validDeveloperMint) {
      const errorResponse = { error: `Invalid transaction: developer mint instruction missing or invalid` };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    if (!validAdminMint) {
      const errorResponse = { error: `Invalid transaction: admin mint instruction missing or invalid` };
      console.log("claim/confirm error response:", errorResponse);
      return res.status(400).json(errorResponse);
    }

    // Add protocol signature (mint authority)
    transaction.partialSign(protocolKeypair);

    // Send the fully signed transaction with proper configuration
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: 'processed'
      }
    );

    // Poll for confirmation status
    const maxAttempts = 20;
    const delayMs = 200;  // 200ms between polls
    let attempts = 0;
    let confirmation;

    while (attempts < maxAttempts) {
      const result = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: true
      });

      console.log(`Attempt ${attempts + 1}: Transaction status:`, JSON.stringify(result, null, 2));

      if (!result || !result.value) {
        // Transaction not found yet, wait and retry
        attempts++;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      if (result.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
      }

      // If confirmed or finalized, we're done
      if (result.value.confirmationStatus === 'confirmed' ||
          result.value.confirmationStatus === 'finalized') {
        confirmation = result.value;
        break;
      }

      // Still processing, wait and retry
      attempts++;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    if (!confirmation) {
      throw new Error('Transaction confirmation timeout');
    }


    // Get split recipients from metadata before cleanup
    const splitRecipients = metadata.splitRecipients || [];

    // Clean up the transaction data from memory
    claimTransactions.delete(transactionKey);
    claimTransactions.delete(`${transactionKey}_metadata`);

    const successResponse = {
      success: true as const,
      transactionSignature: signature,
      tokenAddress: claimData.tokenAddress,
      claimAmount: claimData.claimAmount,
      splitRecipients,
      confirmation
    };

    console.log("claim/confirm successful response:", successResponse);
    res.json(successResponse);

  } catch (error) {
    console.error('Confirm claim error:', error);
    const errorResponse = {
      error: error instanceof Error ? error.message : 'Failed to confirm claim'
    };
    console.log("claim/confirm error response:", errorResponse);
    res.status(500).json(errorResponse);
  } finally {
    // Always release the lock, even if an error occurred
    if (releaseLock) {
      releaseLock();
    }
  }
};

app.post('/claims/confirm', confirmClaim);

// ===== PRESALE CLAIM ENDPOINTS =====

// In-memory storage for presale claim transactions
interface PresaleClaimTransaction {
  tokenAddress: string;
  userWallet: string;
  claimAmount: string;
  userTokenAccount: string;
  escrowTokenAccount: string; // Add this to store the actual escrow token account
  mintDecimals: number;
  timestamp: number;
  escrowPublicKey: string;
  encryptedEscrowKey: string; // Store encrypted key, decrypt only when signing
}
const presaleClaimTransactions = new Map<string, PresaleClaimTransaction>();

// In-memory storage for presale launch transactions
interface StoredPresaleLaunchTransaction {
  combinedTx: string;
  tokenAddress: string;
  payerPublicKey: string;
  escrowPublicKey: string;
  baseMintKeypair: string; // Base58 encoded secret key for the base mint
  timestamp: number;
}
const presaleLaunchTransactions = new Map<string, StoredPresaleLaunchTransaction>();

// Clean up old presale launch transactions (older than 15 minutes)
const TRANSACTION_EXPIRY_MS = 15 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, tx] of presaleLaunchTransactions.entries()) {
    if (now - tx.timestamp > TRANSACTION_EXPIRY_MS) {
      presaleLaunchTransactions.delete(id);
    }
  }
}, 60 * 1000); // Run cleanup every minute

// Separate mutex locks for presale claims (per-token to prevent double claims)
const presaleClaimLocks = new Map<string, Promise<void>>();

async function acquirePresaleClaimLock(token: string): Promise<() => void> {
  const key = token.toLowerCase();

  // Wait for any existing lock to be released
  while (presaleClaimLocks.has(key)) {
    await presaleClaimLocks.get(key);
  }

  // Create a new lock
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  presaleClaimLocks.set(key, lockPromise);

  // Return the release function
  return () => {
    presaleClaimLocks.delete(key);
    releaseLock();
  };
}

// Get presale claim info endpoint
app.get('/presale/:tokenAddress/claims/:wallet', presaleClaimLimiter, async (req: Request, res: Response) => {
  try {
    const { tokenAddress, wallet } = req.params;

    if (!tokenAddress || !wallet) {
      return res.status(400).json({
        success: false,
        error: 'Token address and wallet are required'
      });
    }

    // Validate Solana addresses
    if (!isValidSolanaAddress(tokenAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token address format'
      });
    }

    if (!isValidSolanaAddress(wallet)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format'
      });
    }

    const vestingInfo: VestingInfo = await calculateVestingInfo(tokenAddress, wallet);

    res.json({ success: true, ...vestingInfo });
  } catch (error) {
    console.error('Error fetching presale claim info:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('No allocation')) {
        return res.status(404).json({
          success: false,
          error: 'No allocation found for this wallet'
        });
      }
      if (error.message.includes('not launched')) {
        return res.status(400).json({
          success: false,
          error: 'Presale not launched yet'
        });
      }
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch claim info'
    });
  }
});

// Create unsigned presale claim transaction
app.post('/presale/:tokenAddress/claims/prepare', presaleClaimLimiter, async (req: Request, res: Response) => {
  let releaseLock: (() => void) | null = null;

  try {
    const { tokenAddress } = req.params;
    const { userWallet } = req.body;

    if (!userWallet) {
      return res.status(400).json({ error: 'User wallet is required' });
    }

    // Validate Solana addresses
    if (!isValidSolanaAddress(tokenAddress)) {
      return res.status(400).json({ error: 'Invalid token address format' });
    }

    if (!isValidSolanaAddress(userWallet)) {
      return res.status(400).json({ error: 'Invalid user wallet address format' });
    }

    // Acquire lock for this token (using presale-specific lock)
    releaseLock = await acquirePresaleClaimLock(tokenAddress);

    // Get presale and vesting info
    const presale = await getPresaleByTokenAddress(tokenAddress);
    if (!presale || presale.status !== 'launched') {
      return res.status(400).json({ error: 'Presale not found or not launched' });
    }

    if (!presale.base_mint_address || !presale.escrow_priv_key) {
      return res.status(400).json({ error: 'Presale configuration incomplete' });
    }

    // Calculate claimable amount and validate
    const vestingInfo: VestingInfo = await calculateVestingInfo(tokenAddress, userWallet);

    // Validate user has a contribution/allocation
    if (!vestingInfo.totalAllocated || vestingInfo.totalAllocated === '0') {
      return res.status(400).json({ error: 'No token allocation found for this wallet' });
    }

    // Validate user's actual contribution exists in the database
    const userContribution = await getUserPresaleContribution(tokenAddress, userWallet);
    if (!userContribution || userContribution === BigInt(0)) {
      return res.status(400).json({ error: 'No contribution found for this wallet' });
    }

    // ENFORCE NEXT UNLOCK TIME - Prevent claiming before the next unlock period
    if (vestingInfo.nextUnlockTime && new Date() < vestingInfo.nextUnlockTime) {
      const timeUntilNextUnlock = vestingInfo.nextUnlockTime.getTime() - Date.now();
      const minutesRemaining = Math.ceil(timeUntilNextUnlock / 60000);
      return res.status(400).json({
        error: `Cannot claim yet. Next unlock in ${minutesRemaining} minutes at ${vestingInfo.nextUnlockTime.toISOString()}`,
        nextUnlockTime: vestingInfo.nextUnlockTime.toISOString(),
        minutesRemaining
      });
    }

    // The claimableAmount from vestingInfo already accounts for:
    // 1. Vesting schedule (how much has vested so far)
    // 2. Already claimed amounts (subtracts what was previously claimed)
    // So we just need to validate it's positive
    const claimAmount = new BN(vestingInfo.claimableAmount);

    if (claimAmount.isZero() || claimAmount.isNeg()) {
      return res.status(400).json({ error: 'No tokens available to claim at this time' });
    }

    // Decrypt escrow keypair only to get the public key for transaction building
    const escrowKeypair = decryptEscrowKeypair(presale.escrow_priv_key);

    // Setup connection and get token info
    const connection = new Connection(process.env.RPC_URL!, 'confirmed');
    const baseMintPubkey = new PublicKey(presale.base_mint_address);
    const userPubkey = new PublicKey(userWallet);

    // Get mint info for decimals
    const mintInfo = await getMint(connection, baseMintPubkey);

    // Get user's token account address
    const userTokenAccountAddress = await getAssociatedTokenAddress(
      baseMintPubkey,
      userPubkey,
      true // Allow owner off curve
    );

    // Check if account exists
    let userTokenAccountInfo;
    try {
      userTokenAccountInfo = await connection.getAccountInfo(userTokenAccountAddress);
    } catch (err) {
      // Account doesn't exist
      userTokenAccountInfo = null;
    }

    // Get escrow's token account address
    const escrowTokenAccountAddress = await getAssociatedTokenAddress(
      baseMintPubkey,
      escrowKeypair.publicKey,
      true // Allow owner off curve
    );

    // Check if escrow account exists
    let escrowTokenAccountInfo;
    try {
      escrowTokenAccountInfo = await connection.getAccountInfo(escrowTokenAccountAddress);
    } catch (err) {
      escrowTokenAccountInfo = null;
    }

    // Create transaction
    const transaction = new Transaction();

    // Add instruction to create user's token account if it doesn't exist (user pays)
    if (!userTokenAccountInfo) {
      const createUserATAInstruction = createAssociatedTokenAccountInstruction(
        userPubkey, // payer (user pays)
        userTokenAccountAddress,
        userPubkey, // owner
        baseMintPubkey
      );
      transaction.add(createUserATAInstruction);
    }

    // Add instruction to create escrow's token account if it doesn't exist (user pays)
    if (!escrowTokenAccountInfo) {
      const createEscrowATAInstruction = createAssociatedTokenAccountInstruction(
        userPubkey, // payer (user pays for escrow account too)
        escrowTokenAccountAddress,
        escrowKeypair.publicKey, // owner
        baseMintPubkey
      );
      transaction.add(createEscrowATAInstruction);
    }

    // Create transfer instruction from escrow to user
    const transferInstruction = createTransferInstruction(
      escrowTokenAccountAddress,
      userTokenAccountAddress,
      escrowKeypair.publicKey,
      BigInt(claimAmount.toString())
    );
    transaction.add(transferInstruction);
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPubkey; // User pays for transaction fees

    // Store transaction data with encrypted escrow key
    const timestamp = Date.now();
    const claimKey = `${tokenAddress}:${timestamp}`;
    presaleClaimTransactions.set(claimKey, {
      tokenAddress,
      userWallet,
      claimAmount: claimAmount.toString(),
      userTokenAccount: userTokenAccountAddress.toBase58(),
      escrowTokenAccount: escrowTokenAccountAddress.toBase58(), // Store the actual escrow token account
      mintDecimals: mintInfo.decimals,
      timestamp,
      escrowPublicKey: escrowKeypair.publicKey.toBase58(),
      encryptedEscrowKey: presale.escrow_priv_key // Store encrypted key from DB
    });

    // Serialize transaction
    const serializedTx = bs58.encode(transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    }));

    res.json({
      success: true,
      transaction: serializedTx,
      timestamp,
      claimAmount: claimAmount.toString(),
      decimals: mintInfo.decimals
    });

  } catch (error) {
    console.error('Error preparing presale claim:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to prepare claim'
    });
  } finally {
    if (releaseLock) releaseLock();
  }
});

// Confirm presale claim transaction
app.post('/presale/:tokenAddress/claims/confirm', presaleClaimLimiter, async (req: Request, res: Response) => {
  let releaseLock: (() => void) | null = null;

  try {
    const { tokenAddress } = req.params;
    const { signedTransaction, timestamp } = req.body;

    if (!signedTransaction || !timestamp) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Validate token address
    if (!isValidSolanaAddress(tokenAddress)) {
      return res.status(400).json({ error: 'Invalid token address format' });
    }

    // Validate timestamp
    if (typeof timestamp !== 'number' || timestamp < 0 || timestamp > Date.now() + 60000) {
      return res.status(400).json({ error: 'Invalid timestamp' });
    }

    // Acquire lock (using presale-specific lock)
    releaseLock = await acquirePresaleClaimLock(tokenAddress);

    // Get stored transaction
    const claimKey = `${tokenAddress}:${timestamp}`;
    const storedClaim = presaleClaimTransactions.get(claimKey);

    if (!storedClaim) {
      console.error('[PRESALE CLAIM] Stored claim not found for key:', claimKey);
      return res.status(400).json({ error: 'Claim transaction not found or expired' });
    }

    // Verify timestamp (5 minute expiry)
    if (Date.now() - storedClaim.timestamp > 5 * 60 * 1000) {
      presaleClaimTransactions.delete(claimKey);
      return res.status(400).json({ error: 'Claim transaction expired' });
    }

    // RE-VALIDATE VESTING SCHEDULE - Critical security check
    // Even if a transaction was prepared, we must ensure it's still valid at confirm time
    const vestingInfo: VestingInfo = await calculateVestingInfo(tokenAddress, storedClaim.userWallet);

    // Enforce next unlock time
    if (vestingInfo.nextUnlockTime && new Date() < vestingInfo.nextUnlockTime) {
      const timeUntilNextUnlock = vestingInfo.nextUnlockTime.getTime() - Date.now();
      const minutesRemaining = Math.ceil(timeUntilNextUnlock / 60000);

      // Clean up the stored transaction since it's no longer valid
      presaleClaimTransactions.delete(claimKey);

      return res.status(400).json({
        error: `Cannot claim yet. Next unlock in ${minutesRemaining} minutes at ${vestingInfo.nextUnlockTime.toISOString()}`,
        nextUnlockTime: vestingInfo.nextUnlockTime.toISOString(),
        minutesRemaining
      });
    }

    // Verify the claim amount is still valid
    const currentClaimableAmount = new BN(vestingInfo.claimableAmount);
    const storedClaimAmount = new BN(storedClaim.claimAmount);

    if (currentClaimableAmount.lt(storedClaimAmount)) {
      // The claimable amount has decreased (shouldn't happen, but check for safety)
      presaleClaimTransactions.delete(claimKey);
      return res.status(400).json({
        error: 'Claim amount is no longer valid. Please prepare a new transaction.',
        currentClaimable: currentClaimableAmount.toString(),
        requestedAmount: storedClaimAmount.toString()
      });
    }

    // Deserialize the user-signed transaction
    const connection = new Connection(process.env.RPC_URL!, 'confirmed');
    const txBuffer = bs58.decode(signedTransaction);
    const transaction = Transaction.from(txBuffer);

    // SECURITY: Validate transaction has recent blockhash to prevent replay attacks
    if (!transaction.recentBlockhash) {
      return res.status(400).json({ error: 'Invalid transaction: missing blockhash' });
    }

    // Check if blockhash is still valid (within last 150 slots ~60 seconds)
    const isBlockhashValid = await connection.isBlockhashValid(
      transaction.recentBlockhash,
      { commitment: 'confirmed' }
    );

    if (!isBlockhashValid) {
      return res.status(400).json({
        error: 'Invalid transaction: blockhash is expired. Please create a new transaction.'
      });
    }

    // CRITICAL SECURITY: Verify the transaction is signed by the claiming wallet
    const userPubkey = new PublicKey(storedClaim.userWallet);
    let validUserSigner = false;

    // Compile the transaction message for signature verification
    const message = transaction.compileMessage();
    const messageBytes = message.serialize();

    // Find the user wallet's signer index
    const userSignerIndex = message.accountKeys.findIndex(key =>
      key.equals(userPubkey)
    );

    if (userSignerIndex >= 0 && userSignerIndex < transaction.signatures.length) {
      const signature = transaction.signatures[userSignerIndex];
      if (signature.signature) {
        // CRITICAL: Verify the signature is cryptographically valid using nacl
        const isValid = nacl.sign.detached.verify(
          messageBytes,
          signature.signature,
          userPubkey.toBytes()
        );
        validUserSigner = isValid;
      }
    }

    if (!validUserSigner) {
      return res.status(400).json({
        error: 'Invalid transaction: must be cryptographically signed by the claiming wallet'
      });
    }

    // CRITICAL SECURITY: Validate transaction structure
    // Check that it only contains expected instructions (transfer from escrow to user)
    let transferInstructionCount = 0;
    let validTransfer = false;
    const escrowPubkey = new PublicKey(storedClaim.escrowPublicKey);
    const userTokenAccount = new PublicKey(storedClaim.userTokenAccount);
    const mintPubkey = new PublicKey(tokenAddress);

    // Get the Compute Budget Program ID
    const COMPUTE_BUDGET_PROGRAM_ID = ComputeBudgetProgram.programId;
    const LIGHTHOUSE_PROGRAM_ID = new PublicKey("L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95");

    for (const instruction of transaction.instructions) {
      // Check if it's a Compute Budget instruction (optional, for setting compute units)
      if (instruction.programId.equals(COMPUTE_BUDGET_PROGRAM_ID)) {
        // This is fine, it's a compute budget instruction for optimizing transaction fees
        continue;
      }

      // Check if it's an ATA creation instruction (optional, only if account doesn't exist)
      if (instruction.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
        // This is fine, it's creating the user's token account
        continue;
      }

      // Check if it's a Lighthouse instruction
      if (instruction.programId.equals(LIGHTHOUSE_PROGRAM_ID)) {
        // This is fine, it's a Lighthouse instruction for optimizing transaction fees
        continue;
      }

      // Check if it's a transfer instruction
      if (instruction.programId.equals(TOKEN_PROGRAM_ID)) {
        // Transfer instruction has opcode 3 or 12 (Transfer or TransferChecked)
        const opcode = instruction.data[0];

        if (opcode === 3 || opcode === 12) {
          transferInstructionCount++;

          // Validate the transfer is from escrow to user
          // For Transfer (opcode 3): accounts are [source, destination, authority]
          // For TransferChecked (opcode 12): accounts are [source, mint, destination, authority]
          const sourceIndex = 0;
          const destIndex = opcode === 3 ? 1 : 2;
          const authorityIndex = opcode === 3 ? 2 : 3;

          if (instruction.keys.length > authorityIndex) {
            const source = instruction.keys[sourceIndex].pubkey;
            const destination = instruction.keys[destIndex].pubkey;
            const authority = instruction.keys[authorityIndex].pubkey;

            // For presale claims, we need to validate:
            // 1. The authority MUST be the escrow
            // 2. The destination MUST be the user's token account
            // 3. The source MUST be owned by the escrow (but might not be the ATA)

            const authorityMatchesEscrow = authority.equals(escrowPubkey);
            const destMatchesUser = destination.equals(userTokenAccount);

            // Since the source might not be an ATA, we should verify it's owned by the escrow
            // by checking the transaction itself or trusting that the escrow signature validates ownership
            // For now, we'll accept any source as long as the escrow is signing

            // Validate: authority is escrow and destination is user's account
            // We trust the source because only the escrow can sign for its accounts
            if (destMatchesUser && authorityMatchesEscrow) {

              // Validate transfer amount
              const amountBytes = opcode === 3
                ? instruction.data.slice(1, 9)  // Transfer: 8 bytes starting at index 1
                : instruction.data.slice(1, 9); // TransferChecked: 8 bytes starting at index 1

              const amount = new BN(amountBytes, 'le');
              const expectedAmount = new BN(storedClaim.claimAmount);

              if (amount.eq(expectedAmount)) {
                validTransfer = true;
              }
            }
          }
        } else {
          // Unexpected SPL Token instruction
          return res.status(400).json({
            error: 'Invalid transaction: unexpected token program instruction'
          });
        }
      } else if (!instruction.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID) &&
                 !instruction.programId.equals(COMPUTE_BUDGET_PROGRAM_ID) &&
                 !instruction.programId.equals(LIGHTHOUSE_PROGRAM_ID)) {
        console.log("instruction", instruction);
        // Unknown program - reject
        return res.status(400).json({
          error: 'Invalid transaction: contains unexpected instructions'
        });
      }
    }

    if (transferInstructionCount === 0) {
      return res.status(400).json({ error: 'Invalid transaction: no transfer instruction found' });
    }

    if (transferInstructionCount > 1) {
      return res.status(400).json({ error: 'Invalid transaction: only one transfer allowed' });
    }

    if (!validTransfer) {
      return res.status(400).json({
        error: 'Invalid transaction: transfer details do not match claim'
      });
    }

    // Now decrypt and add the escrow signature after all validations pass
    const escrowKeypair = decryptEscrowKeypair(storedClaim.encryptedEscrowKey);
    transaction.partialSign(escrowKeypair);

    // Send the fully signed transaction
    const fullySignedTxBuffer = transaction.serialize();
    const signature = await connection.sendRawTransaction(fullySignedTxBuffer, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });

    // Wait for confirmation using polling
    let confirmed = false;
    let retries = 0;
    const maxRetries = 60; // 60 seconds max

    while (!confirmed && retries < maxRetries) {
      try {
        const status = await connection.getSignatureStatus(signature);

        if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
          confirmed = true;
          break;
        }

        if (status?.value?.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
      } catch (statusError) {
        console.error('Status check error:', statusError);
        retries++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!confirmed) {
      throw new Error('Transaction confirmation timeout after 60 seconds');
    }

    // Get transaction details for verification
    const txDetails = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });

    // Record the claim in database
    await recordPresaleClaim(
      tokenAddress,
      storedClaim.userWallet,
      storedClaim.claimAmount,
      signature,
      txDetails?.blockTime || undefined,
      txDetails?.slot ? BigInt(txDetails.slot) : undefined
    );

    // Clean up stored transaction
    presaleClaimTransactions.delete(claimKey);

    const responseData = {
      success: true,
      signature,
      claimedAmount: storedClaim.claimAmount,
      decimals: storedClaim.mintDecimals
    };

    res.json(responseData);

  } catch (error) {
    console.error('[PRESALE CLAIM] Error confirming claim:', error);

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to confirm claim'
    });
  } finally {
    if (releaseLock) releaseLock();
  }
});

// Get presale stats endpoint
app.get('/presale/:tokenAddress/stats', async (req: Request, res: Response) => {
  try {
    const { tokenAddress } = req.params;

    // Validate token address
    if (!isValidSolanaAddress(tokenAddress)) {
      return res.status(400).json({
        error: 'Invalid token address format'
      });
    }

    const stats = await getPresaleStats(tokenAddress);

    res.json({ success: true, ...stats });
  } catch (error) {
    console.error('Error fetching presale stats:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch stats'
    });
  }
});

// ===== PRESALE BID ENDPOINTS =====

// In-memory lock to prevent concurrent processing of the same transaction
const transactionLocks = new Map<string, Promise<void>>();

async function acquireTransactionLock(signature: string): Promise<() => void> {
  const key = signature.toLowerCase();

  // Wait for any existing lock to be released
  while (transactionLocks.has(key)) {
    await transactionLocks.get(key);
  }

  // Create a new lock
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  transactionLocks.set(key, lockPromise);

  // Return the release function
  return () => {
    transactionLocks.delete(key);
    releaseLock();
  };
}

const ZC_TOKEN_MINT = 'GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC';
const ZC_DECIMALS = 6;
const ZC_PER_TOKEN = Math.pow(10, ZC_DECIMALS);

// Get presale bids endpoint
app.get('/presale/:tokenAddress/bids', async (req: Request, res: Response) => {
  try {
    const { tokenAddress } = req.params;

    if (!tokenAddress) {
      return res.status(400).json({
        error: 'Token address is required'
      });
    }

    // Validate token address
    if (!isValidSolanaAddress(tokenAddress)) {
      return res.status(400).json({
        error: 'Invalid token address format'
      });
    }

    // Fetch all bids and totals
    const [bids, totals] = await Promise.all([
      getPresaleBids(tokenAddress),
      getTotalPresaleBids(tokenAddress)
    ]);

    // Convert smallest units to $ZC for frontend display (6 decimals)
    const contributions = bids.map(bid => ({
      wallet: bid.wallet_address,
      amount: Number(bid.amount_lamports) / ZC_PER_TOKEN, // Now in $ZC
      transactionSignature: bid.transaction_signature,
      createdAt: bid.created_at
    }));

    const totalRaisedZC = Number(totals.totalAmount) / ZC_PER_TOKEN; // Now in $ZC

    res.json({
      totalRaised: totalRaisedZC,
      totalBids: totals.totalBids,
      contributions
    });

  } catch (error) {
    console.error('Error fetching presale bids:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch presale bids'
    });
  }
});

// Record presale bid endpoint
app.post('/presale/:tokenAddress/bids', async (req: Request, res: Response) => {
  let releaseLock: (() => void) | null = null;

  try {
    const { tokenAddress } = req.params;
    const { transactionSignature, walletAddress, amountTokens, tokenMint } = req.body;

    // Validate required fields
    if (!tokenAddress || !transactionSignature || !walletAddress || !amountTokens) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    // Validate token mint is $ZC
    if (!tokenMint || tokenMint !== ZC_TOKEN_MINT) {
      return res.status(400).json({
        error: 'Invalid token mint. Only $ZC tokens are accepted'
      });
    }

    // Validate Solana addresses
    if (!isValidSolanaAddress(tokenAddress)) {
      return res.status(400).json({
        error: 'Invalid token address format'
      });
    }

    if (!isValidSolanaAddress(walletAddress)) {
      return res.status(400).json({
        error: 'Invalid wallet address format'
      });
    }

    // Validate transaction signature
    if (!isValidTransactionSignature(transactionSignature)) {
      return res.status(400).json({
        error: 'Invalid transaction signature format'
      });
    }

    // Validate amount (now in token units with 6 decimals)
    if (!amountTokens || typeof amountTokens !== 'number' || amountTokens <= 0) {
      return res.status(400).json({
        error: 'Invalid amount: must be a positive number of tokens'
      });
    }

    // Acquire lock for this transaction to prevent concurrent processing
    releaseLock = await acquireTransactionLock(transactionSignature);

    // Fetch presale from database
    const presale = await getPresaleByTokenAddress(tokenAddress);

    if (!presale) {
      return res.status(404).json({
        error: 'Presale not found'
      });
    }

    // Verify escrow address exists
    if (!presale.escrow_pub_key) {
      return res.status(400).json({
        error: 'Presale escrow not configured'
      });
    }

    // CRITICAL: Check if transaction already exists BEFORE expensive verification
    let existingBid = await getPresaleBidBySignature(transactionSignature);
    if (existingBid) {
      console.log(`Transaction ${transactionSignature} already recorded`);
      return res.status(400).json({
        error: 'Transaction already recorded'
      });
    }

    // Now verify the $ZC token transaction on-chain
    console.log(`Verifying $ZC token transaction ${transactionSignature} for presale ${tokenAddress}`);

    const verification = await verifyPresaleTokenTransaction(
      transactionSignature,
      walletAddress, // sender owner
      presale.escrow_pub_key, // recipient owner
      ZC_TOKEN_MINT, // token mint
      BigInt(amountTokens), // amount in smallest units (6 decimals)
      300 // 5 minutes max age
    );

    if (!verification.valid) {
      console.error(`Token transaction verification failed: ${verification.error}`);
      return res.status(400).json({
        error: `Transaction verification failed: ${verification.error}`
      });
    }

    console.log(`Transaction ${transactionSignature} verified successfully`);

    // Double-check one more time after verification (belt and suspenders)
    existingBid = await getPresaleBidBySignature(transactionSignature);
    if (existingBid) {
      console.log(`Transaction ${transactionSignature} was recorded by another request during verification`);
      return res.status(400).json({
        error: 'Transaction already recorded'
      });
    }

    // Record the verified bid in the database
    // Note: We're keeping the database field as amount_lamports for backward compatibility
    // but now it represents smallest units of $ZC (6 decimals)
    try {
      const bid = await recordPresaleBid({
        presale_id: presale.id!,
        token_address: tokenAddress,
        wallet_address: walletAddress,
        amount_lamports: BigInt(amountTokens), // Now represents $ZC smallest units
        transaction_signature: transactionSignature,
        block_time: verification.details?.blockTime,
        slot: verification.details?.slot ? BigInt(verification.details.slot) : undefined,
        verified_at: new Date()
      });

      res.json({
        success: true,
        bid: {
          transactionSignature: bid.transaction_signature,
          amountZC: Number(bid.amount_lamports) / ZC_PER_TOKEN, // Convert to $ZC
        },
        verification: {
          blockTime: verification.details?.blockTime,
          slot: verification.details?.slot,
          verified: true
        }
      });

    } catch (error) {
      // Check if it's a duplicate transaction error
      if (error instanceof Error && error.message.includes('already recorded')) {
        return res.status(400).json({
          error: 'Transaction already recorded'
        });
      }

      console.error('Error recording bid:', error);
      return res.status(500).json({
        error: 'Failed to record bid'
      });
    }

  } catch (error) {
    console.error('Error saving presale bid:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to save bid'
    });
  } finally {
    // Always release the lock
    if (releaseLock) {
      releaseLock();
    }
  }
});

// Create presale launch transaction
app.post('/presale/:tokenAddress/launch', async (req: Request, res: Response) => {
  try {
    const { tokenAddress } = req.params;
    const { payerPublicKey } = req.body;

    if (!tokenAddress) {
      return res.status(400).json({ error: 'Token address is required' });
    }

    if (!payerPublicKey) {
      return res.status(400).json({ error: 'Payer public key is required' });
    }

    const RPC_URL = process.env.RPC_URL;
    const CONFIG_ADDRESS = process.env.FLYWHEEL_CONFIG_ADDRESS;
    const ZC_TOKEN_MINT = new PublicKey("GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC");
    const ZC_DECIMALS = 6;
    const ZC_PER_TOKEN = Math.pow(10, ZC_DECIMALS);

    if (!RPC_URL || !CONFIG_ADDRESS) {
      throw new Error('RPC_URL and CONFIG_ADDRESS must be configured');
    }

    // Fetch presale from database
    const presale = await getPresaleByTokenAddress(tokenAddress);

    if (!presale) {
      throw new Error('Presale not found');
    }

    // Verify caller is the creator
    if (presale.creator_wallet !== payerPublicKey) {
      throw new Error('Only the presale creator can launch');
    }

    // Check if already launched
    if (presale.status !== 'pending') {
      throw new Error('Presale has already been launched or is not pending');
    }

    // Verify escrow keys exist
    if (!presale.escrow_pub_key || !presale.escrow_priv_key) {
      throw new Error('Escrow keypair not found for this presale');
    }

    // Decrypt escrow keypair
    const escrowKeypair = decryptEscrowKeypair(presale.escrow_priv_key);

    // Verify escrow public key matches
    if (escrowKeypair.publicKey.toBase58() !== presale.escrow_pub_key) {
      throw new Error('Escrow keypair verification failed');
    }

    // Verify base mint key exists
    if (!presale.base_mint_priv_key) {
      throw new Error('Base mint keypair not found');
    }

    // Decrypt base mint keypair (stored as encrypted base58 string, not JSON array)
    const decryptedBase58 = decrypt(presale.base_mint_priv_key);
    const baseMintKeypair = Keypair.fromSecretKey(bs58.decode(decryptedBase58));

    // Verify base mint keypair by checking if we can recreate the same base58 string
    if (bs58.encode(baseMintKeypair.secretKey) !== decryptedBase58) {
      throw new Error('Base mint keypair verification failed');
    }

    // Get escrow's $ZC token balance
    const connection = new Connection(RPC_URL, "confirmed");

    // Get escrow's $ZC token account
    const escrowTokenAccount = await getAssociatedTokenAddress(
      ZC_TOKEN_MINT,
      escrowKeypair.publicKey,
      true
    );

    let escrowZCBalance = 0;
    try {
      const escrowTokenAccountInfo = await getAccount(connection, escrowTokenAccount);
      escrowZCBalance = Number(escrowTokenAccountInfo.amount);
    } catch (err) {
      throw new Error('Escrow $ZC token account not found or has no balance');
    }

    if (escrowZCBalance === 0) {
      throw new Error('Escrow wallet has no $ZC tokens');
    }

    // Use full escrow balance for the buy (no buffer needed for $ZC)
    const buyAmountTokens = escrowZCBalance;

    // Initialize Meteora client
    const client = new DynamicBondingCurveClient(connection, "confirmed");

    const baseMint = baseMintKeypair.publicKey;
    const payer = new PublicKey(payerPublicKey);
    const config = new PublicKey(CONFIG_ADDRESS);

    // Create pool with first buy using Meteora SDK - using $ZC as quote
    const { createPoolTx, swapBuyTx } = await client.pool.createPoolWithFirstBuy({
      createPoolParam: {
        baseMint,
        config, // This config must be configured for $ZC as quote token
        name: presale.token_name || '',
        symbol: presale.token_symbol || '',
        uri: presale.token_metadata_url,
        payer,
        poolCreator: payer
      },
      firstBuyParam: {
        buyer: escrowKeypair.publicKey,
        receiver: escrowKeypair.publicKey,
        buyAmount: new BN(buyAmountTokens), // Amount in $ZC smallest units (6 decimals)
        minimumAmountOut: new BN(0), // Accept any amount (no slippage protection for first buy)
        referralTokenAccount: null
      }
    });

    // Combine transactions into a single atomic transaction
    const combinedTx = new Transaction();

    // First, transfer SOL to escrow for token account creation and transaction fees
    // 0.005 SOL should cover rent exemption (~0.002 SOL) plus transaction fees
    const transferAmount = 5000000; // 0.005 SOL in lamports
    const transferSolInstruction = SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: escrowKeypair.publicKey,
      lamports: transferAmount,
    });

    // Add SOL transfer first
    combinedTx.add(transferSolInstruction);

    // Add all instructions from createPoolTx (this creates the mint first)
    combinedTx.add(...createPoolTx.instructions);

    // Add swap instructions if they exist
    if (swapBuyTx && swapBuyTx.instructions.length > 0) {
      combinedTx.add(...swapBuyTx.instructions);
    }

    // Set recent blockhash and fee payer
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    combinedTx.recentBlockhash = blockhash;
    combinedTx.feePayer = payer;

    // Serialize the combined transaction
    const combinedTxSerialized = bs58.encode(
      combinedTx.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      })
    );

    // Generate a unique transaction ID
    const transactionId = crypto.randomBytes(16).toString('hex');

    // Store transaction details for later verification
    presaleLaunchTransactions.set(transactionId, {
      combinedTx: combinedTxSerialized,
      tokenAddress,
      payerPublicKey,
      escrowPublicKey: escrowKeypair.publicKey.toBase58(),
      baseMintKeypair: bs58.encode(baseMintKeypair.secretKey), // Store the keypair for signing later
      timestamp: Date.now()
    });

    res.json({
      combinedTx: combinedTxSerialized,
      transactionId
    });

  } catch (error) {
    console.error('Presale launch error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create presale launch transaction'
    });
  }
});

// Confirm presale launch transaction
app.post('/presale/:tokenAddress/launch-confirm', async (req: Request, res: Response) => {
  try {
    const { tokenAddress } = req.params;
    const { signedTransaction, transactionId } = req.body;

    if (!tokenAddress) {
      return res.status(400).json({ error: 'Token address is required' });
    }

    if (!signedTransaction) {
      return res.status(400).json({ error: 'Signed transaction is required' });
    }

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const RPC_URL = process.env.RPC_URL;

    if (!RPC_URL) {
      throw new Error('RPC_URL must be configured');
    }

    // Retrieve stored transaction
    const storedTx = presaleLaunchTransactions.get(transactionId);

    if (!storedTx) {
      throw new Error('Transaction not found or expired. Please restart the launch process.');
    }

    // Verify this is for the correct token
    if (storedTx.tokenAddress !== tokenAddress) {
      throw new Error('Transaction token mismatch');
    }

    // Clean up stored transaction (one-time use)
    presaleLaunchTransactions.delete(transactionId);

    // Fetch presale from database to get escrow keypair
    const presale = await getPresaleByTokenAddress(tokenAddress);

    if (!presale) {
      throw new Error('Presale not found');
    }

    if (!presale.escrow_priv_key) {
      throw new Error('Escrow keypair not found');
    }

    // Decrypt escrow keypair
    const escrowKeypair = decryptEscrowKeypair(presale.escrow_priv_key);

    // Verify escrow public key matches
    if (escrowKeypair.publicKey.toBase58() !== storedTx.escrowPublicKey) {
      throw new Error('Escrow keypair mismatch');
    }

    // Reconstruct baseMint keypair from stored data (declare it in outer scope)
    if (!storedTx.baseMintKeypair) {
      throw new Error('BaseMint keypair not found in transaction data');
    }
    const baseMintKeypair = Keypair.fromSecretKey(bs58.decode(storedTx.baseMintKeypair));

    // Deserialize the signed transaction
    const transaction = Transaction.from(bs58.decode(signedTransaction));

    // Add escrow and baseMint signatures
    transaction.partialSign(escrowKeypair);
    transaction.partialSign(baseMintKeypair);

    // Send the fully signed transaction
    const connection = new Connection(RPC_URL, "confirmed");

    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      }
    );

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    // Calculate tokens bought by escrow after the swap
    let tokensBought = '0';
    try {
      // Use the baseMint from the generated keypair
      const baseMintPubKey = baseMintKeypair.publicKey;

      // Get escrow's token account address for the launched token
      const escrowTokenAccount = await getAssociatedTokenAddress(
        baseMintPubKey,
        escrowKeypair.publicKey
      );

      // Get the token account to read balance
      const tokenAccount = await getAccount(connection, escrowTokenAccount);
      tokensBought = tokenAccount.amount.toString();

      // Initialize presale claims with vesting (using the generated baseMint address)
      await initializePresaleClaims(tokenAddress, baseMintPubKey.toBase58(), tokensBought);

      console.log(`Presale ${tokenAddress}: ${tokensBought} tokens bought, claims initialized`);
    } catch (error) {
      console.error('Error initializing presale claims:', error);
      // Don't fail the launch if we can't initialize claims
    }

    // Update presale status with base mint address and tokens bought
    await updatePresaleStatus(tokenAddress, 'launched', baseMintKeypair.publicKey.toBase58(), tokensBought);

    res.json({
      success: true,
      signature,
      message: 'Presale launched successfully!'
    });

  } catch (error) {
    console.error('Presale launch confirmation error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to confirm presale launch'
    });
  }
});

// Cache for token verification - since token existence doesn't change, cache forever
const tokenVerificationCache = new Map<string, unknown>();

// Verify token exists using Helius getAsset
app.get('/verify-token/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({
        error: 'Token address is required'
      });
    }

    // Check cache first
    if (tokenVerificationCache.has(address)) {
      console.log(`Token verification cache hit for ${address}`);
      return res.json(tokenVerificationCache.get(address));
    }

    const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
    if (!HELIUS_API_KEY) {
      return res.status(500).json({
        error: 'Helius API key not configured'
      });
    }

    // Call Helius getAsset API
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'getAsset',
        params: {
          id: address
        }
      })
    });

    const data = await response.json();

    let cacheEntry;

    if (data.error) {
      // Check if it's specifically a "RecordNotFound" error (asset doesn't exist)
      if (data.error.code === -32000 && data.error.message?.includes('RecordNotFound')) {
        // Asset definitively doesn't exist - cache this
        cacheEntry = {
          exists: false,
          address
        };
        tokenVerificationCache.set(address, cacheEntry);
        return res.json(cacheEntry);
      }

      // Other API error - don't cache, just return error response
      console.error('Helius API error (not caching):', data.error);
      return res.json({
        exists: false,
        address,
        error: 'API error occurred'
      });
    }

    if (data.result && data.result.id) {
      // Asset exists - cache this
      cacheEntry = {
        exists: true,
        address,
        asset: data.result
      };
      tokenVerificationCache.set(address, cacheEntry);
      return res.json(cacheEntry);
    }

    // Unexpected response format - don't cache
    console.error('Unexpected Helius response format (not caching):', data);
    return res.json({
      exists: false,
      address,
      error: 'Unexpected response format'
    });

  } catch (error) {
    console.error('Token verification error:', error);
    // Don't expose internal errors - just return not found
    res.json({
      exists: false,
      address: req.params.address
    });
  }
});

async function startServer() {
  try {
    // await initializeDatabase();
    console.log('Database initialized');

    app.listen(PORT, () => {
      console.log(`\n🚀 Token Launch API Server`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Server:  http://localhost:${PORT}`);
      console.log(`Health:  http://localhost:${PORT}/health`);
      console.log(`\nEndpoints:`);
      console.log(`  POST /launch                    - Create unsigned transaction`);
      console.log(`  POST /confirm-launch            - Confirm partially signed transaction`);
      console.log(`  GET  /claims/:tokenAddress      - Get claim eligibility info`);
      console.log(`  POST /claims/mint               - Create unsigned mint transaction`);
      console.log(`  POST /claims/confirm            - Confirm claim transaction`);
      console.log(`  GET  /verify-token/:address     - Verify token exists on-chain`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only start if this file is run directly
if (require.main === module) {
  startServer();
}

export default app;
