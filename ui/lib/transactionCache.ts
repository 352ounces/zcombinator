import {
  getCachedMintTransactions,
  batchStoreMintTransactions,
  getTotalMintedFromCache,
  getLatestCachedTransaction,
  type MintTransaction
} from './db';

const PROTOCOL_PUBLIC_KEY = 'Hq7Xh37tT4sesD6wA4DphYfxeMJRhhFWS3KVUSSGjqzc';

interface TokenTransfer {
  timestamp: number;
  signature: string;
  mint: string;
  fromUserAccount: string | null;
  toUserAccount: string;
  fromTokenAccount: string | null;
  toTokenAccount: string;
  tokenAmount: number;
  tokenStandard: string;
}

interface ParsedTransaction {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  tokenTransfers?: TokenTransfer[];
  nativeTransfers?: unknown[];
  instructions?: unknown[];
  [key: string]: unknown;
}

// Get signatures for address, optionally starting after a specific signature
async function getSignaturesForAddress(walletAddress: string, apiKey: string, untilSignature?: string): Promise<string[]> {
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const allSignatures: string[] = [];
  let lastSignature: string | undefined = undefined;
  let pageCount = 0;

  while (true) {
    pageCount++;

    const params: [string, { limit: number; before?: string; until?: string }] = [walletAddress, { limit: 1000 }];
    if (lastSignature) {
      params[1].before = lastSignature;
    }
    if (untilSignature) {
      params[1].until = untilSignature;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: pageCount.toString(),
        method: 'getSignaturesForAddress',
        params: params
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius RPC error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }

    if (!data.result || !Array.isArray(data.result) || data.result.length === 0) {
      break;
    }

    const pageSignatures: string[] = [];
    data.result.forEach((sigInfo: { signature?: string }) => {
      if (sigInfo.signature) {
        pageSignatures.push(sigInfo.signature);
      }
    });

    allSignatures.push(...pageSignatures);

    // Set up for next page
    lastSignature = pageSignatures[pageSignatures.length - 1];

    // If we got less than the limit, we're done
    if (pageSignatures.length < 1000) {
      break;
    }
  }

  return allSignatures;
}

// Batch fetch transactions from Helius (exactly like original)
async function batchFetchTransactions(signatures: string[], apiKey: string): Promise<{ transactions: ParsedTransaction[]; missingSignatures: string[] }> {
  const allTransactions: ParsedTransaction[] = [];
  const allMissingSignatures: string[] = [];
  const BATCH_SIZE = 100;

  for (let i = 0; i < signatures.length; i += BATCH_SIZE) {
    const chunk = signatures.slice(i, i + BATCH_SIZE);

    const response = await fetch(`https://api.helius.xyz/v0/transactions?api-key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactions: chunk,
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius batch transactions API error: ${response.statusText}`);
    }

    const transactionData = await response.json();

    for (let j = 0; j < chunk.length; j++) {
      const signature = chunk[j];
      const txData = transactionData[j];

      if (txData && txData.signature) {
        allTransactions.push(txData);
      } else {
        allMissingSignatures.push(signature);
      }
    }

    if (i + BATCH_SIZE < signatures.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return { transactions: allTransactions, missingSignatures: allMissingSignatures };
}

// Retry missing transactions (exactly like original)
async function retryMissingTransactions(signatures: string[], apiKey: string, maxRetries: number = 3): Promise<ParsedTransaction[]> {
  const allTransactions: ParsedTransaction[] = [];
  let currentSignatures = signatures;

  for (let attempt = 0; attempt < maxRetries && currentSignatures.length > 0; attempt++) {
    const { transactions, missingSignatures } = await batchFetchTransactions(currentSignatures, apiKey);
    allTransactions.push(...transactions);

    currentSignatures = missingSignatures;

    if (currentSignatures.length > 0 && attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  return allTransactions;
}

// Extract mint transactions for specific token/wallet pairs
// For transactions with multiple mints, sum all amounts and attribute to the wallet with the largest mint
function extractMintTransactions(transactions: ParsedTransaction[]): MintTransaction[] {
  const mintTransactions: MintTransaction[] = [];

  transactions.forEach(tx => {
    if (!tx.tokenTransfers || tx.type !== "TOKEN_MINT") {
      return;
    }

    // Collect all mints in this transaction
    const txMints: Array<{
      token_address: string;
      wallet_address: string;
      amount: bigint;
    }> = [];

    tx.tokenTransfers.forEach(transfer => {
      if (transfer.fromUserAccount === "" && transfer.toUserAccount) {
        txMints.push({
          token_address: transfer.mint,
          wallet_address: transfer.toUserAccount,
          amount: BigInt(Math.floor(transfer.tokenAmount))
        });
      }
    });

    if (txMints.length > 0) {
      // Find the wallet that received the most tokens
      const primaryRecipient = txMints.reduce((max, current) =>
        current.amount > max.amount ? current : max
      );

      // Sum all amounts
      const totalAmount = txMints.reduce((sum, mint) => sum + mint.amount, BigInt(0));

      // Store one row per signature with total amount attributed to primary recipient
      mintTransactions.push({
        signature: tx.signature,
        timestamp: tx.timestamp,
        token_address: primaryRecipient.token_address,
        wallet_address: primaryRecipient.wallet_address,
        amount: totalAmount,
        tx_data: tx
      });
    }
  });

  return mintTransactions;
}

// Filter mint transactions based on special case rules (applied when reading, not writing)
function filterMintTransactions(transactions: MintTransaction[], tokenAddress: string): MintTransaction[] {
  const SPECIAL_CASE_TOKEN = 'GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC';
  const IGNORED_MINT_ADDRESS = '3UwzWidPv4soJhGKdRXeXV4hwQ4vg6aZHhB6ZyP6x9X3';
  const IGNORED_PROTOCOL_ADDRESS = 'Hq7Xh37tT4sesD6wA4DphYfxeMJRhhFWS3KVUSSGjqzc';
  const DATE_FILTERED_TOKEN = 'C7MGcMnN8cXUkj8JQuMhkJZh6WqY2r8QnT3AUfKTkrix';
  const FILTER_BEFORE_DATE = new Date('2025-10-03T00:00:00Z').getTime() / 1000; // Oct 3rd 2025 in Unix timestamp

  return transactions.filter(tx => {
    // For ZC token, exclude mints to ignored addresses
    if (tx.token_address === SPECIAL_CASE_TOKEN &&
        (tx.wallet_address === IGNORED_MINT_ADDRESS || tx.wallet_address === IGNORED_PROTOCOL_ADDRESS)) {
      return false;
    }

    // For date filtered token, exclude mints before Oct 3rd 2025
    if (tx.token_address === DATE_FILTERED_TOKEN && tx.timestamp < FILTER_BEFORE_DATE) {
      return false;
    }

    return true;
  });
}

// Get all mint transactions with caching (copy of original logic with caching added)
export async function getAllMintTransactions(apiKey: string): Promise<ParsedTransaction[]> {
  try {
    // Step 1: Get transaction signatures from protocol public key (exactly like original)
    const signatures = await getSignaturesForAddress(PROTOCOL_PUBLIC_KEY, apiKey);

    // Step 2: Batch fetch transactions using Helius /v0/transactions endpoint (exactly like original)
    const { transactions, missingSignatures } = await batchFetchTransactions(signatures, apiKey);

    // Step 3: Retry any missing transactions (exactly like original)
    const retryTransactions = await retryMissingTransactions(missingSignatures, apiKey);
    const allTransactions = [...transactions, ...retryTransactions];

    // Filter for mint transactions only
    const mintTransactions = allTransactions.filter(tx => {
      return tx.tokenTransfers && tx.type === "TOKEN_MINT";
    });

    return mintTransactions;

  } catch (error) {
    console.error('Error fetching all mint transactions:', error);
    throw error;
  }
}

// Get cached mint history for a specific token/wallet with incremental sync
export async function getCachedTokenMintHistory(
  tokenAddress: string,
  apiKey: string
): Promise<{ totalMinted: bigint; transactions: MintTransaction[] }> {
  try {
    // Step 1: Check what's the latest transaction we already have cached
    const latestCachedTx = await getLatestCachedTransaction();

    // Step 2: Fetch new signatures since last cached signature
    const newSignatures = latestCachedTx
      ? await getSignaturesForAddress(PROTOCOL_PUBLIC_KEY, apiKey, latestCachedTx.signature)
      : await getSignaturesForAddress(PROTOCOL_PUBLIC_KEY, apiKey);

    // Step 3: Only fetch new transaction data if we have new signatures
    if (newSignatures.length > 0) {
      const { transactions, missingSignatures } = await batchFetchTransactions(newSignatures, apiKey);
      const retryTransactions = await retryMissingTransactions(missingSignatures, apiKey);
      const allNewTransactions = [...transactions, ...retryTransactions];

      // Filter for mint transactions and extract mint records
      const newMintTransactions = extractMintTransactions(allNewTransactions);

      // Step 4: Update DB with new transactions
      if (newMintTransactions.length > 0) {
        await batchStoreMintTransactions(newMintTransactions);
      }
    }

    // Step 7: Get final results from cache (now includes any new data)
    const allCachedTransactions = await getCachedMintTransactions(tokenAddress);

    // Step 8: Apply special case filtering after reading from DB
    const filteredTransactions = filterMintTransactions(allCachedTransactions, tokenAddress);

    // Step 9: Recalculate total from filtered transactions
    const totalMinted = filteredTransactions.reduce((sum, tx) => sum + tx.amount, BigInt(0));

    return {
      totalMinted,
      transactions: filteredTransactions
    };

  } catch (error) {
    console.error('Error fetching cached mint history:', error);
    throw error;
  }
}

