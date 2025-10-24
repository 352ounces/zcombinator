/*
 * Z Combinator - Solana Token Launchpad
 * Copyright (C) 2025 Z Combinator
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const dbUrl = process.env.DB_URL;

    if (!dbUrl) {
      throw new Error('DB_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString: dbUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

export interface TokenLaunch {
  id?: number;
  launch_time: Date;
  creator_wallet: string;
  token_address: string;
  token_metadata_url: string;
  token_name?: string;
  token_symbol?: string;
  image_uri?: string;
  creator_twitter?: string;
  creator_github?: string;
  created_at?: Date;
  is_creator_designated?: boolean;
  verified?: boolean;
}


export interface VerificationChallenge {
  id?: number;
  wallet_address: string;
  challenge_nonce: string;
  challenge_message: string;
  expires_at: Date;
  used: boolean;
  created_at?: Date;
}

export interface MintTransaction {
  id?: number;
  signature: string;
  timestamp: number;
  token_address: string;
  wallet_address: string;
  amount: bigint;
  tx_data: Record<string, unknown>;
  created_at?: Date;
}

export interface ClaimRecord {
  id?: number;
  wallet_address: string;
  token_address: string;
  amount: string;
  transaction_signature: string;
  confirmed_at: Date;
}

export interface TokenHolder {
  id?: number;
  token_address: string;
  wallet_address: string;
  token_balance: string;
  staked_balance: string;
  telegram_username?: string | null;
  x_username?: string | null;
  discord_username?: string | null;
  custom_label?: string | null;
  created_at?: Date;
  updated_at?: Date;
  last_sync_at?: Date;
}

export interface DesignatedClaim {
  id?: number;
  token_address: string;
  original_launcher: string;
  designated_twitter?: string | null;
  designated_github?: string | null;
  verified_wallet?: string | null;
  verified_embedded_wallet?: string | null;
  verified_at?: Date | null;
  created_at?: Date;
}

export interface Presale {
  id?: number;
  token_address: string;
  base_mint_priv_key: string;
  creator_wallet: string;
  token_name?: string;
  token_symbol?: string;
  token_metadata_url: string;
  presale_tokens?: string[];
  creator_twitter?: string;
  creator_github?: string;
  status: string;
  escrow_pub_key?: string;
  escrow_priv_key?: string;
  tokens_bought?: string;
  launched_at?: Date;
  base_mint_address?: string;
  vesting_duration_hours?: number;
  ca_ending?: string;
  created_at?: Date;
}

export interface PresaleBid {
  id?: number;
  presale_id: number;
  token_address: string;
  wallet_address: string;
  amount_lamports: bigint;
  transaction_signature: string;
  block_time?: number;
  slot?: bigint;
  verified_at?: Date;
  created_at?: Date;
}

export interface PresaleClaim {
  id?: number;
  presale_id: number;
  wallet_address: string;
  tokens_allocated: string;
  tokens_claimed: string;
  last_claim_at?: Date;
  vesting_start_at: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface PresaleClaimTransaction {
  id?: number;
  presale_id: number;
  wallet_address: string;
  amount_claimed: string;
  transaction_signature: string;
  block_time?: number;
  slot?: bigint;
  verified_at: Date;
  created_at?: Date;
}


export async function recordTokenLaunch(launch: Omit<TokenLaunch, 'id' | 'created_at' | 'launch_time'>): Promise<TokenLaunch> {
  const pool = getPool();

  const query = `
    INSERT INTO token_launches (
      creator_wallet,
      token_address,
      token_metadata_url,
      token_name,
      token_symbol,
      creator_twitter,
      creator_github
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (token_address) DO NOTHING
    RETURNING *
  `;

  const values = [
    launch.creator_wallet,
    launch.token_address,
    launch.token_metadata_url,
    launch.token_name || null,
    launch.token_symbol || null,
    launch.creator_twitter || null,
    launch.creator_github || null
  ];

  try {
    const result = await pool.query(query, values);
    const tokenLaunch = result.rows[0];

    // If social profiles are provided, create a designated claim record
    if (tokenLaunch && (launch.creator_twitter || launch.creator_github)) {
      await createDesignatedClaim(
        tokenLaunch.token_address,
        tokenLaunch.creator_wallet,
        launch.creator_twitter,
        launch.creator_github
      );
    }

    return tokenLaunch;
  } catch (error) {
    console.error('Error recording token launch:', error);
    throw error;
  }
}

export async function getTokenLaunches(creatorWallet?: string, limit = 100): Promise<TokenLaunch[]> {
  const pool = getPool();

  let query = `
    SELECT * FROM token_launches
  `;

  const values: (string | null)[] = [];

  if (creatorWallet) {
    query += ' WHERE creator_wallet = $1';
    values.push(creatorWallet);
  }

  query += ' ORDER BY launch_time DESC';

  if (limit) {
    query += ` LIMIT ${limit}`;
  }

  try {
    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Error fetching token launches:', error);
    throw error;
  }
}

export async function getTokenLaunchByAddress(tokenAddress: string): Promise<TokenLaunch | null> {
  const pool = getPool();

  const query = `
    SELECT * FROM token_launches
    WHERE token_address = $1
  `;

  try {
    const result = await pool.query(query, [tokenAddress]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error fetching token launch by address:', error);
    throw error;
  }
}

export async function getTokenLaunchesBySocials(twitterUsername?: string, githubUrl?: string, limit = 100): Promise<TokenLaunch[]> {
  const pool = getPool();

  if (!twitterUsername && !githubUrl) {
    return [];
  }

  let query = `
    SELECT * FROM token_launches
    WHERE
  `;

  const conditions: string[] = [];
  const values: (string | null)[] = [];
  let paramCount = 0;

  // For Twitter/X, match both twitter.com and x.com URLs with the username
  if (twitterUsername) {
    // If it's just a username, build both URL formats
    // If it's already a full URL, extract the username first
    let username = twitterUsername;

    // Extract username if a full URL was passed
    if (twitterUsername.includes('twitter.com/') || twitterUsername.includes('x.com/')) {
      const match = twitterUsername.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/);
      username = match ? match[1] : twitterUsername;
    }

    // Match multiple URL formats: with/without https://, twitter.com/x.com
    const urlVariations = [
      `https://twitter.com/${username}`,
      `https://x.com/${username}`,
      `twitter.com/${username}`,
      `x.com/${username}`
    ];

    // Build OR conditions for all URL variations
    const orConditions = urlVariations.map(() => {
      paramCount++;
      return `creator_twitter = $${paramCount}`;
    }).join(' OR ');

    conditions.push(`(${orConditions})`);
    values.push(...urlVariations);
  }

  if (githubUrl) {
    // Extract username if needed
    let githubUsername = githubUrl;
    if (githubUrl.includes('github.com/')) {
      const match = githubUrl.match(/github\.com\/([A-Za-z0-9-]+)/);
      githubUsername = match ? match[1] : githubUrl;
    }

    // Match multiple URL formats for GitHub
    const githubVariations = [
      `https://github.com/${githubUsername}`,
      `github.com/${githubUsername}`
    ];

    const orConditions = githubVariations.map(() => {
      paramCount++;
      return `creator_github = $${paramCount}`;
    }).join(' OR ');

    conditions.push(`(${orConditions})`);
    values.push(...githubVariations);
  }

  query += conditions.join(' OR ');
  query += ' ORDER BY launch_time DESC';

  if (limit) {
    query += ` LIMIT ${limit}`;
  }

  try {
    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Error fetching token launches by socials:', error);
    throw error;
  }
}

export async function getTokenLaunchTime(tokenAddress: string): Promise<Date | null> {
  const pool = getPool();

  const query = `
    SELECT launch_time
    FROM token_launches
    WHERE token_address = $1
  `;

  try {
    const result = await pool.query(query, [tokenAddress]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Date(result.rows[0].launch_time);
  } catch (error) {
    console.error('Error fetching token launch time:', error);
    throw error;
  }
}

export async function getTokenCreatorWallet(tokenAddress: string): Promise<string | null> {
  const pool = getPool();

  const query = `
    SELECT creator_wallet
    FROM token_launches
    WHERE token_address = $1
  `;

  try {
    const result = await pool.query(query, [tokenAddress]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].creator_wallet;
  } catch (error) {
    console.error('Error fetching token creator wallet:', error);
    throw error;
  }
}

export async function initializeDatabase(): Promise<void> {
  const pool = getPool();

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS token_launches (
      id SERIAL PRIMARY KEY,
      launch_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      creator_wallet TEXT NOT NULL,
      token_address TEXT NOT NULL,
      token_metadata_url TEXT NOT NULL,
      token_name TEXT,
      token_symbol TEXT,
      creator_twitter TEXT,
      creator_github TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      verified BOOLEAN DEFAULT FALSE,
      UNIQUE(token_address)
    );

    CREATE INDEX IF NOT EXISTS idx_token_launches_creator_wallet ON token_launches(creator_wallet);
    CREATE INDEX IF NOT EXISTS idx_token_launches_launch_time ON token_launches(launch_time DESC);
    CREATE INDEX IF NOT EXISTS idx_token_launches_token_address ON token_launches(token_address);
    CREATE INDEX IF NOT EXISTS idx_token_launches_creator_twitter ON token_launches(creator_twitter);
    CREATE INDEX IF NOT EXISTS idx_token_launches_creator_github ON token_launches(creator_github);

    CREATE TABLE IF NOT EXISTS mint_transactions (
      id SERIAL PRIMARY KEY,
      signature TEXT UNIQUE NOT NULL,
      timestamp BIGINT NOT NULL,
      token_address TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      amount BIGINT NOT NULL,
      tx_data JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_mint_transactions_token_wallet ON mint_transactions(token_address, wallet_address);
    CREATE INDEX IF NOT EXISTS idx_mint_transactions_timestamp ON mint_transactions(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_mint_transactions_signature ON mint_transactions(signature);
    CREATE INDEX IF NOT EXISTS idx_mint_transactions_token_address ON mint_transactions(token_address);

    CREATE TABLE IF NOT EXISTS claim_records (
      id SERIAL PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      token_address TEXT NOT NULL,
      amount TEXT NOT NULL,
      transaction_signature TEXT UNIQUE NOT NULL,
      confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    -- Indexes optimized for token-based claim eligibility (global per token)
    CREATE INDEX IF NOT EXISTS idx_claim_records_token ON claim_records(token_address);
    CREATE INDEX IF NOT EXISTS idx_claim_records_token_time ON claim_records(token_address, confirmed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_claim_records_confirmed_at ON claim_records(confirmed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_claim_records_signature ON claim_records(transaction_signature);

    CREATE TABLE IF NOT EXISTS token_holders (
      id SERIAL PRIMARY KEY,
      token_address TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      token_balance NUMERIC(20,6) NOT NULL DEFAULT 0,
      staked_balance NUMERIC(20,6) NOT NULL DEFAULT 0,
      telegram_username TEXT,
      x_username TEXT,
      discord_username TEXT,
      custom_label TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      last_sync_at TIMESTAMP WITH TIME ZONE,
      UNIQUE(token_address, wallet_address)
    );

    CREATE INDEX IF NOT EXISTS idx_token_holders_token_address ON token_holders(token_address);
    CREATE INDEX IF NOT EXISTS idx_token_holders_wallet_address ON token_holders(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_token_holders_token_wallet ON token_holders(token_address, wallet_address);
    CREATE INDEX IF NOT EXISTS idx_token_holders_balance ON token_holders(token_address, token_balance DESC);
    CREATE INDEX IF NOT EXISTS idx_token_holders_telegram_lower ON token_holders(lower(telegram_username));
    CREATE INDEX IF NOT EXISTS idx_token_holders_x_lower ON token_holders(lower(x_username));
    CREATE INDEX IF NOT EXISTS idx_token_holders_discord_lower ON token_holders(lower(discord_username));

    CREATE TABLE IF NOT EXISTS designated_claims (
      id SERIAL PRIMARY KEY,
      token_address TEXT NOT NULL,
      original_launcher TEXT NOT NULL,
      designated_twitter TEXT,
      designated_github TEXT,
      verified_wallet TEXT,
      verified_embedded_wallet TEXT,
      verified_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE(token_address)
    );

    CREATE INDEX IF NOT EXISTS idx_designated_claims_token ON designated_claims(token_address);
    CREATE INDEX IF NOT EXISTS idx_designated_claims_launcher ON designated_claims(original_launcher);
    CREATE INDEX IF NOT EXISTS idx_designated_claims_twitter ON designated_claims(designated_twitter);
    CREATE INDEX IF NOT EXISTS idx_designated_claims_github ON designated_claims(designated_github);
    CREATE INDEX IF NOT EXISTS idx_designated_claims_verified_wallet ON designated_claims(verified_wallet);
    CREATE INDEX IF NOT EXISTS idx_designated_claims_verified_embedded ON designated_claims(verified_embedded_wallet);

    -- Security tables for verification
    CREATE TABLE IF NOT EXISTS verification_challenges (
      id SERIAL PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      challenge_nonce TEXT NOT NULL UNIQUE,
      challenge_message TEXT NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_verification_challenges_wallet ON verification_challenges(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_verification_challenges_nonce ON verification_challenges(challenge_nonce);
    CREATE INDEX IF NOT EXISTS idx_verification_challenges_expires ON verification_challenges(expires_at);

    CREATE TABLE IF NOT EXISTS verification_audit_logs (
      id SERIAL PRIMARY KEY,
      event_type TEXT NOT NULL,
      token_address TEXT,
      wallet_address TEXT,
      social_twitter TEXT,
      social_github TEXT,
      ip_address TEXT,
      user_agent TEXT,
      error_message TEXT,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON verification_audit_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_token ON verification_audit_logs(token_address);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_wallet ON verification_audit_logs(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON verification_audit_logs(created_at DESC);

    -- Add verification_lock column to designated_claims if not exists
    ALTER TABLE designated_claims ADD COLUMN IF NOT EXISTS verification_lock_until TIMESTAMP WITH TIME ZONE;
    ALTER TABLE designated_claims ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0;
    ALTER TABLE designated_claims ADD COLUMN IF NOT EXISTS last_verification_attempt TIMESTAMP WITH TIME ZONE;

    CREATE OR REPLACE FUNCTION update_token_holders_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    DROP TRIGGER IF EXISTS update_token_holders_updated_at_trigger ON token_holders;
    CREATE TRIGGER update_token_holders_updated_at_trigger
        BEFORE UPDATE ON token_holders
        FOR EACH ROW
        EXECUTE FUNCTION update_token_holders_updated_at();

    CREATE TABLE IF NOT EXISTS presales (
      id SERIAL PRIMARY KEY,
      token_address TEXT NOT NULL UNIQUE,
      creator_wallet TEXT NOT NULL,
      token_name TEXT,
      token_symbol TEXT,
      token_metadata_url TEXT NOT NULL,
      presale_tokens JSONB,
      creator_twitter TEXT,
      creator_github TEXT,
      status TEXT DEFAULT 'pending' NOT NULL,
      escrow_pub_key TEXT,
      escrow_priv_key TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_presales_token_address ON presales(token_address);
    CREATE INDEX IF NOT EXISTS idx_presales_creator_wallet ON presales(creator_wallet);
    CREATE INDEX IF NOT EXISTS idx_presales_status ON presales(status);
    CREATE INDEX IF NOT EXISTS idx_presales_created_at ON presales(created_at DESC);

    -- Add escrow key columns if they don't exist (for existing databases)
    ALTER TABLE presales ADD COLUMN IF NOT EXISTS escrow_pub_key TEXT;
    ALTER TABLE presales ADD COLUMN IF NOT EXISTS escrow_priv_key TEXT;

    CREATE TABLE IF NOT EXISTS presale_bids (
      id SERIAL PRIMARY KEY,
      presale_id INTEGER NOT NULL REFERENCES presales(id) ON DELETE CASCADE,
      token_address TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      amount_lamports BIGINT NOT NULL,
      transaction_signature TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_presale_bids_presale_id ON presale_bids(presale_id);
    CREATE INDEX IF NOT EXISTS idx_presale_bids_token_address ON presale_bids(token_address);
    CREATE INDEX IF NOT EXISTS idx_presale_bids_wallet_address ON presale_bids(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_presale_bids_transaction_signature ON presale_bids(transaction_signature);
    CREATE INDEX IF NOT EXISTS idx_presale_bids_created_at ON presale_bids(created_at DESC);

    -- Add verification fields if they don't exist (for existing databases)
    ALTER TABLE presale_bids ADD COLUMN IF NOT EXISTS block_time INTEGER;
    ALTER TABLE presale_bids ADD COLUMN IF NOT EXISTS slot BIGINT;
    ALTER TABLE presale_bids ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
  `;

  try {
    await pool.query(createTableQuery);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Cache management functions for mint transactions

export async function getCachedMintTransactions(
  tokenAddress: string
): Promise<MintTransaction[]> {
  const pool = getPool();

  const query = `
    SELECT id, signature, timestamp, token_address, wallet_address, amount, tx_data, created_at
    FROM mint_transactions
    WHERE token_address = $1
    ORDER BY timestamp ASC
  `;

  try {
    const result = await pool.query(query, [tokenAddress]);
    const transactions = result.rows.map(row => ({
      ...row,
      amount: BigInt(row.amount)
    }));

    // Special case: Filter out specific wallet for this token AFTER querying
    const SPECIAL_CASE_TOKEN = 'GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC';
    const IGNORED_WALLET = '3UwzWidPv4soJhGKdRXeXV4hwQ4vg6aZHhB6ZyP6x9X3';

    if (tokenAddress === SPECIAL_CASE_TOKEN) {
      return transactions.filter(tx => tx.wallet_address !== IGNORED_WALLET);
    }

    return transactions;
  } catch (error) {
    console.error('Error fetching cached mint transactions:', error);
    throw error;
  }
}

export async function storeMintTransaction(tx: Omit<MintTransaction, 'id' | 'created_at'>): Promise<void> {
  const pool = getPool();

  const query = `
    INSERT INTO mint_transactions (signature, timestamp, token_address, wallet_address, amount, tx_data)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (signature) DO NOTHING
  `;

  const values = [
    tx.signature,
    tx.timestamp,
    tx.token_address,
    tx.wallet_address,
    tx.amount.toString(), // Convert bigint to string for storage
    JSON.stringify(tx.tx_data)
  ];

  try {
    await pool.query(query, values);
  } catch (error) {
    console.error('Error storing mint transaction:', error);
    throw error;
  }
}

export async function batchStoreMintTransactions(transactions: Omit<MintTransaction, 'id' | 'created_at'>[]): Promise<void> {
  if (transactions.length === 0) return;

  const pool = getPool();

  // Build batch insert query
  const values: (string | number | bigint | Date)[] = [];
  const valueStrings: string[] = [];

  transactions.forEach((tx, index) => {
    const baseIndex = index * 6;
    valueStrings.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`);
    values.push(
      tx.signature,
      tx.timestamp,
      tx.token_address,
      tx.wallet_address,
      tx.amount.toString(),
      JSON.stringify(tx.tx_data)
    );
  });

  const query = `
    INSERT INTO mint_transactions (signature, timestamp, token_address, wallet_address, amount, tx_data)
    VALUES ${valueStrings.join(', ')}
    ON CONFLICT (signature) DO NOTHING
  `;

  try {
    await pool.query(query, values);
  } catch (error) {
    console.error('Error batch storing mint transactions:', error);
    throw error;
  }
}


export async function getTotalMintedFromCache(
  tokenAddress: string
): Promise<bigint> {
  const pool = getPool();

  const query = `
    SELECT wallet_address, COALESCE(SUM(amount::bigint), 0) as total
    FROM mint_transactions
    WHERE token_address = $1
    GROUP BY wallet_address
  `;

  try {
    const result = await pool.query(query, [tokenAddress]);

    // Special case: Filter out specific wallet for this token AFTER querying
    const SPECIAL_CASE_TOKEN = 'GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC';
    const IGNORED_WALLET = '3UwzWidPv4soJhGKdRXeXV4hwQ4vg6aZHhB6ZyP6x9X3';

    let totalMinted = BigInt(0);
    for (const row of result.rows) {
      // Skip ignored wallet for special case token
      if (tokenAddress === SPECIAL_CASE_TOKEN && row.wallet_address === IGNORED_WALLET) {
        continue;
      }
      totalMinted += BigInt(row.total);
    }

    return totalMinted;
  } catch (error) {
    console.error('Error calculating total minted from cache:', error);
    throw error;
  }
}

export async function getLatestCachedTransaction(): Promise<{ signature: string; timestamp: number } | null> {
  const pool = getPool();

  const query = `
    SELECT signature, timestamp
    FROM mint_transactions
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  try {
    const result = await pool.query(query);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error fetching latest cached transaction:', error);
    throw error;
  }
}


/**
 * Check if ANY user has claimed this token within the specified time window
 * Returns true if a recent claim exists, false otherwise
 */
export async function hasRecentClaim(
  tokenAddress: string,
  minutesAgo: number = 360
): Promise<boolean> {
  const pool = getPool();

  const query = `
    SELECT COUNT(*) as count
    FROM claim_records
    WHERE token_address = $1
      AND confirmed_at > NOW() - INTERVAL '${minutesAgo} minutes'
  `;

  try {
    const result = await pool.query(query, [tokenAddress]);
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error('Error checking recent claims:', error);
    // Fail safe - if we can't check, assume they have claimed
    return true;
  }
}

/**
 * Pre-record a claim attempt in the database with a placeholder signature
 * This prevents double-claiming by creating the DB record BEFORE signing
 * Returns a unique claim ID that can be used to update the record later
 */
export async function preRecordClaim(
  walletAddress: string,
  tokenAddress: string,
  amount: string
): Promise<string> {
  const pool = getPool();

  // Generate a unique placeholder signature
  const claimId = `PENDING_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const query = `
    INSERT INTO claim_records (wallet_address, token_address, amount, transaction_signature)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `;

  try {
    await pool.query(query, [walletAddress, tokenAddress, amount, claimId]);
    return claimId;
  } catch (error) {
    console.error('Error pre-recording claim:', error);
    // MUST throw to block the transaction
    throw new Error('Failed to pre-record claim - blocking transaction for safety');
  }
}

/**
 * Update a pre-recorded claim with the actual transaction signature
 */
export async function updateClaimSignature(
  claimId: string,
  transactionSignature: string
): Promise<void> {
  const pool = getPool();

  const query = `
    UPDATE claim_records
    SET transaction_signature = $1, confirmed_at = NOW()
    WHERE transaction_signature = $2
  `;

  try {
    await pool.query(query, [transactionSignature, claimId]);
  } catch (error) {
    console.error('Error updating claim signature:', error);
    // Log but don't throw - claim was already submitted successfully
  }
}

/**
 * Remove a failed pre-recorded claim
 */
export async function removeFailedClaim(claimId: string): Promise<void> {
  const pool = getPool();

  const query = `
    DELETE FROM claim_records
    WHERE transaction_signature = $1 AND transaction_signature LIKE 'PENDING_%'
  `;

  try {
    await pool.query(query, [claimId]);
  } catch (error) {
    console.error('Error removing failed claim:', error);
    // Log but don't throw
  }
}

// Token Holders Management Functions

export async function getTokenHolders(tokenAddress: string): Promise<TokenHolder[]> {
  const pool = getPool();

  const query = `
    SELECT * FROM token_holders
    WHERE token_address = $1
    ORDER BY token_balance DESC
  `;

  try {
    const result = await pool.query(query, [tokenAddress]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching token holders:', error);
    throw error;
  }
}

export async function upsertTokenHolder(holder: Omit<TokenHolder, 'id' | 'created_at' | 'updated_at'>): Promise<TokenHolder> {
  const pool = getPool();

  const query = `
    INSERT INTO token_holders (
      token_address, wallet_address, token_balance, staked_balance,
      telegram_username, x_username, discord_username, custom_label, last_sync_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (token_address, wallet_address)
    DO UPDATE SET
      token_balance = EXCLUDED.token_balance,
      staked_balance = EXCLUDED.staked_balance,
      last_sync_at = EXCLUDED.last_sync_at,
      telegram_username = COALESCE(token_holders.telegram_username, EXCLUDED.telegram_username),
      x_username = COALESCE(token_holders.x_username, EXCLUDED.x_username),
      discord_username = COALESCE(token_holders.discord_username, EXCLUDED.discord_username),
      custom_label = COALESCE(token_holders.custom_label, EXCLUDED.custom_label)
    RETURNING *
  `;

  const values = [
    holder.token_address,
    holder.wallet_address,
    holder.token_balance,
    holder.staked_balance || '0',
    holder.telegram_username || null,
    holder.x_username || null,
    holder.discord_username || null,
    holder.custom_label || null,
    holder.last_sync_at || new Date()
  ];

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error upserting token holder:', error);
    throw error;
  }
}

export async function batchUpsertTokenHolders(
  tokenAddress: string,
  holders: Array<{
    wallet_address: string;
    token_balance: string;
    staked_balance?: string;
  }>
): Promise<void> {
  if (holders.length === 0) return;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const syncTime = new Date();

    // First, mark all existing holders as potentially stale
    await client.query(
      'UPDATE token_holders SET last_sync_at = $1 WHERE token_address = $2 AND last_sync_at != $1',
      [new Date(0), tokenAddress]
    );

    // Then upsert all current holders
    for (const holder of holders) {
      const query = `
        INSERT INTO token_holders (
          token_address, wallet_address, token_balance, staked_balance, last_sync_at
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (token_address, wallet_address)
        DO UPDATE SET
          token_balance = EXCLUDED.token_balance,
          staked_balance = EXCLUDED.staked_balance,
          last_sync_at = EXCLUDED.last_sync_at
        `;

      await client.query(query, [
        tokenAddress,
        holder.wallet_address,
        holder.token_balance,
        holder.staked_balance || '0',
        syncTime
      ]);
    }

    // Update holders who no longer have tokens to balance 0 (preserving labels)
    await client.query(
      'UPDATE token_holders SET token_balance = $3, staked_balance = $4 WHERE token_address = $1 AND last_sync_at = $2',
      [tokenAddress, new Date(0), '0', '0']
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error batch upserting token holders:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateTokenHolderLabels(
  tokenAddress: string,
  walletAddress: string,
  labels: {
    telegram_username?: string | null;
    x_username?: string | null;
    discord_username?: string | null;
    custom_label?: string | null;
  }
): Promise<TokenHolder | null> {
  const pool = getPool();

  const query = `
    UPDATE token_holders
    SET
      telegram_username = COALESCE($3, telegram_username),
      x_username = COALESCE($4, x_username),
      discord_username = COALESCE($5, discord_username),
      custom_label = COALESCE($6, custom_label)
    WHERE token_address = $1 AND wallet_address = $2
    RETURNING *
  `;

  try {
    const result = await pool.query(query, [
      tokenAddress,
      walletAddress,
      labels.telegram_username,
      labels.x_username,
      labels.discord_username,
      labels.custom_label
    ]);

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error updating token holder labels:', error);
    throw error;
  }
}

export async function getTokenHolderStats(tokenAddress: string): Promise<{
  totalHolders: number;
  totalBalance: string;
  lastSyncTime: Date | null;
}> {
  const pool = getPool();

  const query = `
    SELECT
      COUNT(*) as total_holders,
      COALESCE(SUM(token_balance), 0) as total_balance,
      MAX(last_sync_at) as last_sync_time
    FROM token_holders
    WHERE token_address = $1
  `;

  try {
    const result = await pool.query(query, [tokenAddress]);
    const row = result.rows[0];

    return {
      totalHolders: parseInt(row.total_holders),
      totalBalance: row.total_balance || '0',
      lastSyncTime: row.last_sync_time
    };
  } catch (error) {
    console.error('Error fetching token holder stats:', error);
    throw error;
  }
}

export async function createDesignatedClaim(
  tokenAddress: string,
  originalLauncher: string,
  designatedTwitter?: string,
  designatedGithub?: string
): Promise<DesignatedClaim> {
  const pool = getPool();

  const query = `
    INSERT INTO designated_claims (
      token_address,
      original_launcher,
      designated_twitter,
      designated_github
    ) VALUES ($1, $2, $3, $4)
    ON CONFLICT (token_address) DO UPDATE SET
      designated_twitter = COALESCE(EXCLUDED.designated_twitter, designated_claims.designated_twitter),
      designated_github = COALESCE(EXCLUDED.designated_github, designated_claims.designated_github)
    RETURNING *
  `;

  try {
    const result = await pool.query(query, [
      tokenAddress,
      originalLauncher,
      designatedTwitter || null,
      designatedGithub || null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating designated claim:', error);
    throw error;
  }
}

export async function getDesignatedClaimByToken(tokenAddress: string): Promise<DesignatedClaim | null> {
  const pool = getPool();

  const query = `
    SELECT * FROM designated_claims
    WHERE token_address = $1
    LIMIT 1
  `;

  try {
    const result = await pool.query(query, [tokenAddress]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error fetching designated claim:', error);
    throw error;
  }
}

export async function getDesignatedClaimsBySocials(
  twitterUsername?: string,
  githubUsername?: string
): Promise<DesignatedClaim[]> {
  const pool = getPool();

  if (!twitterUsername && !githubUsername) {
    return [];
  }

  const conditions: string[] = [];
  const values: string[] = [];
  let paramCount = 0;

  if (twitterUsername) {
    // Match multiple URL formats for Twitter
    const urlVariations = [
      `https://twitter.com/${twitterUsername}`,
      `https://x.com/${twitterUsername}`,
      `twitter.com/${twitterUsername}`,
      `x.com/${twitterUsername}`
    ];

    const orConditions = urlVariations.map(() => {
      paramCount++;
      return `designated_twitter = $${paramCount}`;
    }).join(' OR ');

    conditions.push(`(${orConditions})`);
    values.push(...urlVariations);
  }

  if (githubUsername) {
    // Match multiple URL formats for GitHub
    const githubVariations = [
      `https://github.com/${githubUsername}`,
      `github.com/${githubUsername}`
    ];

    const orConditions = githubVariations.map(() => {
      paramCount++;
      return `designated_github = $${paramCount}`;
    }).join(' OR ');

    conditions.push(`(${orConditions})`);
    values.push(...githubVariations);
  }

  const query = `
    SELECT * FROM designated_claims
    WHERE ${conditions.join(' OR ')}
    AND verified_wallet IS NULL
  `;

  try {
    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Error fetching designated claims by socials:', error);
    throw error;
  }
}

export async function verifyDesignatedClaim(
  tokenAddress: string,
  verifiedWallet: string,
  embeddedWallet?: string
): Promise<DesignatedClaim | null> {
  const pool = getPool();

  const query = `
    UPDATE designated_claims
    SET
      verified_wallet = $2,
      verified_embedded_wallet = $3,
      verified_at = NOW()
    WHERE token_address = $1
    RETURNING *
  `;

  try {
    const result = await pool.query(query, [
      tokenAddress,
      verifiedWallet,
      embeddedWallet || null
    ]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error verifying designated claim:', error);
    throw error;
  }
}

export async function getVerifiedClaimWallets(tokenAddress: string): Promise<{
  verifiedWallet: string | null;
  embeddedWallet: string | null;
  originalLauncher: string | null;
}> {
  const pool = getPool();

  const query = `
    SELECT verified_wallet, verified_embedded_wallet, original_launcher
    FROM designated_claims
    WHERE token_address = $1
  `;

  try {
    const result = await pool.query(query, [tokenAddress]);
    if (result.rows.length === 0) {
      return { verifiedWallet: null, embeddedWallet: null, originalLauncher: null };
    }

    return {
      verifiedWallet: result.rows[0].verified_wallet,
      embeddedWallet: result.rows[0].verified_embedded_wallet,
      originalLauncher: result.rows[0].original_launcher
    };
  } catch (error) {
    console.error('Error fetching verified claim wallets:', error);
    throw error;
  }
}

// Security-enhanced verification functions

export async function createVerificationChallenge(
  walletAddress: string,
  challengeNonce: string,
  challengeMessage: string,
  expiresAt: Date
): Promise<{ id: number }> {
  const pool = getPool();

  const query = `
    INSERT INTO verification_challenges (
      wallet_address,
      challenge_nonce,
      challenge_message,
      expires_at
    ) VALUES ($1, $2, $3, $4)
    RETURNING id
  `;

  try {
    const result = await pool.query(query, [
      walletAddress,
      challengeNonce,
      challengeMessage,
      expiresAt
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating verification challenge:', error);
    throw error;
  }
}

export async function getVerificationChallenge(
  challengeNonce: string
): Promise<VerificationChallenge | null> {
  const pool = getPool();

  const query = `
    SELECT * FROM verification_challenges
    WHERE challenge_nonce = $1
      AND expires_at > NOW()
      AND used = FALSE
  `;

  try {
    const result = await pool.query(query, [challengeNonce]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error fetching verification challenge:', error);
    throw error;
  }
}

export async function markChallengeUsed(challengeNonce: string): Promise<void> {
  const pool = getPool();

  const query = `
    UPDATE verification_challenges
    SET used = TRUE
    WHERE challenge_nonce = $1
  `;

  try {
    await pool.query(query, [challengeNonce]);
  } catch (error) {
    console.error('Error marking challenge as used:', error);
    throw error;
  }
}

export async function acquireVerificationLockDB(
  tokenAddress: string,
  lockDurationMs = 30000
): Promise<boolean> {
  const pool = getPool();

  const query = `
    UPDATE designated_claims
    SET verification_lock_until = NOW() + ($2::INTEGER * INTERVAL '1 millisecond')
    WHERE token_address = $1
      AND (verification_lock_until IS NULL OR verification_lock_until < NOW())
    RETURNING token_address
  `;

  try {
    const result = await pool.query(query, [tokenAddress, lockDurationMs]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error acquiring verification lock:', error);
    throw error;
  }
}

export async function releaseVerificationLockDB(tokenAddress: string): Promise<void> {
  const pool = getPool();

  const query = `
    UPDATE designated_claims
    SET verification_lock_until = NULL
    WHERE token_address = $1
  `;

  try {
    await pool.query(query, [tokenAddress]);
  } catch (error) {
    console.error('Error releasing verification lock:', error);
    throw error;
  }
}

export async function incrementVerificationAttempts(tokenAddress: string): Promise<void> {
  const pool = getPool();

  const query = `
    UPDATE designated_claims
    SET
      verification_attempts = COALESCE(verification_attempts, 0) + 1,
      last_verification_attempt = NOW()
    WHERE token_address = $1
  `;

  try {
    await pool.query(query, [tokenAddress]);
  } catch (error) {
    console.error('Error incrementing verification attempts:', error);
    throw error;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Presale Management Functions

export async function createPresale(presale: Omit<Presale, 'id' | 'created_at' | 'status'>): Promise<Presale> {
  const pool = getPool();

  const query = `
    INSERT INTO presales (
      token_address,
      base_mint_priv_key,
      creator_wallet,
      token_name,
      token_symbol,
      token_metadata_url,
      presale_tokens,
      creator_twitter,
      creator_github,
      escrow_pub_key,
      escrow_priv_key,
      ca_ending
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `;

  const values = [
    presale.token_address,
    presale.base_mint_priv_key,
    presale.creator_wallet,
    presale.token_name || null,
    presale.token_symbol || null,
    presale.token_metadata_url,
    presale.presale_tokens ? JSON.stringify(presale.presale_tokens) : null,
    presale.creator_twitter || null,
    presale.creator_github || null,
    presale.escrow_pub_key || null,
    presale.escrow_priv_key || null,
    presale.ca_ending || null
  ];

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating presale:', error);
    throw error;
  }
}

export async function getPresaleByTokenAddress(tokenAddress: string): Promise<Presale | null> {
  const pool = getPool();

  const query = `
    SELECT * FROM presales
    WHERE token_address = $1
  `;

  try {
    const result = await pool.query(query, [tokenAddress]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error fetching presale by token address:', error);
    throw error;
  }
}

export async function updatePresaleStatus(
  tokenAddress: string,
  status: string,
  baseMintAddress?: string,
  tokensBought?: string
): Promise<Presale | null> {
  const pool = getPool();

  let query: string;
  let values: any[];

  if (baseMintAddress && tokensBought) {
    // Update status, base_mint_address, and tokens_bought
    query = `
      UPDATE presales
      SET status = $2,
          base_mint_address = $3,
          tokens_bought = $4,
          launched_at = NOW()
      WHERE token_address = $1
      RETURNING *
    `;
    values = [tokenAddress, status, baseMintAddress, tokensBought];
  } else {
    // Just update status
    query = `
      UPDATE presales
      SET status = $2
      WHERE token_address = $1
      RETURNING *
    `;
    values = [tokenAddress, status];
  }

  try {
    const result = await pool.query(query, values);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error updating presale status:', error);
    throw error;
  }
}

export async function getPresalesByCreatorWallet(creatorWallet: string, limit = 100): Promise<Presale[]> {
  const pool = getPool();

  const query = `
    SELECT * FROM presales
    WHERE creator_wallet = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;

  try {
    const result = await pool.query(query, [creatorWallet, limit]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching presales by creator wallet:', error);
    throw error;
  }
}

// Presale Bid Management Functions

export async function recordPresaleBid(bid: Omit<PresaleBid, 'id' | 'created_at'>): Promise<PresaleBid> {
  const pool = getPool();

  const query = `
    INSERT INTO presale_bids (
      presale_id,
      token_address,
      wallet_address,
      amount_lamports,
      transaction_signature,
      block_time,
      slot,
      verified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (transaction_signature) DO NOTHING
    RETURNING *
  `;

  const values = [
    bid.presale_id,
    bid.token_address,
    bid.wallet_address,
    bid.amount_lamports.toString(),
    bid.transaction_signature,
    bid.block_time || null,
    bid.slot ? bid.slot.toString() : null,
    bid.verified_at || new Date()
  ];

  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('Bid already recorded or conflict occurred');
    }
    return {
      ...result.rows[0],
      amount_lamports: BigInt(result.rows[0].amount_lamports),
      slot: result.rows[0].slot ? BigInt(result.rows[0].slot) : undefined
    };
  } catch (error) {
    console.error('Error recording presale bid:', error);
    throw error;
  }
}

export async function getPresaleBidBySignature(transactionSignature: string): Promise<PresaleBid | null> {
  const pool = getPool();

  const query = `
    SELECT * FROM presale_bids
    WHERE transaction_signature = $1
    LIMIT 1
  `;

  try {
    const result = await pool.query(query, [transactionSignature]);
    if (result.rows.length === 0) {
      return null;
    }
    return {
      ...result.rows[0],
      amount_lamports: BigInt(result.rows[0].amount_lamports),
      slot: result.rows[0].slot ? BigInt(result.rows[0].slot) : undefined
    };
  } catch (error) {
    console.error('Error checking for existing bid:', error);
    throw error;
  }
}

export async function getPresaleBids(tokenAddress: string): Promise<PresaleBid[]> {
  const pool = getPool();

  const query = `
    SELECT * FROM presale_bids
    WHERE token_address = $1
    ORDER BY created_at ASC
  `;

  try {
    const result = await pool.query(query, [tokenAddress]);
    return result.rows.map(row => ({
      ...row,
      amount_lamports: BigInt(row.amount_lamports)
    }));
  } catch (error) {
    console.error('Error fetching presale bids:', error);
    throw error;
  }
}

export async function getTotalPresaleBids(tokenAddress: string): Promise<{
  totalBids: number;
  totalAmount: bigint;
}> {
  const pool = getPool();

  const query = `
    SELECT
      COUNT(*) as total_bids,
      COALESCE(SUM(amount_lamports), 0) as total_amount
    FROM presale_bids
    WHERE token_address = $1
  `;

  try {
    const result = await pool.query(query, [tokenAddress]);
    const row = result.rows[0];

    return {
      totalBids: parseInt(row.total_bids),
      totalAmount: BigInt(row.total_amount)
    };
  } catch (error) {
    console.error('Error fetching total presale bids:', error);
    throw error;
  }
}

export async function getUserPresaleContribution(
  tokenAddress: string,
  walletAddress: string
): Promise<bigint> {
  const pool = getPool();

  const query = `
    SELECT COALESCE(SUM(amount_lamports), 0) as total_contribution
    FROM presale_bids
    WHERE token_address = $1 AND wallet_address = $2
  `;

  try {
    const result = await pool.query(query, [tokenAddress, walletAddress]);
    return BigInt(result.rows[0].total_contribution);
  } catch (error) {
    console.error('Error fetching user presale contribution:', error);
    throw error;
  }
}

/**
 * @deprecated Use initializePresaleClaims from presaleVestingService.ts instead
 * This function is kept for backwards compatibility but should not be used in new code
 */
export async function updatePresaleTokensBought(
  tokenAddress: string,
  tokensBought: string
): Promise<void> {
  const pool = getPool();

  const query = `
    UPDATE presales
    SET tokens_bought = $2
    WHERE token_address = $1
  `;

  try {
    await pool.query(query, [tokenAddress, tokensBought]);
  } catch (error) {
    console.error('Error updating presale tokens bought:', error);
    throw error;
  }
}

// ===== PRESALE CLAIM AND VESTING FUNCTIONS =====

/**
 * Get presale claim record for a specific wallet
 * @param presaleId - The presale ID
 * @param walletAddress - The wallet address to look up
 * @returns The presale claim record or null if not found
 */
export async function getPresaleClaimByWallet(
  presaleId: number,
  walletAddress: string
): Promise<PresaleClaim | null> {
  const pool = getPool();
  const query = `
    SELECT * FROM presale_claims
    WHERE presale_id = $1 AND wallet_address = $2
  `;

  try {
    const result = await pool.query(query, [presaleId, walletAddress]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching presale claim:', error);
    throw error;
  }
}

/**
 * Create or update a presale claim record
 * Initializes a user's vesting schedule after presale launch
 * @param claim - The claim data (excludes auto-generated fields)
 * @returns The created or updated presale claim record
 */
export async function createOrUpdatePresaleClaim(
  claim: Omit<PresaleClaim, 'id' | 'created_at' | 'updated_at' | 'tokens_claimed' | 'last_claim_at'>
): Promise<PresaleClaim> {
  const pool = getPool();
  const query = `
    INSERT INTO presale_claims (
      presale_id, wallet_address, tokens_allocated, tokens_claimed, vesting_start_at
    ) VALUES ($1, $2, $3, '0', $4)
    ON CONFLICT (presale_id, wallet_address) DO UPDATE SET
      tokens_allocated = EXCLUDED.tokens_allocated,
      vesting_start_at = EXCLUDED.vesting_start_at,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  const values = [
    claim.presale_id,
    claim.wallet_address,
    claim.tokens_allocated,
    claim.vesting_start_at
  ];

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating/updating presale claim:', error);
    throw error;
  }
}

/**
 * Record a successful presale claim transaction
 * Creates an immutable audit trail of all claims
 * @param transaction - The claim transaction data
 * @returns The recorded transaction
 * @throws Error if transaction signature already exists (prevents double claims)
 */
export async function recordPresaleClaimTransaction(
  transaction: Omit<PresaleClaimTransaction, 'id' | 'created_at'>
): Promise<PresaleClaimTransaction> {
  const pool = getPool();
  const query = `
    INSERT INTO presale_claim_transactions (
      presale_id, wallet_address, amount_claimed, transaction_signature,
      block_time, slot, verified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const values = [
    transaction.presale_id,
    transaction.wallet_address,
    transaction.amount_claimed,
    transaction.transaction_signature,
    transaction.block_time || null,
    transaction.slot || null,
    transaction.verified_at
  ];

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate key')) {
      throw new Error('Transaction already recorded');
    }
    console.error('Error recording presale claim transaction:', error);
    throw error;
  }
}

/**
 * Update the claimed amount for a presale claim
 * Increments tokens_claimed and updates last_claim_at timestamp
 * @param presaleId - The presale ID
 * @param walletAddress - The wallet address
 * @param amountClaimed - The amount of tokens being claimed (will be added to existing claimed amount)
 */
export async function updatePresaleClaimAmount(
  presaleId: number,
  walletAddress: string,
  amountClaimed: string
): Promise<void> {
  const pool = getPool();
  const query = `
    UPDATE presale_claims
    SET
      tokens_claimed = (CAST(tokens_claimed AS DECIMAL) + CAST($3 AS DECIMAL))::TEXT,
      last_claim_at = NOW(),
      updated_at = NOW()
    WHERE presale_id = $1 AND wallet_address = $2
  `;

  try {
    await pool.query(query, [presaleId, walletAddress, amountClaimed]);
  } catch (error) {
    console.error('Error updating presale claim amount:', error);
    throw error;
  }
}

/**
 * Get all presale claim records for a specific presale
 * Useful for generating statistics and reports
 * @param presaleId - The presale ID
 * @returns Array of all claim records for this presale
 */
export async function getPresaleClaimsByPresale(presaleId: number): Promise<PresaleClaim[]> {
  const pool = getPool();
  const query = `
    SELECT * FROM presale_claims
    WHERE presale_id = $1
    ORDER BY created_at DESC
  `;

  try {
    const result = await pool.query(query, [presaleId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching presale claims:', error);
    throw error;
  }
}