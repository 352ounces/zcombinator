import { Connection, PublicKey } from '@solana/web3.js';
import { batchUpsertTokenHolders } from './db';

interface TokenHolder {
  owner: string;
  balance: number;
  rawBalance: string;
  percentage?: number;
}

interface HeliusTokenAccount {
  address: string;
  mint: string;
  owner: string;
  amount: string;
  delegatedAmount: number;
  frozen: boolean;
}

interface PaginatedResponse {
  total: number;
  limit: number;
  page: number;
  result: HeliusTokenAccount[];
  token_accounts?: HeliusTokenAccount[];
}

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const HELIUS_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const connection = new Connection(HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com');

export async function getTokenDecimals(mint: string): Promise<number> {
  try {
    const { getMint } = await import('@solana/spl-token');
    const mintPubkey = new PublicKey(mint);
    const mintInfo = await getMint(connection, mintPubkey);
    return mintInfo.decimals;
  } catch (error) {
    console.warn(`Failed to fetch token decimals for ${mint}, using default (6):`, error);
    return 6;
  }
}

export async function fetchTokenHoldersHelius(mint: string, page: number = 1, limit: number = 1000): Promise<PaginatedResponse> {
  const response = await fetch(HELIUS_RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'getTokenAccounts',
      id: 'holder-sync',
      params: {
        page,
        limit,
        displayOptions: {},
        mint,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Helius RPC error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data.result || { total: 0, limit, page, result: [] };
}

export async function fetchAllTokenHoldersHelius(mint: string, decimals: number): Promise<TokenHolder[]> {
  const holders: TokenHolder[] = [];
  let page = 1;
  const limit = 1000;
  let hasMore = true;
  const divisor = Math.pow(10, decimals);

  console.log(`Fetching token holders for mint: ${mint}`);

  while (hasMore) {
    try {
      console.log(`  Page ${page}...`);
      const response = await fetchTokenHoldersHelius(mint, page, limit);

      for (const account of (response.token_accounts || response.result || [])) {
        const balance = parseFloat(account.amount) / divisor;
        if (balance > 0) {
          holders.push({
            owner: account.owner,
            balance,
            rawBalance: account.amount,
          });
        }
      }

      const accountsCount = (response.token_accounts || response.result || []).length;
      console.log(`    Found ${accountsCount} accounts (Total so far: ${holders.length})`);

      hasMore = accountsCount === limit;
      page++;

      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      hasMore = false;
    }
  }

  return holders;
}

export async function fetchTokenHoldersRPC(mint: string, decimals: number): Promise<TokenHolder[]> {
  console.log('Using RPC method to fetch token holders...');

  const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  const mintPubkey = new PublicKey(mint);
  const divisor = Math.pow(10, decimals);

  const accounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
    dataSlice: {
      offset: 0,
      length: 165,
    },
    filters: [
      {
        dataSize: 165,
      },
      {
        memcmp: {
          offset: 0,
          bytes: mintPubkey.toBase58(),
        },
      },
    ],
  });

  const holders: TokenHolder[] = [];

  for (const account of accounts) {
    const data = account.account.data;
    const owner = new PublicKey(data.slice(32, 64)).toBase58();
    const amountBuffer = data.slice(64, 72);
    const amount = amountBuffer.readBigUInt64LE();
    const balance = Number(amount) / divisor;

    if (balance > 0) {
      holders.push({
        owner,
        balance,
        rawBalance: amount.toString(),
      });
    }
  }

  return holders;
}

export async function syncTokenHolders(tokenAddress: string): Promise<{
  success: boolean;
  holdersCount: number;
  error?: string;
}> {
  try {
    console.log(`Starting holder sync for token: ${tokenAddress}`);

    const decimals = await getTokenDecimals(tokenAddress);
    let holders: TokenHolder[] = [];

    if (HELIUS_API_KEY && HELIUS_API_KEY !== '') {
      try {
        holders = await fetchAllTokenHoldersHelius(tokenAddress, decimals);
      } catch (error) {
        console.error('Helius API failed, falling back to RPC method:', error);
        holders = await fetchTokenHoldersRPC(tokenAddress, decimals);
      }
    } else {
      console.log('No Helius API key found, using RPC method...');
      holders = await fetchTokenHoldersRPC(tokenAddress, decimals);
    }

    console.log(`Found ${holders.length} token holders`);

    // Convert holders to database format
    const dbHolders = holders.map(holder => ({
      wallet_address: holder.owner,
      token_balance: holder.balance.toString(),
      staked_balance: '0'
    }));

    // Batch upsert to database
    await batchUpsertTokenHolders(tokenAddress, dbHolders);

    console.log(`Successfully synced ${holders.length} holders for token ${tokenAddress}`);

    return {
      success: true,
      holdersCount: holders.length
    };

  } catch (error) {
    console.error('Error syncing token holders:', error);
    return {
      success: false,
      holdersCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}