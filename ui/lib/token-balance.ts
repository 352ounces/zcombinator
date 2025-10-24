import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getMint, AccountLayout } from '@solana/spl-token';

const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
  'confirmed'
);

export async function getWalletTokenBalance(
  walletAddress: string,
  tokenAddress: string
): Promise<string> {
  try {
    const walletPubkey = new PublicKey(walletAddress);
    const mintPubkey = new PublicKey(tokenAddress);

    // Get the associated token account address
    const tokenAccount = await getAssociatedTokenAddress(mintPubkey, walletPubkey);

    // Get account info with confirmed commitment
    const accountInfo = await connection.getAccountInfo(tokenAccount, 'confirmed');

    if (!accountInfo) {
      // Account doesn't exist, balance is 0
      return '0';
    }

    // Get token decimals
    const mintInfo = await getMint(connection, mintPubkey);
    const decimals = mintInfo.decimals;

    // Parse token account data to get balance
    const accountData = AccountLayout.decode(accountInfo.data);
    const balance = Number(accountData.amount) / Math.pow(10, decimals);

    return balance.toString();
  } catch (error) {
    console.error('Error fetching wallet token balance:', error);
    // Return '--' to indicate error instead of '0'
    throw error;
  }
}