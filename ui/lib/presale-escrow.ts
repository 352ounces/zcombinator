import { Keypair } from '@solana/web3.js';
import { encrypt, decrypt } from './crypto';

/**
 * Generate a new keypair for presale escrow
 * @returns Object containing the public key and encrypted private key
 */
export function generateEscrowKeypair(): {
  publicKey: string;
  encryptedPrivateKey: string;
} {
  // Generate a new Solana keypair
  const keypair = Keypair.generate();

  // Get the public key as a base58 string
  const publicKey = keypair.publicKey.toBase58();

  // Get the private key as a byte array, then convert to JSON string for encryption
  const privateKeyBytes = Array.from(keypair.secretKey);
  const privateKeyJson = JSON.stringify(privateKeyBytes);

  // Encrypt the private key
  const encryptedPrivateKey = encrypt(privateKeyJson);

  return {
    publicKey,
    encryptedPrivateKey
  };
}

/**
 * Decrypt and reconstruct a keypair from encrypted private key
 * @param encryptedPrivateKey - The encrypted private key from database
 * @returns Solana Keypair object
 */
export function decryptEscrowKeypair(encryptedPrivateKey: string): Keypair {
  // Decrypt the private key
  const privateKeyJson = decrypt(encryptedPrivateKey);

  // Parse the JSON to get the byte array
  const privateKeyBytes = JSON.parse(privateKeyJson);

  // Reconstruct the keypair from the private key bytes
  const keypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyBytes));

  return keypair;
}

/**
 * Verify that an encrypted private key can be decrypted and matches the public key
 * @param publicKey - The expected public key
 * @param encryptedPrivateKey - The encrypted private key to verify
 * @returns true if the keys match, false otherwise
 */
export function verifyEscrowKeypair(publicKey: string, encryptedPrivateKey: string): boolean {
  try {
    const keypair = decryptEscrowKeypair(encryptedPrivateKey);
    return keypair.publicKey.toBase58() === publicKey;
  } catch (error) {
    console.error('Keypair verification failed:', error);
    return false;
  }
}
