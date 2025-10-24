#!/usr/bin/env tsx

// Debug script to fetch and display raw transaction data
// Usage: npx tsx debug-transactions.ts <token_address>

import dotenv from 'dotenv';

// Configure dotenv to read environment variables
dotenv.config();

interface SignatureInfo {
  signature: string;
  slot: number;
  err: object | null;
  memo: string | null;
  blockTime: number | null;
  confirmationStatus: string | null;
}

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

async function main() {
  const tokenAddress = process.argv[2];

  if (!tokenAddress) {
    console.log('Usage: npx tsx debug-transactions.ts <token_address>');
    process.exit(1);
  }

  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    console.error('HELIUS_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🔍 Fetching signatures for token:', tokenAddress);
  console.log('=====================================\n');

  try {
    // Step 1: Get signatures
    const signatureResponse = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [tokenAddress, { limit: 10 }]
      }),
    });

    const signatureData = await signatureResponse.json();

    if (signatureData.error) {
      console.error('❌ RPC Error:', signatureData.error);
      process.exit(1);
    }

    const signatures: SignatureInfo[] = signatureData.result || [];
    console.log('📋 Found signatures:', signatures.length);
    console.log('Signatures:', signatures.map(s => s.signature));
    console.log('\n=====================================\n');

    if (signatures.length === 0) {
      console.log('No signatures found');
      return;
    }

    // Step 2: Fetch full transaction details
    console.log('🔍 Fetching transaction details...\n');

    const signatureStrings = signatures.map(sig => sig.signature);
    const response = await fetch(`https://api.helius.xyz/v0/transactions?api-key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactions: signatureStrings,
      }),
    });

    if (!response.ok) {
      console.error('❌ Helius batch transactions API error:', response.statusText);
      process.exit(1);
    }

    const transactions: ParsedTransaction[] = await response.json();

    console.log('📄 Transaction Details:');
    console.log('=====================================\n');

    transactions.forEach((tx, index) => {
      if (!tx || !tx.signature) {
        console.log(`❌ Transaction ${index + 1}: Missing or null`);
        return;
      }

      console.log(`🔸 Transaction ${index + 1}:`);
      console.log(`  Signature: ${tx.signature}`);
      console.log(`  Timestamp: ${tx.timestamp} (${new Date(tx.timestamp * 1000).toISOString()})`);
      console.log(`  Type: ${tx.type || 'N/A'}`);
      console.log(`  Source: ${tx.source || 'N/A'}`);
      console.log(`  Fee: ${tx.fee || 'N/A'}`);
      console.log(`  Fee Payer: ${tx.feePayer || 'N/A'}`);

      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        console.log(`  Token Transfers (${tx.tokenTransfers.length}):`);
        tx.tokenTransfers.forEach((transfer, i) => {
          console.log(`    Transfer ${i + 1}:`);
          console.log(`      Mint: ${transfer.mint}`);
          console.log(`      From User: ${transfer.fromUserAccount || 'NULL'}`);
          console.log(`      To User: ${transfer.toUserAccount || 'NULL'}`);
          console.log(`      From Token Account: ${transfer.fromTokenAccount || 'NULL'}`);
          console.log(`      To Token Account: ${transfer.toTokenAccount || 'NULL'}`);
          console.log(`      Amount: ${transfer.tokenAmount}`);
          console.log(`      Standard: ${transfer.tokenStandard || 'N/A'}`);

          // Check if this transfer is for our target token
          if (transfer.mint === tokenAddress) {
            console.log(`      🎯 THIS IS OUR TARGET TOKEN!`);
          }
        });
      } else {
        console.log(`  Token Transfers: None`);
      }

      if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
        console.log(`  Native Transfers: ${tx.nativeTransfers.length}`);
      }

      if (tx.instructions && tx.instructions.length > 0) {
        console.log(`  Instructions: ${tx.instructions.length}`);
      }

      console.log('\n---\n');
    });

    console.log('=====================================');
    console.log('🔍 Analysis Summary:');
    console.log(`Total transactions fetched: ${transactions.length}`);

    const relevantTxs = transactions.filter(tx =>
      tx && tx.tokenTransfers && tx.tokenTransfers.some(transfer =>
        transfer.mint === tokenAddress
      )
    );

    console.log(`Transactions involving target token: ${relevantTxs.length}`);

    if (relevantTxs.length > 0) {
      console.log('\nTransaction types found:');
      const types: Record<string, number> = {};
      relevantTxs.forEach(tx => {
        const type = tx.type || 'UNKNOWN';
        types[type] = (types[type] || 0) + 1;
      });

      Object.entries(types).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

      console.log('\nSources found:');
      const sources: Record<string, number> = {};
      relevantTxs.forEach(tx => {
        const source = tx.source || 'UNKNOWN';
        sources[source] = (sources[source] || 0) + 1;
      });

      Object.entries(sources).forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch(console.error);