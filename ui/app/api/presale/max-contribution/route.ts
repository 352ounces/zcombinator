import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getWalletTokenBalance } from '@/lib/token-balance';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import VaultIDL from '@/lib/vault-idl.json';
import { CpAmm } from '@meteora-ag/cp-amm-sdk';
import { getPriceFromSqrtPrice } from '@meteora-ag/cp-amm-sdk';
import fs from 'fs/promises';
import path from 'path';

const connection = new Connection(
  process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
  'confirmed'
);

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const ZC_TOKEN_MINT = new PublicKey("GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC");
const OOGWAY_TOKEN_MINT = new PublicKey("C7MGcMnN8cXUkj8JQuMhkJZh6WqY2r8QnT3AUfKTkrix");

// Different program IDs for different vaults
const OOGWAY_VAULT_PROGRAM_ID = new PublicKey("5CAynsu6A5E2h4zE26gtL8dWPd7TGDDoYF31B2cj31sq");
const ZC_VAULT_PROGRAM_ID = new PublicKey("6CETAFdgoMZgNHCcjnnQLN2pu5pJgUz8QQd7JzcynHmD");

// Meteora CP-AMM pool for SOL/ZC
const SOL_TO_ZC_POOL = new PublicKey('CCZdbVvDqPN8DmMLVELfnt9G1Q9pQNt3bTGifSpUY9Ad');

// Hardcoded token prices in USD
const ZC_PRICE_USD = 0.0013721660048977647; // Replace with your desired ZC price
const OOG_PRICE_USD = 0.00012228389729623202; // Replace with your desired OOG price

// Vault share token addresses mapped to their underlying token mint and program ID
interface VaultConfig {
  underlyingMint: PublicKey;
  programId: PublicKey;
  snapshotFile?: string; // Optional snapshot file for this vault
}

const VAULT_SHARE_TOKEN_CONFIG: Record<string, VaultConfig> = {
  '7WTkGrztjkcwUWt9T3ivZacimmJVWeYyZUXy8EoBQNQ7': {
    underlyingMint: ZC_TOKEN_MINT,
    programId: ZC_VAULT_PROGRAM_ID,
    snapshotFile: 'szc-token-holders.json'
  },
  'BmpqPiXwGshSQg7WoYjuuUmo1At9kNdYYQQNDMBCFd1z': {
    underlyingMint: OOGWAY_TOKEN_MINT,
    programId: OOGWAY_VAULT_PROGRAM_ID,
    snapshotFile: 'oog-token-holders.json'
  }
};

interface TokenHolder {
  owner: string;
  amount: string;
}

interface TokenBalance {
  balance: number;
  usdValue: number;
}

interface MaxContributionResponse {
  walletAddress: string;
  maxContributionZC: number;
  breakdown: Record<string, TokenBalance>;
}

// Helper function to get share amount from snapshot
async function getShareAmountFromSnapshot(walletAddress: string, snapshotFile: string): Promise<string | null> {
  try {
    const filePath = path.join(process.cwd(), 'app/api/presale/max-contribution', snapshotFile);
    const data = await fs.readFile(filePath, 'utf-8');
    const holders = JSON.parse(data) as TokenHolder[];

    const holder = holders.find(h => h.owner === walletAddress);
    return holder ? holder.amount : null;
  } catch (error) {
    console.error(`Error reading snapshot file ${snapshotFile}:`, error);
    return null;
  }
}

// Helper function to get ZC price in SOL from Meteora CP-AMM pool
async function getZcPriceInSol(): Promise<number> {
  try {
    const cpAmm = new CpAmm(connection);
    const poolState = await cpAmm._program.account.pool.fetch(SOL_TO_ZC_POOL);

    // getPriceFromSqrtPrice returns price as "token B per token A"
    // Token A is ZC (6 decimals), Token B is SOL (9 decimals)
    // So this gives us: SOL per ZC (which is what we want!)
    const priceRaw = getPriceFromSqrtPrice(
      poolState.sqrtPrice,
      6, // Token A decimals (ZC - 6 decimals)
      9  // Token B decimals (SOL - 9 decimals)
    );

    // Convert BN to number
    const zcPriceInSol = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw);

    return zcPriceInSol;
  } catch (error) {
    console.error('Error fetching ZC price from Meteora:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('walletAddress');
    const whitelistedTokensParam = searchParams.get('whitelistedTokens');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (!whitelistedTokensParam) {
      return NextResponse.json(
        { error: 'Whitelisted tokens are required' },
        { status: 400 }
      );
    }

    // Parse whitelisted tokens
    const whitelistedTokens = whitelistedTokensParam.split(',').map(t => t.trim()).filter(t => t);

    if (whitelistedTokens.length === 0) {
      return NextResponse.json(
        { error: 'At least one whitelisted token is required' },
        { status: 400 }
      );
    }

    // Validate wallet address
    let walletPubkey: PublicKey;
    try {
      walletPubkey = new PublicKey(walletAddress);
    } catch {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Create a simple provider for view-only calls
    const createProvider = () => {
      // Create a dummy wallet for view-only calls
      const dummyWallet = {
        publicKey: walletPubkey,
        signTransaction: async () => { throw new Error('Not implemented'); },
        signAllTransactions: async () => { throw new Error('Not implemented'); },
      };

      return new AnchorProvider(
        connection,
        dummyWallet as any,
        { commitment: "confirmed" }
      );
    };

    // Fetch balances for all tokens
    const balancePromises = whitelistedTokens.map(async (tokenAddress) => {
      if (tokenAddress === SOL_MINT) {
        // Fetch SOL balance
        const balance = await connection.getBalance(walletPubkey);
        return {
          tokenAddress,
          balance: balance / LAMPORTS_PER_SOL
        };
      } else if (tokenAddress in VAULT_SHARE_TOKEN_CONFIG) {
        // Handle vault share tokens using previewRedeem
        try {
          const shareMintPubkey = new PublicKey(tokenAddress);
          const vaultConfig = VAULT_SHARE_TOKEN_CONFIG[tokenAddress];
          const underlyingMint = vaultConfig.underlyingMint;
          const programId = vaultConfig.programId;

          // Get the share amount from snapshot if available
          let shareAmount: string;
          if (vaultConfig.snapshotFile) {
            const snapshotAmount = await getShareAmountFromSnapshot(walletAddress, vaultConfig.snapshotFile);
            if (snapshotAmount) {
              shareAmount = snapshotAmount;
            } else {
              // User not in snapshot, return 0 balance
              return {
                tokenAddress,
                balance: 0
              };
            }
          } else {
            // No snapshot file configured, return 0 balance
            return {
              tokenAddress,
              balance: 0
            };
          }

          // Derive vault token account PDA for the underlying mint
          const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("token_vault"), underlyingMint.toBuffer()],
            programId
          );

          // Create program instance for view call
          const provider = createProvider();
          // Create a copy of the IDL with the correct program address
          const idlWithCorrectAddress = {
            ...VaultIDL,
            address: programId.toString()
          };
          const program = new Program(idlWithCorrectAddress as any, provider);

          // Use previewRedeem to get the underlying asset value
          const assets = await program.methods
            .previewRedeem(new BN(shareAmount))
            .accounts({
              shareMint: shareMintPubkey,
              vaultTokenAccount,
              mintOfTokenBeingSent: underlyingMint,
            })
            .view();

          const balance = Number(assets) / 1_000_000;
          return {
            tokenAddress,
            balance
          };
        } catch (error) {
          console.error(`Error fetching vault share balance for ${tokenAddress}:`, error);
          return {
            tokenAddress,
            balance: 0
          };
        }
      } else {
        // Fetch SPL token balance
        try {
          const balance = await getWalletTokenBalance(walletAddress, tokenAddress);
          return {
            tokenAddress,
            balance: parseFloat(balance)
          };
        } catch (error) {
          console.error(`Error fetching balance for ${tokenAddress}:`, error);
          return {
            tokenAddress,
            balance: 0
          };
        }
      }
    });

    const balances = await Promise.all(balancePromises);

    // Use hardcoded prices for ZC and OOG
    const zcPriceUsd = ZC_PRICE_USD;
    const oogPriceUsd = OOG_PRICE_USD;

    // Build list of tokens that need price fetching (excluding ZC and OOG)
    const tokensForPricing = whitelistedTokens
      .filter(token => {
        // Skip tokens with hardcoded prices
        if (token in VAULT_SHARE_TOKEN_CONFIG) {
          const underlyingMint = VAULT_SHARE_TOKEN_CONFIG[token].underlyingMint.toString();
          return underlyingMint !== ZC_TOKEN_MINT.toString() && underlyingMint !== OOGWAY_TOKEN_MINT.toString();
        }
        return token !== ZC_TOKEN_MINT.toString() && token !== OOGWAY_TOKEN_MINT.toString();
      });

    // Start with hardcoded prices
    const priceMap: Record<string, number> = {
      [ZC_TOKEN_MINT.toString()]: zcPriceUsd,
      [OOGWAY_TOKEN_MINT.toString()]: oogPriceUsd
    };

    // Only fetch prices from Jupiter if we have other tokens (like SOL)
    if (tokensForPricing.length > 0 || whitelistedTokens.includes(SOL_MINT)) {
      const allTokens = [...new Set([...tokensForPricing, SOL_MINT])];
      const tokenIds = allTokens.join(',');

      const priceResponse = await fetch(
        `https://lite-api.jup.ag/price/v3?ids=${tokenIds}`
      );

      if (!priceResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch token prices' },
          { status: 500 }
        );
      }

      const priceData = await priceResponse.json();

      // Add fetched prices to our price map
      Object.entries(priceData).forEach(([key, value]: [string, any]) => {
        if (value?.usdPrice) {
          priceMap[key] = value.usdPrice;
        }
      });
    }

    // Calculate USD values and build breakdown
    const breakdown: Record<string, TokenBalance> = {};
    let totalUsdValue = 0;

    for (const { tokenAddress, balance } of balances) {
      // For vault share tokens, use the underlying token price
      const priceTokenAddress = tokenAddress in VAULT_SHARE_TOKEN_CONFIG
        ? VAULT_SHARE_TOKEN_CONFIG[tokenAddress].underlyingMint.toString()
        : tokenAddress;
      const tokenPriceUsd = priceMap[priceTokenAddress];

      if (tokenPriceUsd) {
        const usdValue = balance * tokenPriceUsd;
        breakdown[tokenAddress] = {
          balance,
          usdValue
        };
        totalUsdValue += usdValue;
      } else {
        // If price not available, set USD value to 0
        breakdown[tokenAddress] = {
          balance,
          usdValue: 0
        };
      }
    }

    // Calculate max contribution in $ZC
    const maxContributionZC = totalUsdValue / zcPriceUsd;

    const response: MaxContributionResponse = {
      walletAddress,
      maxContributionZC: Math.floor(maxContributionZC), // Now represents $ZC amount
      breakdown
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error calculating max contribution:', error);
    return NextResponse.json(
      { error: 'Failed to calculate max contribution' },
      { status: 500 }
    );
  }
}
