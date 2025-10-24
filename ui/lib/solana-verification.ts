import { Connection, PublicKey, ParsedTransactionWithMeta, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

/**
 * Solana Transaction Verification Service
 * Verifies on-chain transactions to prevent fake bid submissions
 */

interface TokenVerificationResult {
  valid: boolean;
  error?: string;
  details?: {
    senderTokenAccount: string;
    recipientTokenAccount: string;
    senderOwner: string;
    recipientOwner: string;
    tokenMint: string;
    amountTokens: bigint;
    blockTime: number;
    slot: number;
  };
}

/**
 * Get a connection to Solana RPC with Helius for reliability
 */
function getConnection(): Connection {
  return new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
}

/**
 * Verify an SPL token presale contribution transaction
 * @param transactionSignature - The transaction signature to verify
 * @param expectedSenderOwner - The wallet address that should own the sender token account
 * @param expectedRecipientOwner - The escrow address that should own the recipient token account
 * @param expectedTokenMint - The expected token mint address ($ZC)
 * @param expectedAmount - The amount in smallest token units that should have been transferred
 * @param maxAgeSeconds - Maximum age of transaction in seconds (default: 300 = 5 minutes)
 */
export async function verifyPresaleTokenTransaction(
  transactionSignature: string,
  expectedSenderOwner: string,
  expectedRecipientOwner: string,
  expectedTokenMint: string,
  expectedAmount: bigint,
  maxAgeSeconds: number = 300
): Promise<TokenVerificationResult> {
  const connection = getConnection();

  try {
    // Fetch the parsed transaction from the blockchain
    const transaction = await connection.getParsedTransaction(
      transactionSignature,
      {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      }
    );

    // Check if transaction exists
    if (!transaction) {
      return {
        valid: false,
        error: 'Transaction not found on blockchain'
      };
    }

    // Check if transaction is confirmed (not failed)
    if (transaction.meta?.err) {
      return {
        valid: false,
        error: 'Transaction failed on blockchain'
      };
    }

    // Check transaction age
    const blockTime = transaction.blockTime;
    if (!blockTime) {
      return {
        valid: false,
        error: 'Transaction block time not available'
      };
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const transactionAge = currentTime - blockTime;

    if (transactionAge > maxAgeSeconds) {
      return {
        valid: false,
        error: `Transaction is too old (${transactionAge} seconds). Maximum age is ${maxAgeSeconds} seconds`
      };
    }

    // Parse and verify the token transfer
    const transferInfo = extractTokenTransfer(
      transaction,
      expectedSenderOwner,
      expectedRecipientOwner,
      expectedTokenMint
    );

    if (!transferInfo) {
      return {
        valid: false,
        error: 'No matching SPL Token transfer found in transaction'
      };
    }

    // Verify the amount matches
    if (transferInfo.amountTokens !== expectedAmount) {
      return {
        valid: false,
        error: `Amount mismatch. Expected ${expectedAmount} tokens, got ${transferInfo.amountTokens}`
      };
    }

    // All checks passed!
    return {
      valid: true,
      details: {
        senderTokenAccount: transferInfo.senderTokenAccount,
        recipientTokenAccount: transferInfo.recipientTokenAccount,
        senderOwner: transferInfo.senderOwner,
        recipientOwner: transferInfo.recipientOwner,
        tokenMint: transferInfo.tokenMint,
        amountTokens: transferInfo.amountTokens,
        blockTime: blockTime,
        slot: transaction.slot
      }
    };

  } catch (error) {
    console.error('Error verifying token transaction:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown verification error'
    };
  }
}

/**
 * Extract SPL Token transfer details from a parsed transaction
 */
function extractTokenTransfer(
  transaction: ParsedTransactionWithMeta,
  expectedSenderOwner: string,
  expectedRecipientOwner: string,
  expectedTokenMint: string
): {
  senderTokenAccount: string;
  recipientTokenAccount: string;
  senderOwner: string;
  recipientOwner: string;
  tokenMint: string;
  amountTokens: bigint;
} | null {

  if (!transaction.transaction.message.instructions) {
    return null;
  }

  // Look for SPL Token transfer instructions
  for (const instruction of transaction.transaction.message.instructions) {
    if ('parsed' in instruction && instruction.parsed) {
      const parsed = instruction.parsed;

      // Check if this is an SPL Token transfer or transferChecked
      if (
        (parsed.type === 'transfer' || parsed.type === 'transferChecked') &&
        instruction.program === 'spl-token' &&
        parsed.info
      ) {
        const info = parsed.info;

        // For transferChecked, we have the mint directly
        if (parsed.type === 'transferChecked' && info.mint !== expectedTokenMint) {
          continue;
        }

        // Get token account owners from pre/post balances
        const preTokenBalances = transaction.meta?.preTokenBalances || [];
        const postTokenBalances = transaction.meta?.postTokenBalances || [];

        // Find the source and destination accounts in token balances
        let sourceOwner = '';
        let destOwner = '';
        let tokenMint = '';

        for (const balance of preTokenBalances) {
          if (balance.accountIndex !== undefined) {
            const accountKey = transaction.transaction.message.accountKeys[balance.accountIndex];
            const pubkey = typeof accountKey === 'string' ? accountKey : accountKey.pubkey.toString();

            if (pubkey === info.source) {
              sourceOwner = balance.owner || '';
              tokenMint = balance.mint || '';
            } else if (pubkey === info.destination) {
              destOwner = balance.owner || '';
            }
          }
        }

        // Double check with post balances if needed
        if (!destOwner) {
          for (const balance of postTokenBalances) {
            if (balance.accountIndex !== undefined) {
              const accountKey = transaction.transaction.message.accountKeys[balance.accountIndex];
              const pubkey = typeof accountKey === 'string' ? accountKey : accountKey.pubkey.toString();

              if (pubkey === info.destination) {
                destOwner = balance.owner || '';
                break;
              }
            }
          }
        }

        // Verify the mint matches
        if (tokenMint && tokenMint !== expectedTokenMint) {
          continue;
        }

        // Verify sender and recipient owners match
        if (
          sourceOwner === expectedSenderOwner &&
          destOwner === expectedRecipientOwner
        ) {
          // Parse the token amount
          const amountTokens = BigInt(parsed.type === 'transferChecked' ? info.tokenAmount.amount : info.amount);

          return {
            senderTokenAccount: info.source,
            recipientTokenAccount: info.destination,
            senderOwner: sourceOwner,
            recipientOwner: destOwner,
            tokenMint: tokenMint || info.mint || expectedTokenMint,
            amountTokens
          };
        }
      }
    }
  }

  // Also check inner instructions (for CPI transfers)
  if (transaction.meta?.innerInstructions) {
    for (const innerGroup of transaction.meta.innerInstructions) {
      for (const instruction of innerGroup.instructions) {
        if ('parsed' in instruction && instruction.parsed) {
          const parsed = instruction.parsed;

          if (
            (parsed.type === 'transfer' || parsed.type === 'transferChecked') &&
            instruction.program === 'spl-token' &&
            parsed.info
          ) {
            const info = parsed.info;

            // For transferChecked, we have the mint directly
            if (parsed.type === 'transferChecked' && info.mint !== expectedTokenMint) {
              continue;
            }

            // Similar logic as above for inner instructions
            const preTokenBalances = transaction.meta?.preTokenBalances || [];
            let sourceOwner = '';
            let destOwner = '';
            let tokenMint = '';

            for (const balance of preTokenBalances) {
              if (balance.accountIndex !== undefined) {
                const accountKey = transaction.transaction.message.accountKeys[balance.accountIndex];
                const pubkey = typeof accountKey === 'string' ? accountKey : accountKey.pubkey.toString();

                if (pubkey === info.source) {
                  sourceOwner = balance.owner || '';
                  tokenMint = balance.mint || '';
                } else if (pubkey === info.destination) {
                  destOwner = balance.owner || '';
                }
              }
            }

            if (tokenMint && tokenMint !== expectedTokenMint) {
              continue;
            }

            if (
              sourceOwner === expectedSenderOwner &&
              destOwner === expectedRecipientOwner
            ) {
              const amountTokens = BigInt(parsed.type === 'transferChecked' ? info.tokenAmount.amount : info.amount);

              return {
                senderTokenAccount: info.source,
                recipientTokenAccount: info.destination,
                senderOwner: sourceOwner,
                recipientOwner: destOwner,
                tokenMint: tokenMint || info.mint || expectedTokenMint,
                amountTokens
              };
            }
          }
        }
      }
    }
  }

  return null;
}