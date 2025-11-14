'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '@/components/WalletProvider';
import { useLaunchInfo, useTokenInfo, useDesignatedClaims, useTransactions } from '@/hooks/useTokenData';
import { useTheme } from '@/contexts/ThemeContext';

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

interface HistoryContentProps {
  tokenAddress: string;
  tokenSymbol?: string;
}

export function HistoryContent({ tokenAddress, tokenSymbol = '' }: HistoryContentProps) {
  const { wallet } = useWallet();
  const { theme } = useTheme();

  // Use SWR hooks for cached data
  const { launchData, isLoading: launchLoading, mutate: mutateLaunch } = useLaunchInfo(tokenAddress);
  const { tokenInfo: supplyData, isLoading: supplyLoading, mutate: mutateSupply } = useTokenInfo(tokenAddress);
  const { designatedData, isLoading: designatedLoading, mutate: mutateDesignated } = useDesignatedClaims(tokenAddress);

  // State for UI
  const [transactionPages, setTransactionPages] = useState<Transaction[][]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set());
  const [loadingPage, setLoadingPage] = useState(false);
  const TRANSACTIONS_PER_PAGE = 10;

  // Compute combined data from cached responses
  const [tokenImageUri, setTokenImageUri] = useState<string | undefined>();

  const tokenInfo: TokenInfo = useMemo(() => {
    const launch = launchData?.launches?.[0];
    return {
      address: tokenAddress,
      symbol: launch?.token_symbol || tokenSymbol || '',
      name: launch?.token_name || 'Unknown Token',
      totalSupply: supplyData?.supply || '1000000000',
      imageUri: tokenImageUri || launch?.image_uri
    };
  }, [tokenAddress, tokenSymbol, launchData, supplyData, tokenImageUri]);

  // Fetch metadata image if not in DB
  useEffect(() => {
    const launch = launchData?.launches?.[0];
    if (!launch?.image_uri && launch?.token_metadata_url && !tokenImageUri) {
      fetch(launch.token_metadata_url)
        .then(res => res.json())
        .then(metadata => {
          if (metadata.image) {
            setTokenImageUri(metadata.image);
          }
        })
        .catch(() => {
          // Failed to fetch metadata
        });
    } else if (launch?.image_uri) {
      setTokenImageUri(launch.image_uri);
    }
  }, [launchData, tokenImageUri]);

  const launchInfo: LaunchInfo | null = useMemo(() => {
    const launch = launchData?.launches?.[0];
    const claim = designatedData?.claim;

    if (!launch) return null;

    const creatorWallet = claim?.original_launcher || launch.creator_wallet;
    if (!creatorWallet) return null;

    return {
      creatorWallet,
      creatorTwitter: launch.creator_twitter,
      creatorGithub: launch.creator_github,
      isCreatorDesignated: !!(claim?.verified_at || launch.is_creator_designated),
      verifiedWallet: claim?.verified_wallet,
      verifiedEmbeddedWallet: claim?.verified_embedded_wallet
    };
  }, [launchData, designatedData]);

  // Get creator wallet for transactions fetch
  const creatorWallet = launchInfo?.creatorWallet || null;
  const isUserDev = !!(wallet && creatorWallet && wallet.toBase58() === creatorWallet);

  // Fetch first page of transactions using SWR
  const {
    transactions: firstPageTransactions,
    hasMore,
    lastSignature: firstPageLastSig,
    isLoading: transactionsLoading,
    mutate: mutateTransactions
  } = useTransactions(tokenAddress, creatorWallet, null, isUserDev);

  // Overall loading state
  const loading = launchLoading || supplyLoading || designatedLoading || transactionsLoading;

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

  // Process first page transactions with labels
  const currentTransactions = useMemo(() => {
    if (currentPage === 0 && firstPageTransactions.length > 0) {
      return firstPageTransactions.map((tx: Transaction) => ({
        ...tx,
        fromLabel: processLabel(tx.fromLabel, tx.fromWallet),
        toLabel: processLabel(tx.toLabel, tx.toWallet)
      }));
    }
    return transactionPages[currentPage] || [];
  }, [currentPage, firstPageTransactions, transactionPages, processLabel]);

  // Track hasMore for pagination
  const hasMorePages = currentPage === 0 ? hasMore : (transactionPages[currentPage + 1] !== undefined || lastSignature !== null);

  // Update pagination state when first page loads
  useEffect(() => {
    if (currentPage === 0 && firstPageTransactions.length > 0 && !transactionsLoading) {
      const processedTransactions = firstPageTransactions.map((tx: Transaction) => ({
        ...tx,
        fromLabel: processLabel(tx.fromLabel, tx.fromWallet),
        toLabel: processLabel(tx.toLabel, tx.toWallet)
      }));
      setTransactionPages([processedTransactions]);
      setLastSignature(firstPageLastSig);
    }
  }, [firstPageTransactions, firstPageLastSig, currentPage, processLabel, transactionsLoading]);

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

  // Handle page navigation - memoized
  const navigateToPage = useCallback(async (newPage: number) => {
    if (newPage < 0) return;

    if (!launchInfo?.creatorWallet) {
      return;
    }

    setCurrentPage(newPage);

    // Check if we already have this page cached
    if (transactionPages[newPage]) {
      setCurrentPage(newPage);
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
        const processedTransactions = transactions.map((tx: Transaction) => ({
          ...tx,
          fromLabel: processLabel(tx.fromLabel, tx.fromWallet),
          toLabel: processLabel(tx.toLabel, tx.toWallet)
        }));

        const newPages = [...transactionPages];
        newPages[newPage] = processedTransactions;
        setTransactionPages(newPages);
        setLastSignature(newLastSignature);
      }
    } catch (error) {
      // Error fetching page
    } finally {
      setLoadingPage(false);
    }
  }, [tokenAddress, lastSignature, TRANSACTIONS_PER_PAGE, processLabel, transactionPages, launchInfo]);

  const formatDate = (timestamp: number) => {
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
        // Use toLabel if available, otherwise use truncated toWallet
        const recipientLabel = tx.toLabel || truncateAddress(tx.toWallet);
        return {
          action: 'Reward',
          description: `${formatTokenAmount(tx.amount)} to `,
          toUser: recipientLabel,
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
      case 'transfer': return 'text-[#b2e9fe]';
      case 'buy': return 'text-[#b2e9fe]';
      case 'sell': return 'text-[#b2e9fe]';
      case 'burn': return 'text-[#b2e9fe]';
      case 'mint': return 'text-[#b2e9fe]';
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

  // Calculate total pages for pagination display
  const totalPages = hasMorePages ? currentPage + 2 : currentPage + 1;

  // Format transaction description for display
  const formatTransactionDescription = (tx: Transaction) => {
    const desc = getTransactionDescription(tx);
    const percentage = calculateSupplyPercentage(tx.amount);
    // Always show recipient for transfer transactions, use toWallet if toLabel is empty
    if (tx.type === 'transfer') {
      const recipient = desc.toUser || truncateAddress(tx.toWallet);
      return `${desc.description}${recipient} ( ${percentage}%)`;
    } else if (desc.toUser) {
      return `${desc.description}${desc.toUser} ( ${percentage}%)`;
    } else {
      return `${desc.description} ( ${percentage}%)`;
    }
  };

  const cardBg = theme === 'dark' ? '#222222' : '#ffffff';
  const cardBorder = theme === 'dark' ? '#1C1C1C' : '#e5e5e5';
  const shadowStyle = theme === 'dark'
    ? '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)'
    : '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)';
  const textColor = theme === 'dark' ? '#ffffff' : '#0a0a0a';
  const mutedTextColor = theme === 'dark' ? '#949494' : '#949494';

  return (
    <div 
      className="rounded-[12px] p-[20px] flex flex-col gap-[20px] items-start w-full h-full min-h-0" 
      style={{ 
        fontFamily: 'Inter, sans-serif',
        backgroundColor: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: shadowStyle,
      }}
    >
      {/* Header */}
      <p className="font-medium text-[20px] leading-[1.34] tracking-[-0.2px] shrink-0" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
        Dev TX History
      </p>

      {/* Transactions List */}
      {loading ? (
        <div className="flex flex-col gap-[12px] flex-1 min-h-0 items-start w-full">
          <p className="font-normal text-[14px] leading-[1.4]" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
            Loading...
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-[12px] flex-1 min-h-0 items-start overflow-y-auto w-full">
          {currentTransactions.length === 0 ? (
            <p className="font-normal text-[14px] leading-[1.4]" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
              No transactions found
            </p>
          ) : (
            currentTransactions.map((tx: Transaction) => {
              const desc = getTransactionDescription(tx);
              return (
                <div key={tx.signature} className="flex gap-[40px] items-center w-full flex-shrink-0">
                  {/* Transaction Type */}
                  <p className="font-semibold text-[16px] leading-[16px] tracking-[0.32px] capitalize min-w-[68px] shrink-0" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
                    {desc.action}:
                  </p>
                  {/* Transaction Description - Clickable */}
                  <a
                    href={`https://solscan.io/tx/${tx.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-normal text-[14px] leading-[1.4] min-w-[290px] hover:opacity-80 transition-opacity cursor-pointer"
                    style={{ fontFamily: 'Inter, sans-serif', color: textColor }}
                  >
                    {formatTransactionDescription(tx)}
                  </a>
                  {/* Transaction Date */}
                  <p className="font-normal text-[14px] leading-[1.4] shrink-0" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
                    {formatDate(tx.timestamp)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && (currentPage > 0 || hasMorePages) && (
        <div className="flex gap-[40px] items-center justify-center w-full shrink-0">
          <button
            onClick={() => navigateToPage(currentPage - 1)}
            disabled={currentPage === 0 || loadingPage}
            className={`font-normal text-[14px] leading-[1.2] transition-colors ${
              currentPage === 0 || loadingPage
                ? 'cursor-not-allowed'
                : 'cursor-pointer'
            }`}
            style={{ 
              fontFamily: 'Inter, sans-serif',
              color: currentPage === 0 || loadingPage 
                ? mutedTextColor 
                : (theme === 'dark' ? mutedTextColor : mutedTextColor),
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled && theme === 'dark') {
                e.currentTarget.style.color = '#ffffff';
              } else if (!e.currentTarget.disabled) {
                e.currentTarget.style.color = '#0a0a0a';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.color = mutedTextColor;
              }
            }}
          >
            previous
          </button>
          <p className="font-normal text-[14px] leading-[1.2]" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
            Page {currentPage + 1}/{totalPages}
          </p>
          <button
            onClick={() => navigateToPage(currentPage + 1)}
            disabled={!hasMorePages || loadingPage}
            className={`font-normal text-[14px] leading-[1.2] transition-colors ${
              !hasMorePages || loadingPage
                ? 'cursor-not-allowed'
                : 'cursor-pointer'
            }`}
            style={{ 
              fontFamily: 'Inter, sans-serif',
              color: !hasMorePages || loadingPage 
                ? mutedTextColor 
                : (theme === 'dark' ? mutedTextColor : '#0a0a0a'),
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled && theme === 'dark') {
                e.currentTarget.style.color = '#ffffff';
              } else if (!e.currentTarget.disabled) {
                e.currentTarget.style.opacity = '0.8';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled) {
                if (theme === 'dark') {
                  e.currentTarget.style.color = mutedTextColor;
                } else {
                  e.currentTarget.style.opacity = '1';
                }
              }
            }}
          >
            next
          </button>
        </div>
      )}
    </div>
  );
}
