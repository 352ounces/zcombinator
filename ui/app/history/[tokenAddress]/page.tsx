'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useWallet } from '@/components/WalletProvider';

interface Transaction {
  signature: string;
  timestamp: number;
  type: 'transfer' | 'buy' | 'sell' | 'burn' | 'mint' | 'unknown';
  amount: string;
  solAmount?: string;
  fromWallet: string;
  toWallet: string;
  fromLabel: string;
  toLabel: string;
  memo?: string | null;
  rawTransaction?: unknown;
}

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  totalSupply: string;
  imageUri?: string;
}

interface LaunchInfo {
  creatorWallet: string;
  creatorTwitter?: string;
  creatorGithub?: string;
  isCreatorDesignated: boolean;
  verifiedWallet?: string;
  verifiedEmbeddedWallet?: string;
}

// Removed dummy data - now using real transaction API

export default function TransactionHistoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { wallet } = useWallet();
  const tokenAddress = params.tokenAddress as string;

  const fromPage = searchParams.get('from');

  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    address: tokenAddress,
    symbol: 'Loading...',
    name: 'Loading...',
    totalSupply: '0',
    imageUri: undefined
  });

  const [launchInfo, setLaunchInfo] = useState<LaunchInfo | null>(null);

  const [transactionPages, setTransactionPages] = useState<Transaction[][]>([]);
  const [currentTransactions, setCurrentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set());
  const TRANSACTIONS_PER_PAGE = 10;


  // Helper function to truncate addresses - memoized
  const truncateAddress = useCallback((address: string) => {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  }, []);

  // Helper function to replace user's wallet with "You" - memoized
  const processLabel = useCallback((label: string, walletAddress: string) => {
    // Check if the wallet address matches the user's wallet
    if (wallet && walletAddress === wallet.toBase58()) {
      return 'You';
    }
    // If label is an address, truncate it
    if (label === walletAddress || label.match(/^[A-Za-z0-9]{40,}$/)) {
      return truncateAddress(label);
    }
    // Otherwise return the label as-is
    return label;
  }, [wallet, truncateAddress]);

  // Helper function to calculate percentage of supply
  const calculateSupplyPercentage = (amount: string) => {
    const amountNum = parseFloat(amount.replace(/,/g, ''));
    const totalSupplyNum = parseFloat(tokenInfo.totalSupply.replace(/,/g, ''));
    if (totalSupplyNum === 0) return '0.00';
    return ((amountNum / totalSupplyNum) * 100).toFixed(4);
  };

  // Helper function to format token amounts with K/M/B
  const formatTokenAmount = (amount: string | undefined) => {
    if (!amount) return '0';
    // Remove commas before parsing (amounts come formatted as "1,000,000")
    const num = parseFloat(amount.replace(/,/g, ''));
    if (num >= 1_000_000_000) {
      const billions = num / 1_000_000_000;
      return billions >= 10 ? `${Math.floor(billions)}B` : `${billions.toFixed(1)}B`;
    } else if (num >= 1_000_000) {
      const millions = num / 1_000_000;
      return millions >= 10 ? `${Math.floor(millions)}M` : `${millions.toFixed(1)}M`;
    } else if (num >= 1_000) {
      const thousands = num / 1_000;
      return thousands >= 10 ? `${Math.floor(thousands)}K` : `${thousands.toFixed(1)}K`;
    }
    return Math.floor(num).toString();
  };


  // Check if current user is the dev
  const isUserDev = wallet && launchInfo?.creatorWallet && wallet.toBase58() === launchInfo.creatorWallet;

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);

      // Fetch real token info from multiple sources
      let creatorWallet = '';
      try {
        const [launchesResponse, supplyResponse, designatedResponse] = await Promise.all([
          fetch(`/api/launches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenAddress })
          }),
          fetch(`/api/token-info/${tokenAddress}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokenAddress })
          }),
          fetch(`/api/designated-claims/${tokenAddress}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokenAddress })
          })
        ]);

        let tokenSymbol = 'Unknown';
        let tokenName = 'Unknown Token';
        let tokenImageUri: string | undefined;
        let totalSupply = '1000000000';
        let creatorTwitter: string | undefined;
        let creatorGithub: string | undefined;
        let isCreatorDesignated = false;

        // Get token metadata from launches API
        if (launchesResponse.ok) {
          const launchesData = await launchesResponse.json();
          const launch = launchesData.launches?.[0];
          if (launch) {
            tokenSymbol = launch.token_symbol || 'Unknown';
            tokenName = launch.token_name || 'Unknown Token';
            tokenImageUri = launch.image_uri;

            // If no image_uri in DB, try to fetch from metadata URL
            if (!tokenImageUri && launch.token_metadata_url) {
              try {
                const metadataResponse = await fetch(launch.token_metadata_url);
                if (metadataResponse.ok) {
                  const metadata = await metadataResponse.json();
                  tokenImageUri = metadata.image;
                }
              } catch (error) {
                // Failed to fetch metadata, continue without image
              }
            }

            creatorWallet = launch.creator_wallet || '';
            // Use creator_twitter and creator_github from token_launches table
            creatorTwitter = launch.creator_twitter;
            creatorGithub = launch.creator_github;
            isCreatorDesignated = launch.is_creator_designated || false;
          }
        }

        // Get designated claim data if available for wallet addresses
        let verifiedWallet: string | undefined;
        let verifiedEmbeddedWallet: string | undefined;

        if (designatedResponse.ok) {
          const designatedData = await designatedResponse.json();
          if (designatedData.claim) {
            // Use designated_claims for the original launcher if different
            if (designatedData.claim.original_launcher) {
              creatorWallet = designatedData.claim.original_launcher;
            }
            // Get verified wallet addresses from designated_claims
            verifiedWallet = designatedData.claim.verified_wallet;
            verifiedEmbeddedWallet = designatedData.claim.verified_embedded_wallet;
            // If there's a verified_at date, the claim has been verified
            if (designatedData.claim.verified_at) {
              isCreatorDesignated = true;
            }
          }
        }

        // Get real token supply from blockchain
        if (supplyResponse.ok) {
          const supplyData = await supplyResponse.json();
          totalSupply = supplyData.supply || '1000000000';
        }

        setTokenInfo({
          address: tokenAddress,
          symbol: tokenSymbol,
          name: tokenName,
          totalSupply,
          imageUri: tokenImageUri
        });

        if (creatorWallet) {
          setLaunchInfo({
            creatorWallet,
            creatorTwitter,
            creatorGithub,
            isCreatorDesignated,
            verifiedWallet,
            verifiedEmbeddedWallet
          });
        }
      } catch (error) {
        setTokenInfo({
          address: tokenAddress,
          symbol: 'Unknown',
          name: 'Unknown Token',
          totalSupply: '1000000000',
          imageUri: undefined
        });
      }

      // Fetch first page of transactions if we have a creator wallet
      if (creatorWallet) {
        try {
          const response = await fetch(`/api/transactions/${tokenAddress}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tokenAddress,
              walletAddress: creatorWallet,
              limit: TRANSACTIONS_PER_PAGE,
              fetchLabels: wallet && creatorWallet === wallet.toBase58()
            })
          });

          if (!response.ok) {
            throw new Error('Failed to fetch transactions');
          }

          const data = await response.json();
          const transactions = data.transactions || [];
          const hasMore = data.hasMore || false;
          const newLastSignature = data.lastSignature || null;

          if (transactions.length > 0) {
            // Process transactions to apply "You" label and truncate addresses
            const processedTransactions = transactions.map((tx: Transaction) => ({
              ...tx,
              fromLabel: processLabel(tx.fromLabel, tx.fromWallet),
              toLabel: processLabel(tx.toLabel, tx.toWallet)
            }));

            setTransactionPages([processedTransactions]);
            setCurrentTransactions(processedTransactions);
            setHasMorePages(hasMore);
            setLastSignature(newLastSignature);
          }
        } catch (error) {
          // Error fetching transactions
        }
      }

      setLoading(false);
    };

    loadInitialData();
  }, [tokenAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle page navigation - memoized
  const navigateToPage = useCallback(async (newPage: number) => {
    if (newPage < 0) return;

    if (!launchInfo?.creatorWallet) {
      return;
    }

    setCurrentPage(newPage);

    // Check if we already have this page cached
    if (transactionPages[newPage]) {
      // Apply "You" label and address truncation to cached page as well
      const cachedTransactions = transactionPages[newPage];
      const processedCachedTransactions = cachedTransactions.map((tx: Transaction) => ({
        ...tx,
        fromLabel: processLabel(tx.fromLabel, tx.fromWallet),
        toLabel: processLabel(tx.toLabel, tx.toWallet)
      }));
      setCurrentTransactions(processedCachedTransactions);
      return;
    }

    // Need to fetch this page
    setLoadingPage(true);

    try {
      const response = await fetch(`/api/transactions/${tokenAddress}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress,
          walletAddress: launchInfo.creatorWallet,
          limit: TRANSACTIONS_PER_PAGE,
          fetchLabels: isUserDev,
          ...(lastSignature && { before: lastSignature })
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      const transactions = data.transactions || [];
      const hasMore = data.hasMore || false;
      const newLastSignature = data.lastSignature || null;

      if (transactions.length > 0) {
        // Process transactions to apply "You" label and truncate addresses
        const processedTransactions = transactions.map((tx: Transaction) => ({
          ...tx,
          fromLabel: processLabel(tx.fromLabel, tx.fromWallet),
          toLabel: processLabel(tx.toLabel, tx.toWallet)
        }));

        // Update cached pages
        const newPages = [...transactionPages];
        newPages[newPage] = processedTransactions;
        setTransactionPages(newPages);

        setCurrentTransactions(processedTransactions);
        setHasMorePages(hasMore);
        setLastSignature(newLastSignature);
      }
    } catch (error) {
      // Error fetching page
    } finally {
      setLoadingPage(false);
    }
  }, [tokenAddress, lastSignature, TRANSACTIONS_PER_PAGE, processLabel, transactionPages, launchInfo]);

  const formatDate = (timestamp: number) => {
    // Helius timestamp is in seconds, but JavaScript Date expects milliseconds
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  // Helper to check if label is a social label (not a wallet address)
  const isSocialLabel = (label: string, wallet: string) => {
    return label !== wallet && !label.match(/^[A-Za-z0-9]{6}\.\.\.[A-Za-z0-9]{6}$/);
  };

  const getTransactionDescription = (tx: Transaction) => {
    switch (tx.type) {
      case 'transfer':
        return {
          action: 'Reward',
          description: `${formatTokenAmount(tx.amount)} to `,
          toUser: tx.toLabel,
          toUserIsSocial: isSocialLabel(tx.toLabel, tx.toWallet)
        };
      case 'mint':
        return {
          action: 'Claim',
          description: formatTokenAmount(tx.amount),
          toUser: '',
          toUserIsSocial: false
        };
      case 'sell':
        return {
          action: 'Sell',
          description: tx.solAmount ? `${tx.solAmount} SOL` : `${formatTokenAmount(tx.amount)} ${tokenInfo.symbol}`,
          toUser: '',
          toUserIsSocial: false
        };
      case 'buy':
        return {
          action: 'Buy',
          description: formatTokenAmount(tx.amount),
          toUser: '',
          toUserIsSocial: false
        };
      case 'burn':
        return {
          action: 'Burn',
          description: formatTokenAmount(tx.amount),
          toUser: '',
          toUserIsSocial: false
        };
      default:
        return {
          action: 'Unknown',
          description: 'transaction',
          toUser: '',
          toUserIsSocial: false
        };
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'transfer': return 'text-blue-400';
      case 'buy': return 'text-green-400';
      case 'sell': return 'text-orange-400';
      case 'burn': return 'text-red-400';
      case 'mint': return 'text-purple-400';
      default: return 'text-gray-300';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'transfer':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        );
      case 'mint':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        );
      case 'sell':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        );
      case 'buy':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case 'burn':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-7xl px-8 py-8 sm:px-12 sm:py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href={fromPage === 'tokens' ? '/tokens' : '/manage'}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-5xl font-bold">Dev Transaction History</h1>
        </div>

        <div className="mb-12">
          <div className="flex items-center gap-3 text-xl">
            {tokenInfo.imageUri && (
              <img
                src={tokenInfo.imageUri}
                alt={tokenInfo.symbol}
                className="w-8 h-8 rounded-full"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="gray"><circle cx="12" cy="12" r="10"/></svg>';
                }}
              />
            )}
            <span className="font-bold text-white">{tokenInfo.symbol}</span>
            <span className="text-white">{tokenInfo.name}</span>
            <span
              onClick={() => {
                navigator.clipboard.writeText(tokenInfo.address);
              }}
              className="text-gray-300 font-mono cursor-pointer hover:text-white transition-colors"
              title="Click to copy full address"
            >
              {tokenInfo.address.slice(0, 6)}...{tokenInfo.address.slice(-6)}
            </span>
          </div>
        </div>


        {/* Transactions */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {currentTransactions.length === 0 ? (
              <p className="text-xl text-gray-300 text-center py-12">
                No transactions found
              </p>
            ) : (
              currentTransactions.map((tx) => {
                const isExpanded = expandedTransactions.has(tx.signature);
                const hasMemo = tx.memo && tx.memo.trim().length > 0;

                return (
                  <div key={tx.signature} className="border-b border-gray-800 pb-3">
                    {/* Transaction Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            if (hasMemo) {
                              const newExpanded = new Set(expandedTransactions);
                              if (isExpanded) {
                                newExpanded.delete(tx.signature);
                              } else {
                                newExpanded.add(tx.signature);
                              }
                              setExpandedTransactions(newExpanded);
                            }
                          }}
                          className={`text-white ${hasMemo ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity`}
                          aria-label={hasMemo ? (isExpanded ? "Collapse memo" : "Expand memo") : tx.type}
                          disabled={!hasMemo}
                        >
                          {getTypeIcon(tx.type)}
                        </button>
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg text-white">
                            {(() => {
                              const desc = getTransactionDescription(tx);
                              return (
                                <>
                                  <span className={getTypeColor(tx.type)}>{desc.action}</span>
                                  : {desc.description}
                                  {desc.toUser && (
                                    <span className={desc.toUserIsSocial ? 'font-bold' : ''}>
                                      {desc.toUser}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </span>
                          <span className="text-sm text-gray-300-temp">
                            ({calculateSupplyPercentage(tx.amount)}%)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-300-temp">
                          {formatDate(tx.timestamp)}
                        </span>
                        <a
                          href={`https://solscan.io/tx/${tx.signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-300 hover:text-white transition-colors cursor-pointer"
                          title="View on Solscan"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                    {/* Memo Expansion */}
                    {hasMemo && isExpanded && (
                      <div className="mt-3 ml-8 pl-4 border-l-2 border-gray-700">
                        <p className="text-sm text-gray-300 italic">
                          {tx.memo}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Pagination */}
        {!loading && (currentPage > 0 || hasMorePages) && (
          <div className="flex items-center justify-between text-lg">
            <button
              onClick={() => navigateToPage(currentPage - 1)}
              disabled={currentPage === 0 || loadingPage}
              className={`transition-colors cursor-pointer ${
                currentPage === 0 || loadingPage
                  ? 'text-gray-300-temp cursor-not-allowed'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              {loadingPage ? 'Loading...' : 'Previous'}
            </button>
            <span className="text-gray-300">
              Page {currentPage + 1}
            </span>
            <button
              onClick={() => navigateToPage(currentPage + 1)}
              disabled={!hasMorePages || loadingPage}
              className={`transition-colors cursor-pointer ${
                !hasMorePages || loadingPage
                  ? 'text-gray-300-temp cursor-not-allowed'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              {loadingPage ? 'Loading...' : 'Next'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}