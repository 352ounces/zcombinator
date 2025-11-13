import axios from 'axios';
import { Keypair, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import 'dotenv/config';

/**
 * Minimal script to test the fee claim endpoint
 */

async function testFeeClaim() {
  // Configuration
  const API_URL = process.env.API_URL || 'https://api.zcombinator.io';
  const PAYER_PRIVATE_KEY = process.env.PAYER_PRIVATE_KEY;

  // Validate private key is provided
  if (!PAYER_PRIVATE_KEY) {
    console.error('✗ Error: PAYER_PRIVATE_KEY environment variable is required');
    console.error('Usage: PAYER_PRIVATE_KEY=<base58-private-key> tsx test-fee-claim.ts');
    process.exit(1);
  }

  // Create keypair from private key and derive the public key from it
  const payerKeypair = Keypair.fromSecretKey(bs58.decode(PAYER_PRIVATE_KEY));
  const PAYER_PUBLIC_KEY = payerKeypair.publicKey.toBase58();

  console.log('Testing Fee Claim Endpoint');
  console.log('=========================');
  console.log(`API URL: ${API_URL}`);
  console.log(`Payer Public Key: ${PAYER_PUBLIC_KEY}`);
  console.log();

  try {
    // Step 1: Call the /fee-claim/claim endpoint
    console.log('Step 1: Calling /fee-claim/claim...');
    const claimResponse = await axios.post(`${API_URL}/fee-claim/claim`, {
      payerPublicKey: PAYER_PUBLIC_KEY
    });

    console.log('\nClaim response received:');
    console.log(JSON.stringify(claimResponse.data, null, 2));

    if (!claimResponse.data.success) {
      console.error('\n✗ Claim failed');
      return;
    }

    console.log('\n✓ Claim successful!');
    console.log(`Request ID: ${claimResponse.data.requestId}`);
    console.log(`Pool Address: ${claimResponse.data.poolAddress}`);
    console.log(`Total Instructions: ${claimResponse.data.instructionsCount}`);
    console.log(`Estimated Fees:`);
    console.log(`  Token A: ${claimResponse.data.estimatedFees.tokenA}`);
    console.log(`  Token B: ${claimResponse.data.estimatedFees.tokenB}`);

    // Step 2: Sign the transaction
    console.log('\nStep 2: Signing transaction...');
    const unsignedTransaction = claimResponse.data.transaction;
    const requestId = claimResponse.data.requestId;

    // Deserialize the transaction
    const transactionBuffer = bs58.decode(unsignedTransaction);
    const transaction = Transaction.from(transactionBuffer);

    // Sign with the payer keypair
    transaction.partialSign(payerKeypair);

    // Serialize the signed transaction (requireAllSignatures: false because LP owner hasn't signed yet)
    const signedTransaction = bs58.encode(transaction.serialize({ requireAllSignatures: false }));

    console.log('✓ Transaction signed');

    // Step 3: Submit to confirm endpoint
    console.log('\nStep 3: Calling /fee-claim/confirm...');
    // process.exit(0);
    const confirmResponse = await axios.post(`${API_URL}/fee-claim/confirm`, {
      signedTransaction,
      requestId
    });

    console.log('\nConfirm response received:');
    console.log(JSON.stringify(confirmResponse.data, null, 2));

    if (confirmResponse.data.success) {
      console.log('\n✓ Fee claim confirmed!');
      console.log(`Signature: ${confirmResponse.data.signature}`);
      console.log(`Solscan: https://solscan.io/tx/${confirmResponse.data.signature}`);
    }

  } catch (error: any) {
    console.error('\n✗ Error occurred:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.request) {
      console.error('No response received from server');
      console.error(error.message);
    } else {
      console.error(error.message);
    }
  }
}

// Run the test
testFeeClaim();
