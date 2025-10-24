#!/usr/bin/env tsx
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createBurnInstruction,
  getMint
} from '@solana/spl-token';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration - hardcoded values as requested
const TOKEN_ADDRESS = 'GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC'; // Example: SOL wrapped token (replace with actual token)
const BURN_AMOUNT = 999999; // Amount in base units (adjust for token decimals)

async function burnTokens() {
  try {
    // Read private key from environment
    const privateKeyString = process.env.PRIVATE_KEY;
    if (!privateKeyString) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }

    // Create keypair from private key
    let keypair: Keypair;
    try {
      // Try to decode as base58 (common format)
      const privateKeyBytes = bs58.decode(privateKeyString);
      keypair = Keypair.fromSecretKey(privateKeyBytes);
    } catch {
      try {
        // Try to parse as JSON array
        const privateKeyArray = JSON.parse(privateKeyString);
        keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
      } catch {
        throw new Error('Invalid private key format. Use base58 string or JSON array format');
      }
    }

    // Initialize connection
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );

    console.log('Wallet address:', keypair.publicKey.toString());

    // Get token mint
    const mintPubkey = new PublicKey(TOKEN_ADDRESS);

    // Get mint info to determine decimals
    const mintInfo = await getMint(connection, mintPubkey);
    console.log('Token decimals:', mintInfo.decimals);

    // Calculate actual burn amount with decimals
    const actualBurnAmount = BURN_AMOUNT * Math.pow(10, mintInfo.decimals);
    console.log('Burning amount:', actualBurnAmount / Math.pow(10, mintInfo.decimals), 'tokens');

    // Get associated token account
    const tokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      keypair.publicKey
    );

    console.log('Token account:', tokenAccount.toString());

    // Check if token account exists and has sufficient balance
    const tokenAccountInfo = await connection.getAccountInfo(tokenAccount);
    if (!tokenAccountInfo) {
      throw new Error('Token account does not exist');
    }

    // Create burn instruction
    const burnInstruction = createBurnInstruction(
      tokenAccount,           // Token account
      mintPubkey,             // Mint
      keypair.publicKey,      // Owner
      actualBurnAmount        // Amount to burn
    );

    // Create transaction
    const transaction = new Transaction().add(burnInstruction);

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;

    // Sign transaction
    transaction.sign(keypair);

    console.log('Submitting burn transaction...');

    // Submit transaction
    const signature = await connection.sendRawTransaction(transaction.serialize());

    console.log('Transaction submitted:', signature);
    console.log('Explorer URL:', `https://solscan.io/tx/${signature}`);

    // Wait for confirmation
    console.log('Waiting for confirmation...');
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    console.log('✅ Tokens burned successfully!');
    console.log('Transaction signature:', signature);

  } catch (error) {
    console.error('❌ Error burning tokens:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  burnTokens();
}

export { burnTokens };