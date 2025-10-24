'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import { PublicKey, Connection, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { useWallet } from '@/components/WalletProvider';
import { Navigation } from '@/components/Navigation';
import { showToast } from '@/components/Toast';
import VaultIDL from '@/lib/vault-idl.json';
import { usePrivy } from '@privy-io/react-auth';

// ZC Token address - using the one from your codebase
const ZC_TOKEN_MINT = new PublicKey("GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC");
const PROGRAM_ID = new PublicKey("6CETAFdgoMZgNHCcjnnQLN2pu5pJgUz8QQd7JzcynHmD");

interface SolanaWalletProvider {
  signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
}

interface WindowWithWallets extends Window {
  solana?: SolanaWalletProvider;
  solflare?: SolanaWalletProvider;
}


export default function StakePage() {
  const { wallet, isPrivyAuthenticated } = useWallet();
  const { login, authenticated, linkWallet } = usePrivy();

  const [loading, setLoading] = useState(false);
  const [modalMode, setModalMode] = useState<"deposit" | "redeem">("deposit"); // Keep internal state as deposit for consistency with function names
  const [amount, setAmount] = useState<string>("");
  const [redeemPercent, setRedeemPercent] = useState<string>("");

  // ZC token balance
  const [zcBalance, setZcBalance] = useState<number>(0);

  // Vault state
  const [vaultBalance, setVaultBalance] = useState<number>(0);
  const [userShareBalance, setUserShareBalance] = useState<number>(0);
  const [userShareValue, setUserShareValue] = useState<number>(0);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [zcTotalSupply, setZcTotalSupply] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [postTransactionRefreshing, setPostTransactionRefreshing] = useState(false);
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState<boolean>(true);
  const [copiedWallet, setCopiedWallet] = useState(false);


  const connection = useMemo(() => new Connection(process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com"), []);

  const getProvider = useCallback(() => {
    if (typeof window === 'undefined') return null;

    const walletProvider = (window as WindowWithWallets).solana || (window as WindowWithWallets).solflare;
    if (!wallet || !walletProvider) return null;

    try {
      const provider = new AnchorProvider(
        connection,
        walletProvider as unknown as AnchorProvider['wallet'],
        { commitment: "confirmed" }
      );
      return provider;
    } catch (error) {
      console.error("Failed to create provider:", error);
      return null;
    }
  }, [wallet, connection]);

  const getProgram = useCallback((): Program | null => {
    const provider = getProvider();
    if (!provider) return null;
    return new Program(VaultIDL as unknown as Program['idl'], provider);
  }, [getProvider]);

  const program = useMemo(() => getProgram(), [getProgram]);

  // Calculate APY based on vault metrics
  const calculateAPY = useCallback((): number => {
    if (vaultBalance === 0) return 0;
    // Simple APY calculation - you can adjust this based on your reward mechanism
    const REWARD_TOKENS = 15000000; // 15M tokens
    const rewardPerToken = REWARD_TOKENS / vaultBalance;
    const compoundingPeriodsPerYear = 52;
    return 100 * (Math.pow(1 + rewardPerToken, compoundingPeriodsPerYear) - 1);
  }, [vaultBalance]);

  // Fetch ZC token balance and total supply
  const fetchZcBalance = useCallback(async () => {
    if (!wallet) {
      setZcBalance(0);
      return;
    }

    try {
      // Get user balance
      const userTokenAccount = await getAssociatedTokenAddress(ZC_TOKEN_MINT, wallet);
      const userTokenAccountInfo = await getAccount(connection, userTokenAccount);
      const balance = Number(userTokenAccountInfo.amount) / 1_000_000;
      setZcBalance(balance);

      // Get total ZC supply
      const mintInfo = await connection.getParsedAccountInfo(ZC_TOKEN_MINT);
      if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
        const supply = Number(mintInfo.value.data.parsed.info.supply) / 1_000_000;
        setZcTotalSupply(supply);
      }
    } catch {
      console.log("User ZC token account not found");
      setZcBalance(0);
    }
  }, [wallet, connection]);

  const fetchVaultData = useCallback(async (retryCount = 0, maxRetries = 3) => {
    try {
      setRefreshing(true);
      if (!program || !wallet) {
        console.log("No program or wallet available");
        return;
      }

      // Derive PDAs
      const [vaultState] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_state")],
        PROGRAM_ID
      );
      const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_vault"), ZC_TOKEN_MINT.toBuffer()],
        PROGRAM_ID
      );
      const [shareMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("share_mint")],
        PROGRAM_ID
      );

      // Fetch vault state using program account deserializer
      try {
        const vaultStateAccountInfo = await connection.getAccountInfo(vaultState);
        if (vaultStateAccountInfo && vaultStateAccountInfo.data) {
          const vaultStateAccount = program.coder.accounts.decode("vaultState", vaultStateAccountInfo.data);
          setWithdrawalsEnabled(vaultStateAccount.operationsEnabled);
          console.log("Vault operations enabled:", vaultStateAccount.operationsEnabled);
        } else {
          console.log("VaultState account not found");
          setWithdrawalsEnabled(false);
        }
      } catch (error) {
        console.error("Failed to fetch vault state:", error);
        setWithdrawalsEnabled(false);
      }

      // Use program methods for data fetching
      try {
        // Get total assets using program method
        const totalAssets = await program.methods
          .totalAssets()
          .accounts({
            vaultTokenAccount,
            mintOfTokenBeingSent: ZC_TOKEN_MINT,
          })
          .view();
        setVaultBalance(Number(totalAssets) / 1_000_000);

      } catch (error) {
        console.error("Failed to fetch vault metrics:", error);
        setVaultBalance(0);
      }

      // Calculate exchange rate (1 sZC = ? ZC)
      try {
        const oneShare = new BN(1_000_000); // 1 sZC with 6 decimals
        const assetsForOneShare = await program.methods
          .previewRedeem(oneShare)
          .accounts({
            shareMint,
            vaultTokenAccount,
            mintOfTokenBeingSent: ZC_TOKEN_MINT,
          })
          .view();
        setExchangeRate(Number(assetsForOneShare) / 1_000_000);
      } catch (error) {
        console.error("Failed to fetch exchange rate:", error);
        setExchangeRate(1); // Default to 1:1 if calculation fails
      }

      // Fetch user share balance
      try {
        const userShareAccount = await getAssociatedTokenAddress(shareMint, wallet);
        const userShareAccountInfo = await getAccount(connection, userShareAccount);
        const shareBalance = Number(userShareAccountInfo.amount) / 1_000_000;
        setUserShareBalance(shareBalance);

        // Use preview redeem to get exact value
        if (shareBalance > 0) {
          const assets = await program.methods
            .previewRedeem(new BN(userShareAccountInfo.amount.toString()))
            .accounts({
              shareMint,
              vaultTokenAccount,
              mintOfTokenBeingSent: ZC_TOKEN_MINT,
            })
            .view();
          setUserShareValue(Number(assets) / 1_000_000);
        } else {
          setUserShareValue(0);
        }
      } catch {
        console.log("User share account not found");
        if (retryCount < maxRetries) {
          console.log(`Retrying fetchVaultData (${retryCount + 1}/${maxRetries})`);
          const delay = Math.pow(2, retryCount) * 1000;
          setTimeout(() => {
            fetchVaultData(retryCount + 1, maxRetries);
          }, delay);
          return;
        }
        setUserShareBalance(0);
        setUserShareValue(0);
      }
    } catch (error) {
      console.error("Failed to fetch vault data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [wallet, connection, program]);


  useEffect(() => {
    if (wallet) {
      fetchZcBalance();
      fetchVaultData();
    }
  }, [wallet, fetchZcBalance, fetchVaultData]);

  const handleDeposit = async () => {
    const depositAmount = parseFloat(amount);
    if (!depositAmount || depositAmount <= 0) {
      showToast('error', 'Please enter a valid deposit amount');
      return;
    }

    const walletProvider = (window as WindowWithWallets).solana || (window as WindowWithWallets).solflare;
    if (!wallet || !walletProvider) {
      showToast('error', 'Please connect your wallet first');
      return;
    }

    try {
      setLoading(true);
      if (!program) throw new Error("Program not available");

      const depositAmountBN = new BN(depositAmount * 1_000_000);

      // Derive PDAs
      const [vaultState] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_state")],
        PROGRAM_ID
      );
      const [tokenAccountOwnerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_account_owner_pda")],
        PROGRAM_ID
      );
      const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_vault"), ZC_TOKEN_MINT.toBuffer()],
        PROGRAM_ID
      );
      const [shareMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("share_mint")],
        PROGRAM_ID
      );

      // Get user token accounts
      const senderTokenAccount = await getAssociatedTokenAddress(ZC_TOKEN_MINT, wallet);
      const senderShareAccount = await getAssociatedTokenAddress(shareMint, wallet);

      // Check if share account exists, create if not
      const transaction = new Transaction();
      try {
        await getAccount(connection, senderShareAccount);
      } catch {
        console.log("Creating share token account");
        const createATAIx = createAssociatedTokenAccountInstruction(
          wallet,
          senderShareAccount,
          wallet,
          shareMint,
          TOKEN_PROGRAM_ID
        );
        transaction.add(createATAIx);
      }

      // Add deposit instruction
      const depositIx = await program.methods
        .deposit(depositAmountBN)
        .accounts({
          vaultState,
          tokenAccountOwnerPda,
          vaultTokenAccount,
          senderTokenAccount,
          senderShareAccount,
          shareMint,
          mintOfTokenBeingSent: ZC_TOKEN_MINT,
          signer: wallet,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      transaction.add(depositIx);

      // Send transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet;

      const { signature } = await walletProvider.signAndSendTransaction(transaction);
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      showToast('success', `Staked ${depositAmount} ZC to the vault`);
      setAmount("");

      // Wait for blockchain state to propagate, then refresh
      setPostTransactionRefreshing(true);
      setTimeout(async () => {
        await Promise.all([fetchVaultData(), fetchZcBalance()]);
        setPostTransactionRefreshing(false);
      }, 8000);
    } catch (error) {
      console.error("Deposit failed:", error);
      showToast('error', error instanceof Error ? error.message : "Failed to deposit tokens");
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    const redeemPercentNum = parseFloat(redeemPercent);
    if (!redeemPercentNum || redeemPercentNum <= 0 || redeemPercentNum > 100) {
      showToast('error', 'Please enter a valid percentage between 0 and 100');
      return;
    }

    const walletProvider = (window as WindowWithWallets).solana || (window as WindowWithWallets).solflare;
    if (!wallet || !walletProvider) {
      showToast('error', 'Please connect your wallet first');
      return;
    }

    try {
      setLoading(true);
      if (!program) throw new Error("Program not available");

      // Calculate shares to redeem
      const [shareMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("share_mint")],
        PROGRAM_ID
      );
      const userShareAccount = await getAssociatedTokenAddress(shareMint, wallet);
      const userShareAccountInfo = await getAccount(connection, userShareAccount);
      const totalShares = userShareAccountInfo.amount;
      const sharesToRedeem = (totalShares * BigInt(Math.floor(redeemPercentNum * 100))) / BigInt(10000);

      // Derive PDAs
      const [vaultState] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_state")],
        PROGRAM_ID
      );
      const [tokenAccountOwnerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_account_owner_pda")],
        PROGRAM_ID
      );
      const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_vault"), ZC_TOKEN_MINT.toBuffer()],
        PROGRAM_ID
      );

      const senderTokenAccount = await getAssociatedTokenAddress(ZC_TOKEN_MINT, wallet);
      const senderShareAccount = userShareAccount;

      // Build redeem transaction
      const transaction = new Transaction();

      // Check if the user's token account exists, create if not
      try {
        await getAccount(connection, senderTokenAccount);
      } catch {
        console.log("Creating user token account for redemption");
        const createATAIx = createAssociatedTokenAccountInstruction(
          wallet,
          senderTokenAccount,
          wallet,
          ZC_TOKEN_MINT,
          TOKEN_PROGRAM_ID
        );
        transaction.add(createATAIx);
      }

      // Add redeem instruction
      const redeemIx = await program.methods
        .redeem(new BN(sharesToRedeem.toString()))
        .accounts({
          vaultState,
          tokenAccountOwnerPda,
          vaultTokenAccount,
          senderTokenAccount,
          senderShareAccount,
          shareMint,
          mintOfTokenBeingSent: ZC_TOKEN_MINT,
          signer: wallet,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      transaction.add(redeemIx);

      // Send transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet;

      const { signature } = await walletProvider.signAndSendTransaction(transaction);
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      showToast('success', `Redeemed ${redeemPercentNum}% of your vault shares for ZC`);
      setRedeemPercent("");

      // Wait for blockchain state to propagate, then refresh
      setPostTransactionRefreshing(true);
      setTimeout(async () => {
        await Promise.all([fetchVaultData(), fetchZcBalance()]);
        setPostTransactionRefreshing(false);
      }, 8000);
    } catch (error) {
      console.error("Redemption failed:", error);
      showToast('error', error instanceof Error ? error.message : "Failed to redeem shares");
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatCompactNumber = (num: number): string => {
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(1)}B`;
    } else if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    showToast('success', 'Address copied to clipboard');
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const handleConnectWallet = () => {
    try {
      if (!authenticated) {
        login();
      } else {
        linkWallet();
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      showToast('error', 'Failed to connect wallet. Please try again.');
    }
  };


  return (
    <div className="min-h-screen bg-[#000000]">
      <main className="px-0 sm:px-4 relative">
        <div className="bg-[#141414] min-h-screen text-[#F7FCFE] rounded-none sm:rounded-4xl relative">
          <div className="max-w-7xl mx-auto px-8 py-12 sm:px-12 sm:py-16">
        <h1 className="text-5xl font-bold mb-12">𝓩 Stake</h1>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Left Panel - Wallet */}
          <div className="w-full lg:flex-1 space-y-8">
            {/* Vault Description */}
            <div className="border-b border-gray-800 pb-6">
              <div className="text-lg text-gray-300">
                Stake to earn yield and be rewarded more for your contributions. Staking for other platform launches will be live soon. Once you stake, funds are <span className="font-bold text-white">locked</span>. The next unlock will be November 7th. Staking earlier in each period leads to higher rewards.
              </div>
            </div>

            {/* Wallet Section */}
            <div className="border-b border-gray-800 pb-6">
              <h2 className="text-2xl font-bold mb-6">Wallet</h2>

              {!isPrivyAuthenticated ? (
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleConnectWallet}
                    className="text-xl font-bold text-gray-300 hover:text-white transition-colors cursor-pointer"
                  >
                    CONNECT WALLET
                  </button>
                </div>
              ) : !wallet ? (
                <button
                  onClick={handleConnectWallet}
                  className="text-xl font-bold text-gray-300 hover:text-white transition-colors cursor-pointer"
                >
                  CONNECT WALLET
                </button>
              ) : (
                <div className="space-y-4">
                  {/* Wallet Address Section */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="font-mono text-lg mr-3">{formatAddress(wallet.toString())}</p>
                    <div className="flex gap-2 self-start sm:self-auto">
                      <button
                        onClick={() => copyAddress(wallet.toString())}
                        className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
                        title="Copy wallet address"
                      >
                        {copiedWallet ? (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                      <a
                        href={`https://solscan.io/account/${wallet.toString()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white hover:opacity-80 transition-opacity cursor-pointer"
                        title="View on Solscan"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>

                  {/* Balance Section */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <h3 className="text-xl font-bold">Your Position</h3>
                      {postTransactionRefreshing && (
                        <div className="flex items-center gap-1 text-sm text-gray-300">
                          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Updating...
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-lg text-gray-300">Held:</span>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {zcBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {zcTotalSupply > 0 && (
                            <span className="text-sm text-gray-300 ml-2">
                              ({((zcBalance / zcTotalSupply) * 100).toFixed(3)}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-lg text-gray-300">Staked:</span>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {userShareValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {zcTotalSupply > 0 && (
                            <span className="text-sm text-gray-300 ml-2">
                              ({((userShareValue / zcTotalSupply) * 100).toFixed(3)}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-lg text-gray-300">Exchange Rate:</span>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          1 sZC : {exchangeRate.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} ZC
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Refresh Button */}
                  <button
                    onClick={() => Promise.all([fetchVaultData(), fetchZcBalance()])}
                    disabled={refreshing || postTransactionRefreshing}
                    className="w-full py-2 text-lg text-gray-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center justify-center gap-2">
                      {refreshing || postTransactionRefreshing ? (
                        postTransactionRefreshing ? "Updating balances..." : "Refreshing..."
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Refresh
                        </>
                      )}
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Vault Operations */}
          {wallet && (
            <div className="w-full lg:flex-1 space-y-8">
              <div className="border-b border-gray-800 pb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <h2 className="text-2xl font-bold">Vault</h2>
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">{calculateAPY().toFixed(0)}% APY</div>
                      <div className="text-sm text-gray-300">Yield</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {formatCompactNumber(vaultBalance)}
                        {zcTotalSupply > 0 && (
                          <span className="text-sm text-gray-300 ml-2">
                            ({((vaultBalance / zcTotalSupply) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-300">TVL</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="space-y-6">
                <div className="flex gap-4 border-b border-gray-800 overflow-x-auto">
                  <button
                    onClick={() => setModalMode("deposit")}
                    className={`pb-2 text-xl transition-colors cursor-pointer ${
                      modalMode === "deposit" ? "text-white border-b-2 border-white" : "text-gray-300 hover:text-white"
                    }`}
                  >
                    Stake
                  </button>
                  <button
                    onClick={() => setModalMode("redeem")}
                    className={`pb-2 text-xl transition-colors cursor-pointer ${
                      modalMode === "redeem" ? "text-white border-b-2 border-white" : "text-gray-300 hover:text-white"
                    }`}
                  >
                    Redeem
                  </button>
                </div>

                {modalMode === "deposit" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-lg text-gray-300">Amount</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "" || /^\d*\.?\d*$/.test(value)) {
                              setAmount(value);
                            }
                          }}
                          className="w-full py-3 bg-transparent border-0 border-b border-gray-800 focus:outline-none focus:border-white transition-colors text-xl placeholder:text-gray-300"
                          disabled={false}
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (zcBalance) {
                              setAmount(zcBalance.toString());
                            }
                          }}
                          className="absolute right-2 top-2 text-lg text-gray-300 hover:text-white transition-colors cursor-pointer"
                          tabIndex={-1}
                        >
                          MAX
                        </button>
                      </div>
                      <p className="text-sm text-gray-300">
                        Available to stake: {zcBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ZC
                      </p>
                    </div>

                    <button
                      onClick={handleDeposit}
                      className="w-full py-3 text-xl font-bold bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading || !amount || parseFloat(amount) <= 0}
                    >
                      {loading ? "Processing..." : "Stake"}
                    </button>
                  </div>
                )}

                {modalMode === "redeem" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-lg text-gray-300">Percentage of Shares to Redeem</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="0"
                          value={redeemPercent}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "" || (/^\d*\.?\d*$/.test(value) && parseFloat(value) <= 100)) {
                              setRedeemPercent(value);
                            }
                          }}
                          className="w-full py-3 bg-transparent border-0 border-b border-gray-800 focus:outline-none focus:border-white transition-colors text-xl placeholder:text-gray-300"
                          disabled={!withdrawalsEnabled}
                          autoComplete="off"
                        />
                        <span className="absolute right-3 top-3 text-lg text-gray-300">%</span>
                      </div>
                      <p className="text-sm text-gray-300">
                        Available: {userShareBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} shares ({userShareValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ZC)
                      </p>
                    </div>

                    {parseFloat(redeemPercent) > 0 && (
                      <div className="border-b border-gray-800 pb-3">
                        <div className="flex justify-between items-center">
                          <span className="text-lg text-gray-300">You will receive:</span>
                          <div className="text-right">
                            <div className="text-lg font-bold">
                              {((userShareValue * parseFloat(redeemPercent)) / 100).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ZC
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleRedeem}
                      className="w-full py-3 text-xl font-bold bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading || !redeemPercent || parseFloat(redeemPercent) <= 0 || !withdrawalsEnabled || userShareBalance === 0}
                    >
                      {loading ? "Processing..." : !withdrawalsEnabled ? "Redemptions Disabled" : userShareBalance === 0 ? "No Shares to Redeem" : "Redeem"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <Navigation />
          </div>
        </div>
      </main>
    </div>
  );
}