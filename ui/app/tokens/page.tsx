'use client';

import { Navigation } from '@/components/Navigation';
import { TokenCard } from '@/components/TokenCard';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@/components/WalletProvider';

interface TokenLaunch {
  id: number;
  launch_time: string;
  creator_wallet: string;
  token_address: string;
  token_metadata_url: string;
  token_name: string | null;
  token_symbol: string | null;
  creator_twitter: string | null;
  creator_github: string | null;
  created_at: string;
  totalClaimed?: string;
  availableToClaim?: string;
  verified?: boolean;
}

interface TokenMetadata {
  name: string;
  symbol: string;
  image: string;
  website?: string;
  twitter?: string;
  caEnding?: string;
}

interface MarketData {
  price: number;
  liquidity: number;
  total_supply: number;
  circulating_supply: number;
  fdv: number;
  market_cap: number;
}

export default function TokensPage() {
  const { wallet, externalWallet } = useWallet();
  const [tokens, setTokens] = useState<TokenLaunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'verified' | 'all'>('verified');
  const [verifiedPage, setVerifiedPage] = useState(1);
  const [allPage, setAllPage] = useState(1);
  const [tokenMetadata, setTokenMetadata] = useState<Record<string, TokenMetadata>>({});
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const router = useRouter();

  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    fetchTokens();
  }, []);

  // Fetch market data when switching to 'all' view
  useEffect(() => {
    if (viewMode === 'all' && tokens.length > 0) {
      tokens.forEach((token) => {
        // Only fetch if we don't already have the data
        if (!marketData[token.token_address]) {
          fetchMarketData(token.token_address);
        }
      });
    }
  }, [viewMode, tokens]);

  const fetchTokens = async (forceRefresh = false) => {
    try {
      const response = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: forceRefresh })
      });
      if (response.ok) {
        const data = await response.json();
        setTokens(data.tokens);
        setLastRefresh(new Date());

        // Fetch metadata for all tokens
        data.tokens.forEach((token: TokenLaunch) => {
          fetchTokenMetadata(token.token_address, token.token_metadata_url);
        });

        // Only fetch market data for verified tokens on initial load
        const verifiedTokens = data.tokens.filter((token: TokenLaunch) =>
          token.verified
        );
        verifiedTokens.forEach((token: TokenLaunch) => {
          fetchMarketData(token.token_address);
        });

        // If we got cached data and it's been more than 30 seconds since page load,
        // silently fetch fresh data in background
        if (data.cached && !forceRefresh) {
          setTimeout(() => {
            fetch('/api/tokens', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh: true })
            })
              .then(res => res.json())
              .then(freshData => {
                if (freshData.tokens) {
                  setTokens(freshData.tokens);
                  setLastRefresh(new Date());
                  freshData.tokens.forEach((token: TokenLaunch) => {
                    fetchTokenMetadata(token.token_address, token.token_metadata_url);
                  });

                  // Only fetch market data for verified tokens or if in 'all' view
                  const tokensToFetchMarketData = viewMode === 'all'
                    ? freshData.tokens
                    : freshData.tokens.filter((token: TokenLaunch) =>
                        token.verified
                      );
                  tokensToFetchMarketData.forEach((token: TokenLaunch) => {
                    fetchMarketData(token.token_address);
                  });
                }
              })
              .catch(console.error);
          }, 1000); // Fetch fresh data after 1 second
        }
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTokenMetadata = async (tokenAddress: string, metadataUrl: string) => {
    try {
      const response = await fetch(metadataUrl);
      if (response.ok) {
        const metadata: TokenMetadata = await response.json();
        setTokenMetadata(prev => ({
          ...prev,
          [tokenAddress]: metadata
        }));
      }
    } catch (error) {
      console.error(`Error fetching metadata for ${tokenAddress}:`, error);
    }
  };

  const fetchMarketData = async (tokenAddress: string) => {
    try {
      const response = await fetch(`/api/market-data/${tokenAddress}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress })
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setMarketData(prev => ({
            ...prev,
            [tokenAddress]: result.data
          }));
        }
      }
    } catch (error) {
      console.error(`Error fetching market data for ${tokenAddress}:`, error);
    }
  };

  const handleRowClick = (token: TokenLaunch) => {
    router.push(`/history/${token.token_address}?from=tokens`);
  };

  // Memoize filtered tokens to avoid recalculating on every render
  const filteredTokens = useMemo(() => {
    // Apply verified filter if in verified mode
    if (viewMode === 'verified') {
      return tokens.filter(token =>
        token.verified
      );
    }

    return tokens;
  }, [tokens, viewMode]);

  // Calculate pagination
  const currentPage = viewMode === 'verified' ? verifiedPage : allPage;
  const setCurrentPage = viewMode === 'verified' ? setVerifiedPage : setAllPage;

  const totalPages = Math.ceil(filteredTokens.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTokens = filteredTokens.slice(startIndex, endIndex);

  // Calculate cumulative market cap
  const cumulativeMarketCap = useMemo(() => {
    return filteredTokens.reduce((total, token) => {
      const market = marketData[token.token_address];
      return total + (market?.market_cap || 0);
    }, 0);
  }, [filteredTokens, marketData]);

  const formatMarketCap = (marketCap: number) => {
    if (!marketCap || marketCap === 0) return '-';
    if (marketCap >= 1_000_000) {
      return `$${(marketCap / 1_000_000).toFixed(2)}M`;
    } else if (marketCap >= 1_000) {
      return `$${(marketCap / 1_000).toFixed(2)}K`;
    }
    return `$${marketCap.toFixed(2)}`;
  };

  return (
    <div className="h-screen bg-[#000000] flex flex-col overflow-hidden">
      <main className="px-0 sm:px-4 relative flex-1 flex flex-col overflow-hidden">
        <div className="bg-[#141414] text-[#F7FCFE] rounded-none sm:rounded-4xl relative flex-1 flex flex-col overflow-hidden">
          <div className="max-w-7xl px-8 py-12 sm:px-12 sm:py-16 flex-1 flex flex-col overflow-hidden">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-5xl font-bold">𝓩 Projects</h1>
        </div>

        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('verified')}
                className={`px-3 sm:px-4 py-2 rounded font-medium transition-colors text-sm sm:text-base ${
                  viewMode === 'verified'
                    ? 'bg-[#F7FCFE] text-black'
                    : 'bg-zinc-900/50 text-gray-300 hover:text-gray-200 border border-gray-800'
                }`}
              >
                Verified
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 sm:px-4 py-2 rounded font-medium transition-colors text-sm sm:text-base ${
                  viewMode === 'all'
                    ? 'bg-[#F7FCFE] text-black'
                    : 'bg-zinc-900/50 text-gray-300 hover:text-gray-200 border border-gray-800'
                }`}
              >
                All
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-gray-400">Cumulative Market Cap</span>
              <span className="text-xl sm:text-2xl font-semibold text-green-400">
                {formatMarketCap(cumulativeMarketCap)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-auto min-h-0">
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-12 text-gray-300-temp">
                  Loading tokens...
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="text-center py-12 text-gray-300-temp">
                  No tokens launched yet
                </div>
              ) : (
                paginatedTokens.map((token) => {
                  const metadata = tokenMetadata[token.token_address];
                  const market = marketData[token.token_address];
                  return (
                    <TokenCard
                      key={token.id}
                      tokenName={token.token_name}
                      tokenSymbol={token.token_symbol}
                      tokenAddress={token.token_address}
                      creatorWallet={token.creator_wallet}
                      creatorTwitter={token.creator_twitter}
                      creatorGithub={token.creator_github}
                      metadata={metadata}
                      launchTime={token.launch_time}
                      marketCap={market?.market_cap}
                      totalClaimed={token.totalClaimed}
                      availableToClaim={token.availableToClaim}
                      onClick={() => handleRowClick(token)}
                      showStats={true}
                      isCreator={!!(externalWallet && wallet && token.creator_wallet === wallet.toBase58())}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pb-4">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded bg-zinc-900/50 border border-gray-800 text-gray-300 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-gray-300 px-4">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded bg-zinc-900/50 border border-gray-800 text-gray-300 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>

            <div className="-mt-12">
              <Navigation />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}