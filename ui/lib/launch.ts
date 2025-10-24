'use client';

import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import bs58 from "bs58";

export interface LaunchTokenParams {
  baseMint: Keypair;
  name: string;
  symbol: string;
  uri: string;
  payerPublicKey: PublicKey;
  connection: Connection;
  configAddress: string;
}

export async function createLaunchTransaction({
  baseMint,
  name,
  symbol,
  uri,
  payerPublicKey,
  connection,
  configAddress
}: LaunchTokenParams): Promise<Transaction> {
  const client = new DynamicBondingCurveClient(connection, "confirmed");

  // Create the pool transaction
  const transaction = await client.pool.createPool({
    baseMint: baseMint.publicKey,
    config: new PublicKey(configAddress),
    name,
    symbol,
    uri,
    payer: payerPublicKey,
    poolCreator: payerPublicKey,
  });

  // Get latest blockhash
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payerPublicKey;

  // Sign with baseMint keypair
  transaction.partialSign(baseMint);

  return transaction;
}

export function regenerateKeypairFromPrivateKey(privateKeyBase58: string): Keypair {
  const secretKey = bs58.decode(privateKeyBase58);
  return Keypair.fromSecretKey(secretKey);
}