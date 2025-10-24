import { PublicKey } from '@solana/web3.js';

/**
 * Validate Solana wallet address format (must be on curve)
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  try {
    const pubkey = new PublicKey(address);
    // Wallet addresses must be on the ed25519 curve
    return PublicKey.isOnCurve(pubkey.toBuffer());
  } catch {
    return false;
  }
}

/**
 * Validate Solana token mint address format (can be off-curve PDA)
 */
export function isValidTokenMintAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  try {
    // Token addresses can be PDAs (off-curve) so we just verify it's a valid PublicKey
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate hex string format (for nonces)
 */
export function isValidHexString(str: string, expectedLength?: number): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }

  const hexRegex = /^[0-9a-fA-F]+$/;
  if (!hexRegex.test(str)) {
    return false;
  }

  if (expectedLength && str.length !== expectedLength) {
    return false;
  }

  return true;
}

/**
 * Validate base64 encoded signature
 */
export function isValidBase64Signature(signature: string): boolean {
  if (!signature || typeof signature !== 'string') {
    return false;
  }

  // Base64 regex pattern
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(signature)) {
    return false;
  }

  try {
    const decoded = Buffer.from(signature, 'base64');
    // Solana signatures are 64 bytes
    return decoded.length === 64;
  } catch {
    return false;
  }
}

/**
 * Sanitize social media username
 */
export function sanitizeSocialUsername(username: string | undefined): string | undefined {
  if (!username || typeof username !== 'string') {
    return undefined;
  }

  // Remove @ symbol if present
  const cleaned = username.replace('@', '');

  // Only allow alphanumeric, underscore, and hyphen
  const sanitized = cleaned.replace(/[^a-zA-Z0-9_-]/g, '');

  // Limit length
  if (sanitized.length > 50) {
    return sanitized.substring(0, 50);
  }

  return sanitized;
}

/**
 * Validate token address format (alias for isValidTokenMintAddress)
 */
export function isValidTokenAddress(address: string): boolean {
  return isValidTokenMintAddress(address);
}

/**
 * Validate challenge nonce format
 */
export function isValidChallengeNonce(nonce: string): boolean {
  // Nonces should be 16-character hex strings
  return isValidHexString(nonce, 16);
}

/**
 * Validates if a string is a valid transaction signature (base58)
 */
export function isValidTransactionSignature(signature: string): boolean {
  if (!signature || typeof signature !== 'string') {
    return false;
  }

  // Transaction signatures are 87-88 characters in base58
  if (signature.length < 87 || signature.length > 88) {
    return false;
  }

  // Check if it's a valid base58 string (no 0, O, I, l)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(signature);
}

/**
 * Validates if a value is a valid amount in lamports
 */
export function isValidLamportsAmount(amount: any): boolean {
  // Check if it's a number or string that can be converted to BigInt
  try {
    const bigIntAmount = BigInt(amount);

    // Must be positive
    if (bigIntAmount <= BigInt(0)) {
      return false;
    }

    // Max supply of SOL is ~500M SOL = 500M * 1e9 lamports
    const MAX_LAMPORTS = BigInt(500_000_000) * BigInt(1_000_000_000);
    if (bigIntAmount > MAX_LAMPORTS) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates token metadata
 */
export function validateTokenMetadata(metadata: {
  name?: string;
  symbol?: string;
  uri?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate name
  if (!metadata.name || typeof metadata.name !== 'string') {
    errors.push('Token name is required');
  } else if (metadata.name.length < 1 || metadata.name.length > 32) {
    errors.push('Token name must be between 1 and 32 characters');
  }

  // Validate symbol
  if (!metadata.symbol || typeof metadata.symbol !== 'string') {
    errors.push('Token symbol is required');
  } else if (metadata.symbol.length < 1 || metadata.symbol.length > 10) {
    errors.push('Token symbol must be between 1 and 10 characters');
  } else if (!/^[A-Z0-9]+$/.test(metadata.symbol)) {
    errors.push('Token symbol must contain only uppercase letters and numbers');
  }

  // Validate URI
  if (metadata.uri) {
    try {
      const url = new URL(metadata.uri);
      if (!['http:', 'https:', 'ipfs:'].includes(url.protocol)) {
        errors.push('URI must use http, https, or ipfs protocol');
      }
    } catch {
      errors.push('Invalid URI format');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates social media handles
 */
export function validateSocialHandle(handle: string, platform: 'twitter' | 'github'): boolean {
  if (!handle || typeof handle !== 'string') {
    return false;
  }

  // Remove @ if present
  const cleanHandle = handle.replace(/^@/, '');

  if (platform === 'twitter') {
    // Twitter handles: 1-15 characters, alphanumeric and underscore only
    return /^[A-Za-z0-9_]{1,15}$/.test(cleanHandle);
  } else if (platform === 'github') {
    // GitHub usernames: 1-39 characters, alphanumeric and hyphen (no consecutive hyphens)
    return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(cleanHandle);
  }

  return false;
}

/**
 * Sanitizes a string for safe database insertion (generic version)
 */
export function sanitizeString(input: string, maxLength: number = 255): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove control characters and trim
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '').trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}