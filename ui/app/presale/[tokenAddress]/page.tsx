'use client';

import { Navigation } from '@/components/Navigation';
import { TokenCard } from '@/components/TokenCard';
import { PresaleBuyModal } from '@/components/PresaleBuyModal';
import { VestingModal } from '@/components/VestingModal';
import { InfoTooltip } from '@/components/InfoTooltip';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useWallet } from '@/components/WalletProvider';
import { usePrivy } from '@privy-io/react-auth';
import { Transaction, Connection } from '@solana/web3.js';
import { useSignTransaction } from '@privy-io/react-auth/solana';
import bs58 from 'bs58';

interface Presale {
  id: number;
  token_address: string;
  creator_wallet: string;
  token_name: string;
  token_symbol: string;
  token_metadata_url: string;
  presale_tokens: string[];
  creator_twitter?: string;
  creator_github?: string;
  status: string;
  escrow_pub_key?: string;
  tokens_bought?: string;
  base_mint_address?: string;
  launched_at?: string;
  created_at: string;
}

interface VestingInfo {
  totalAllocated: string;
  totalClaimed: string;
  claimableAmount: string;
  vestingProgress: number;
  isFullyVested: boolean;
  nextUnlockTime?: string;
  vestingEndTime: string;
}

interface TokenMetadata {
  name: string;
  symbol: string;
  image: string;
  website?: string;
  twitter?: string;
  description?: string;
}

interface Contribution {
  wallet: string;
  amount: number;
  transactionSignature: string;
  createdAt: string;
}

interface BidsData {
  totalRaised: number;
  totalBids: number;
  contributions: Contribution[];
}

export default function PresalePage() {
  const params = useParams();
  const router = useRouter();
  const tokenAddress = params.tokenAddress as string;
  const { wallet, externalWallet, activeWallet } = useWallet();
  const { login, authenticated, linkWallet } = usePrivy();
  const { signTransaction } = useSignTransaction();
  const [presale, setPresale] = useState<Presale | null>(null);
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [bidsData, setBidsData] = useState<BidsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [maxContribution, setMaxContribution] = useState<number>(0);
  const [userContribution, setUserContribution] = useState<number>(0);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchSuccess, setLaunchSuccess] = useState<{
    poolCreationSignature: string;
    swapSignature: string | null;
  } | null>(null);
  const [vestingInfo, setVestingInfo] = useState<VestingInfo | null>(null);

  // Check if connected wallet is the creator
  const isCreator = wallet && presale && wallet.toBase58() === presale.creator_wallet;

  useEffect(() => {
    async function fetchPresaleData() {
      try {
        // Fetch presale info and bids in parallel
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const [presaleResponse, bidsResponse] = await Promise.all([
          fetch(`/api/presale/${tokenAddress}`),
          fetch(`${apiUrl}/presale/${tokenAddress}/bids`)
        ]);

        if (!presaleResponse.ok) {
          throw new Error('Failed to fetch presale');
        }

        const presaleData = await presaleResponse.json();
        setPresale(presaleData);

        // Fetch bids data (even if it fails, we can still show the presale)
        if (bidsResponse.ok) {
          const bidsData = await bidsResponse.json();
          setBidsData(bidsData);
        } else {
          console.warn('Failed to fetch bids data');
          setBidsData({ totalRaised: 0, totalBids: 0, contributions: [] });
        }

        // Fetch metadata
        if (presaleData.token_metadata_url) {
          try {
            const metadataResponse = await fetch(presaleData.token_metadata_url);
            if (metadataResponse.ok) {
              const metadataData = await metadataResponse.json();
              setMetadata(metadataData);
            }
          } catch (err) {
            console.error('Error fetching metadata:', err);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    if (tokenAddress) {
      fetchPresaleData();
    }
  }, [tokenAddress]);

  // Fetch max contribution when wallet or presale changes
  useEffect(() => {
    async function fetchMaxContribution() {
      if (!wallet || !presale) {
        setMaxContribution(0);
        return;
      }

      // If there's no whitelist, allow unlimited contributions
      if (!presale.presale_tokens || presale.presale_tokens.length === 0) {
        setMaxContribution(Infinity);
        return;
      }

      try {
        const whitelistedTokens = presale.presale_tokens.join(',');
        const response = await fetch(
          `/api/presale/max-contribution?walletAddress=${wallet.toBase58()}&whitelistedTokens=${whitelistedTokens}`
        );

        if (response.ok) {
          const data = await response.json();
          setMaxContribution(data.maxContributionZC);
        } else {
          console.error('Failed to fetch max contribution');
          setMaxContribution(0);
        }
      } catch (err) {
        console.error('Error fetching max contribution:', err);
        setMaxContribution(0);
      }
    }

    fetchMaxContribution();
  }, [wallet, presale]);

  // Fetch user's existing contribution when wallet or presale changes
  useEffect(() => {
    async function fetchUserContribution() {
      if (!wallet || !presale) {
        setUserContribution(0);
        return;
      }

      try {
        const response = await fetch(
          `/api/presale/${tokenAddress}/contribution?walletAddress=${wallet.toBase58()}`
        );

        if (response.ok) {
          const data = await response.json();
          setUserContribution(data.contributionSol);
        } else {
          console.error('Failed to fetch user contribution');
          setUserContribution(0);
        }
      } catch (err) {
        console.error('Error fetching user contribution:', err);
        setUserContribution(0);
      }
    }

    fetchUserContribution();
  }, [wallet, presale, tokenAddress]);

  // Auto-refresh presale status and bids data every 10 seconds
  useEffect(() => {
    if (!tokenAddress) return;

    // Function to check presale status
    const checkPresaleStatus = async () => {
      try {
        const response = await fetch(`/api/presale/${tokenAddress}`);
        if (response.ok) {
          const presaleData = await response.json();
          setPresale(presaleData);

          // If presale has launched, you might want to trigger additional actions
          if (presaleData.status === 'launched' && presale?.status === 'pending') {
            console.log('Presale has launched!');
            // Could trigger a notification or redirect here if needed
          }
        }
      } catch (err) {
        console.error('Error checking presale status:', err);
      }
    };

    // Set up interval to refresh presale status and bids data
    const interval = setInterval(async () => {
      await Promise.all([
        checkPresaleStatus(),
        refreshBidsData()
      ]);
    }, 10000);

    return () => clearInterval(interval);
  }, [tokenAddress, presale?.status]);

  // Fetch vesting info when wallet or presale status changes
  useEffect(() => {
    async function fetchVestingInfo() {
      if (!wallet || !presale || presale.status !== 'launched') {
        setVestingInfo(null);
        return;
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(
          `${apiUrl}/presale/${tokenAddress}/claims/${wallet.toBase58()}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setVestingInfo(data);
        } else {
          const errorData = await response.json().catch(() => null);
          console.error('Failed to fetch vesting info:', response.status, errorData);
          setVestingInfo(null);
        }
      } catch (err) {
        console.error('Error fetching vesting info:', err);
        setVestingInfo(null);
      }
    }

    fetchVestingInfo();
    // Refresh vesting info every 30 seconds
    const interval = setInterval(fetchVestingInfo, 30000);
    return () => clearInterval(interval);
  }, [wallet, presale?.status, tokenAddress]);

  const refreshBidsData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const bidsResponse = await fetch(`${apiUrl}/presale/${tokenAddress}/bids`);
      if (bidsResponse.ok) {
        const bidsData = await bidsResponse.json();
        setBidsData(bidsData);
      }

      // Also refresh user contribution
      if (wallet) {
        const contributionResponse = await fetch(
          `/api/presale/${tokenAddress}/contribution?walletAddress=${wallet.toBase58()}`
        );
        if (contributionResponse.ok) {
          const data = await contributionResponse.json();
          setUserContribution(data.contributionSol);
        }
      }
    } catch (err) {
      console.error('Error refreshing bids data:', err);
    }
  };


  const handleLaunch = async () => {
    if (!wallet || !externalWallet || !activeWallet || !presale) {
      console.error('Wallet or presale not available');
      return;
    }

    setIsLaunching(true);
    setLaunchError(null);

    try {
      // Step 1: Call API to get launch transactions
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const launchResponse = await fetch(`${apiUrl}/presale/${tokenAddress}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payerPublicKey: externalWallet.toString(),
        }),
      });

      if (!launchResponse.ok) {
        const errorData = await launchResponse.json();
        throw new Error(errorData.error || 'Failed to create launch transaction');
      }

      const launchData = await launchResponse.json();
      const { combinedTx, transactionId } = launchData;

      // Step 2: Deserialize and sign the combined transaction
      const combinedTxBuffer = bs58.decode(combinedTx);
      const combinedTransaction = Transaction.from(combinedTxBuffer);

      // Sign with user wallet
      const combinedSerialized = combinedTransaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      });

      const { signedTransaction: signedTxBytes } = await signTransaction({
        transaction: combinedSerialized,
        wallet: activeWallet
      });

      // Convert signed transaction to base58 string
      const signedTxBase58 = bs58.encode(signedTxBytes);

      console.log('Transaction signed by user, sending to confirmation endpoint...');

      // Step 3: Send signed transaction to confirmation endpoint
      const confirmResponse = await fetch(`${apiUrl}/presale/${tokenAddress}/launch-confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signedTransaction: signedTxBase58,
          transactionId,
        }),
      });

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json();
        throw new Error(errorData.error || 'Failed to confirm launch transaction');
      }

      const confirmData = await confirmResponse.json();
      console.log('Launch confirmed:', confirmData.signature);

      // Update local state
      setPresale({ ...presale, status: 'launched' });

      // Set success state (will show green text with transaction links)
      setLaunchSuccess({
        poolCreationSignature: confirmData.signature,
        swapSignature: null // Combined into single transaction now
      });

      // Optionally redirect to the token page
      // router.push(`/history/${tokenAddress}`);

    } catch (error) {
      console.error('Launch error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setLaunchError(errorMessage);
    } finally {
      setIsLaunching(false);
    }
  };

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 4)}....${address.slice(-4)}`;
  };

  const copyToClipboard = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#000000]">
      <main className="px-0 sm:px-4 relative">
        <div className="bg-[#141414] min-h-screen text-[#F7FCFE] rounded-none sm:rounded-4xl relative">
          <div className="max-w-7xl mx-auto px-8 py-12 sm:px-12 sm:py-16">
            <div className="flex justify-between items-center mb-12">
              <h1 className="text-5xl font-bold">𝓩 Presale</h1>
              {isCreator && presale?.status === 'pending' && (
                <button
                  onClick={handleLaunch}
                  disabled={isLaunching}
                  className="text-2xl font-bold text-[#b2e9fe] hover:text-[#d0f2ff] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLaunching ? 'LAUNCHING...' : 'LAUNCH'}
                </button>
              )}
            </div>

            {loading && (
              <div className="text-xl text-gray-300">Loading presale...</div>
            )}

            {error && (
              <div className="text-xl text-red-400">Error: {error}</div>
            )}

            {launchError && (
              <div className="text-xl text-red-400 mb-4">Launch Error: {launchError}</div>
            )}

            {launchSuccess && (
              <div className="mb-6">
                <p className="text-lg text-green-400">
                  Success! Presale launched.{' '}
                  <a
                    href={`https://solscan.io/tx/${launchSuccess.poolCreationSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-green-300 underline"
                  >
                    View Transaction
                  </a>
                </p>
              </div>
            )}

            {presale && (
              <div className="space-y-8">
                {/* Token Card */}
                <TokenCard
                  tokenName={presale.token_name}
                  tokenSymbol={presale.token_symbol}
                  tokenAddress={presale.token_address}
                  creatorWallet={presale.creator_wallet}
                  creatorTwitter={presale.creator_twitter}
                  creatorGithub={presale.creator_github}
                  metadata={metadata}
                  status={presale.status}
                  createdAt={presale.created_at}
                  showStats={true}
                />

                {/* Presale Tokens & Buy Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <h3 className="text-2xl font-bold">Presale Token Requirements</h3>
                    {presale.presale_tokens && presale.presale_tokens.length > 0 ? (
                      <>
                        <p className="text-gray-300 text-lg">
                          Only holders of the following tokens at the time of snapshot are allowed to participate in the presale:
                        </p>
                        <div className="space-y-2">
                          {presale.presale_tokens.map((token, index) => (
                            <div
                              key={index}
                              className="font-mono text-gray-300 py-2 border-b border-gray-800"
                            >
                              {token}
                            </div>
                          ))}

                          {/* Docs Link */}
                          <div className="mt-4 pt-4">
                            <a
                              href="https://docs.percent.markets/presale"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-lg text-gray-300 hover:text-white transition-colors inline-flex items-center gap-2"
                            >
                              Docs
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-300 text-lg">
                        No token requirements - this presale is open to everyone!
                      </p>
                    )}
                  </div>

                  {presale.status === 'launched' ? (
                    <VestingModal
                      tokenSymbol={presale.token_symbol}
                      tokenAddress={tokenAddress}
                      vestingInfo={vestingInfo}
                      onClaimSuccess={async () => {
                        // Refresh vesting info after successful claim
                        if (wallet) {
                          try {
                            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                            const response = await fetch(
                              `${apiUrl}/presale/${tokenAddress}/claims/${wallet.toBase58()}`
                            );
                            if (response.ok) {
                              const data = await response.json();
                              setVestingInfo(data);
                            }
                          } catch (err) {
                            console.error('Error refreshing vesting info:', err);
                          }
                        }
                      }}
                    />
                  ) : (
                    <PresaleBuyModal
                      tokenSymbol={presale.token_symbol}
                      status={presale.status}
                      maxContribution={maxContribution}
                      userContribution={userContribution}
                      escrowAddress={presale.escrow_pub_key}
                      onSuccess={refreshBidsData}
                    />
                  )}
                </div>

                {/* Total Raised Section */}
                <div className="space-y-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-gray-300 text-lg">Total Raised</p>
                        {presale?.escrow_pub_key && (
                          <a
                            href={`https://solscan.io/account/${presale.escrow_pub_key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-300 hover:text-white transition-colors"
                            title="View escrow wallet on Solscan"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                          </a>
                        )}
                        <InfoTooltip text="All funds raised will be included as the first buy. Allocations will be based on total average-price and buy-size. Claimable post-launch over 2 weeks. The dev can launch the token at their discretion." />
                      </div>
                      <p className="text-5xl font-bold text-white">
                        {bidsData ? bidsData.totalRaised.toFixed(0) : '0'} $ZC
                      </p>
                    </div>
                  </div>

                  {/* All Contributions Section */}
                  <div className="space-y-4">
                    <h3 className="text-2xl font-bold">All Contributions</h3>
                    {bidsData && bidsData.contributions.length > 0 ? (
                      <div className="max-h-[400px] overflow-y-auto">
                        <div className="space-y-0">
                          {bidsData.contributions.map((contribution, index) => (
                            <div
                              key={contribution.transactionSignature}
                              className="flex justify-between items-center py-3 border-b border-gray-800 hover:text-white transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => copyToClipboard(contribution.wallet)}
                                  className={`transition-colors ${
                                    copiedAddress === contribution.wallet ? 'text-green-500' : 'text-gray-300 hover:text-white'
                                  }`}
                                >
                                  {copiedAddress === contribution.wallet ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                  )}
                                </button>
                                <span className="font-mono text-gray-300">{formatWalletAddress(contribution.wallet)}</span>
                              </div>
                              <span className="text-white font-bold">{contribution.amount.toFixed(0)} $ZC</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-300 text-lg">No contributions yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Navigation />
          </div>
        </div>
      </main>
    </div>
  );
}
