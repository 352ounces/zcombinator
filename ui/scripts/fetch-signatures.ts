#!/usr/bin/env tsx

import { Connection, PublicKey } from '@solana/web3.js';
import { config } from 'dotenv';

config();

interface SignatureInfo {
  signature: string;
  slot: number;
  blockTime?: number | null;
  memo?: string | null;
  err?: any;
}

async function fetchSignaturesFromPastHour(): Promise<void> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    console.error('Error: HELIUS_API_KEY environment variable is required');
    process.exit(1);
  }

  const connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`);

  const addressString = process.env.TARGET_ADDRESS || 'GZMLeHbDxurMD9me9X3ib9UbF3GYuditPbHprj8oTajZ';
  const address = new PublicKey(addressString);

  const oneHourAgo = Math.floor(Date.now() / 1000) - (60 * 60 * 24);

  console.log(`Fetching signatures for address: ${address.toBase58()}`);
  console.log(`Looking for transactions from the past hour (after ${new Date(oneHourAgo * 1000).toISOString()})`);
  console.log('---');

  try {
    const allSignatures: SignatureInfo[] = [];
    let lastSignature: string | null = null;
    const batchSize = 1000;
    let foundOlderThanHour = false;

    while (!foundOlderThanHour) {
      const options: any = { limit: batchSize };
      if (lastSignature) {
        options.before = lastSignature;
      }

      const signatures = await connection.getSignaturesForAddress(address, options);

      if (signatures.length === 0) {
        console.log('No more signatures found.');
        break;
      }

      for (const sigInfo of signatures) {
        if (sigInfo.blockTime && sigInfo.blockTime >= oneHourAgo) {
          allSignatures.push(sigInfo);
        } else {
          foundOlderThanHour = true;
          break;
        }
      }

      lastSignature = signatures[signatures.length - 1]?.signature;

      if (signatures.length < batchSize) {
        break;
      }
    }

    console.log(`Found ${allSignatures.length} signatures from the past hour\n`);

    if (allSignatures.length > 0) {
      allSignatures.forEach((sigInfo, index) => {
        const timestamp = sigInfo.blockTime ? new Date(sigInfo.blockTime * 1000).toISOString() : 'Unknown';
        const memo = sigInfo.memo || 'No memo';

        console.log(`${index + 1}. Signature: ${sigInfo.signature}`);
        console.log(`   Timestamp: ${timestamp}`);
        console.log(`   Slot: ${sigInfo.slot}`);
        console.log(`   Memo: ${memo}`);
        console.log(`   Status: ${sigInfo.err ? 'Failed' : 'Success'}`);
        console.log('---');
      });
    } else {
      console.log('No transactions found in the past hour for this address.');
    }

  } catch (error) {
    console.error('Error fetching signatures:', (error as Error).message);
    process.exit(1);
  }
}

fetchSignaturesFromPastHour();