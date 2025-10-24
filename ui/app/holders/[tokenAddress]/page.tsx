'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/components/WalletProvider';
import { PublicKey } from '@solana/web3.js';

interface Holder {
  id?: number;
  wallet_address: string;
  token_balance: string;
  staked_balance: string;
  telegram_username?: string | null;
  x_username?: string | null;
  discord_username?: string | null;
  custom_label?: string | null;
  created_at?: string;
  updated_at?: string;
  last_sync_at?: string;
  percentage?: number;
}

interface HolderStats {
  totalHolders: number;
  totalBalance: string;
  lastSyncTime: string | null;
}

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
}

// Helper function to check if a wallet address is on curve (not a PDA)
function isOnCurve(address: string): boolean {
  try {
    const pubkey = new PublicKey(address);
    return PublicKey.isOnCurve(pubkey.toBuffer());
  } catch {
    return false; // Invalid address format
  }
}

export default function HoldersPage() {
  const params = useParams();
  const tokenAddress = params.tokenAddress as string;
  const { wallet } = useWallet();

  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    address: tokenAddress,
    symbol: '',
    name: ''
  });

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [editingHolder, setEditingHolder] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    telegram_username: '',
    discord_username: '',
    x_username: '',
    custom_label: ''
  });
  const [syncing, setSyncing] = useState(false);
  const [allHolders, setAllHolders] = useState<Holder[]>([]);
  const [holderStats, setHolderStats] = useState<HolderStats>({
    totalHolders: 0,
    totalBalance: '0',
    lastSyncTime: null
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Load holders from database
  const fetchHolders = useCallback(async () => {
    try {
      const response = await fetch(`/api/holders/${tokenAddress}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress })
      });
      if (response.ok) {
        const data = await response.json();
        // Filter out off-curve wallets (PDAs) and 0-balance holders before displaying
        const onCurveHolders = data.holders.filter((holder: Holder) =>
          isOnCurve(holder.wallet_address) && parseFloat(holder.token_balance) > 0
        );
        const holdersWithPercentage = calculatePercentages(onCurveHolders, data.stats.totalBalance);
        setAllHolders(holdersWithPercentage);
        // Update stats to reflect only on-curve holders
        setHolderStats({
          ...data.stats,
          totalHolders: onCurveHolders.length
        });
      } else {
        console.error('Failed to fetch holders:', response.status);
        setAllHolders([]);
      }
    } catch (error) {
      console.error('Error fetching holders:', error);
      setAllHolders([]);
    }
  }, [tokenAddress]);

  const calculatePercentages = (holders: Holder[], totalBalance: string): Holder[] => {
    const total = parseFloat(totalBalance);
    if (total === 0) return holders;

    return holders.map(holder => ({
      ...holder,
      percentage: (parseFloat(holder.token_balance) / total) * 100
    }));
  };

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await fetch(`/api/holders/${tokenAddress}/sync`, {
        method: 'POST'
      });

      if (response.ok) {
        // Refresh holders after sync
        await fetchHolders();
      } else {
        console.error('Failed to sync holders:', response.status);
      }
    } catch (error) {
      console.error('Error syncing holders:', error);
    } finally {
      setSyncing(false);
    }
  }, [tokenAddress, fetchHolders]);

  // Filter holders based on search query
  const filteredHolders = allHolders.filter(holder => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    const walletMatch = holder.wallet_address.toLowerCase().includes(query);
    const telegramMatch = holder.telegram_username?.toLowerCase().includes(query);
    const discordMatch = holder.discord_username?.toLowerCase().includes(query);
    const xMatch = holder.x_username?.toLowerCase().includes(query);
    const customLabelMatch = holder.custom_label?.toLowerCase().includes(query);

    return walletMatch || telegramMatch || discordMatch || xMatch || customLabelMatch;
  });

  const [currentPage, setCurrentPage] = useState(0);
  const holdersPerPage = 10;
  const totalPages = Math.ceil(filteredHolders.length / holdersPerPage);
  const holders = filteredHolders.slice(
    currentPage * holdersPerPage,
    (currentPage + 1) * holdersPerPage
  );

  // Reset to first page when search query changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery]);

  useEffect(() => {
    const initializePage = async () => {
      // First check if wallet is connected
      if (!wallet) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/launches`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: tokenAddress })
        });
        const data = await response.json();

        if (response.ok && data.launches && data.launches.length > 0) {
          const launch = data.launches[0];

          // Check if connected wallet is the creator
          const walletAddress = wallet.toString();
          const creatorAddress = launch.creator_wallet;

          if (walletAddress !== creatorAddress) {
            setAccessDenied(true);
            setLoading(false);
            return;
          }

          setTokenInfo({
            address: tokenAddress,
            symbol: launch.token_symbol || 'Unknown',
            name: launch.token_name || 'Unknown Token'
          });

          // Load holders from database
          await fetchHolders();

          // Trigger background sync
          triggerSync();
        } else {
          // Token not found in launches
          setAccessDenied(true);
        }
      } catch (error) {
        console.error('Error initializing page:', error);
        setAccessDenied(true);
      } finally {
        setLoading(false);
      }
    };

    initializePage();
  }, [tokenAddress, wallet, fetchHolders, triggerSync]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const handleEditClick = (holder: Holder) => {
    setEditingHolder(holder.wallet_address);
    setEditForm({
      telegram_username: holder.telegram_username || '',
      discord_username: holder.discord_username || '',
      x_username: holder.x_username || '',
      custom_label: holder.custom_label || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingHolder(null);
    setEditForm({
      telegram_username: '',
      discord_username: '',
      x_username: '',
      custom_label: ''
    });
  };

  const handleSaveEdit = async (holderAddress: string) => {
    try {
      const response = await fetch(`/api/holders/${tokenAddress}/${holderAddress}/labels`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        // Refresh holders to show updated labels
        await fetchHolders();
        console.log('Social labels saved successfully');
      } else {
        console.error('Failed to save social labels:', response.status);
      }
    } catch (error) {
      console.error('Error saving social labels:', error);
    }

    setEditingHolder(null);
    setEditForm({
      telegram_username: '',
      discord_username: '',
      x_username: '',
      custom_label: ''
    });
  };

  const handleInputChange = (field: 'telegram_username' | 'discord_username' | 'x_username' | 'custom_label', value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  // Handle access control rendering
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main className="max-w-4xl px-8 py-16 sm:px-12 sm:py-24">
          <p className="text-xl text-gray-300">Loading...</p>
        </main>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main className="max-w-4xl px-8 py-16 sm:px-12 sm:py-24">
          <h1 className="text-5xl font-bold mb-8">Access Denied</h1>
          <div className="space-y-6">
            <p className="text-xl text-gray-300">
              {!wallet
                ? "Please connect your wallet to view token holders."
                : "You are not the creator of this token. Only token creators can view and manage holder information."
              }
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-4xl px-8 py-16 sm:px-12 sm:py-24">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/manage"
            className="text-gray-300 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-5xl font-bold">Holders</h1>
        </div>

        <div className="space-y-6 mb-12">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xl text-gray-300 mb-2">Contract Address</p>
              <p className="text-xl text-white font-mono break-all">{tokenInfo.address}</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl text-gray-300">Total Holders:</span>
              <span className="text-xl text-white">{holderStats.totalHolders}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-4">
            <span className="text-xl text-gray-300">Symbol:</span>
            <span className="text-xl text-white">{tokenInfo.symbol}</span>
            <span className="text-xl text-gray-300">Name:</span>
            <span className="text-xl text-white">{tokenInfo.name}</span>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-baseline justify-between mb-4">
            <div className="flex items-baseline gap-4">
              {holderStats.lastSyncTime && (
                <span className="text-lg text-gray-300">
                  Last sync: {new Date(holderStats.lastSyncTime).toLocaleString()}
                </span>
              )}
              {syncing && (
                <span className="text-lg text-gray-300">Syncing holders...</span>
              )}
            </div>
            <button
              onClick={triggerSync}
              disabled={syncing}
              className={`text-xl transition-colors cursor-pointer ${
                syncing
                  ? 'text-gray-300-temp cursor-not-allowed'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              {syncing ? 'Syncing...' : 'Sync Holders'}
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search by wallet address or labels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pb-2 bg-transparent border-b border-white text-white text-lg placeholder:text-gray-300 focus:outline-none pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-8">
          {holders.map((holder, index) => (
            <div key={holder.wallet_address} className="border-b border-gray-800 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg text-gray-300">#{currentPage * holdersPerPage + index + 1}</span>
                  <span className="text-lg text-white font-mono">
                    {formatAddress(holder.wallet_address)}
                  </span>
                  {wallet && holder.wallet_address === wallet.toBase58() && (
                    <span className="text-sm text-green-400 bg-green-400/10 px-2 py-1 rounded">
                      You
                    </span>
                  )}
                  {holder.custom_label && (
                    <span className="text-sm text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">
                      {holder.custom_label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg text-white">
                    {parseFloat(holder.token_balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-lg text-gray-300">
                    {holder.percentage?.toFixed(2)}%
                  </span>
                  <button
                    onClick={() => handleEditClick(holder)}
                    className="text-sm text-gray-300 hover:text-white transition-colors cursor-pointer"
                  >
                    Labels
                  </button>
                </div>
              </div>

              {editingHolder === holder.wallet_address ? (
                <div className="mt-3 ml-8 space-y-2">
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <input
                      type="text"
                      placeholder="Telegram username"
                      value={editForm.telegram_username}
                      onChange={(e) => handleInputChange('telegram_username', e.target.value)}
                      className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder:text-gray-300-temp focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Discord username"
                      value={editForm.discord_username}
                      onChange={(e) => handleInputChange('discord_username', e.target.value)}
                      className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder:text-gray-300-temp focus:outline-none focus:border-purple-500"
                    />
                    <input
                      type="text"
                      placeholder="X username"
                      value={editForm.x_username}
                      onChange={(e) => handleInputChange('x_username', e.target.value)}
                      className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder:text-gray-300-temp focus:outline-none focus:border-sky-500"
                    />
                    <input
                      type="text"
                      placeholder="Custom label"
                      value={editForm.custom_label}
                      onChange={(e) => handleInputChange('custom_label', e.target.value)}
                      className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder:text-gray-300-temp focus:outline-none focus:border-yellow-500"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSaveEdit(holder.wallet_address)}
                      className="text-sm text-green-400 hover:text-green-300 transition-colors cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-sm text-gray-300 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {(holder.telegram_username || holder.discord_username || holder.x_username) && (
                    <div className="flex items-center gap-4 mt-1 ml-8">
                      {holder.telegram_username && (
                        <span className="text-sm text-blue-400">
                          TG: {holder.telegram_username}
                        </span>
                      )}
                      {holder.discord_username && (
                        <span className="text-sm text-purple-400">
                          DC: {holder.discord_username}
                        </span>
                      )}
                      {holder.x_username && (
                        <span className="text-sm text-sky-400">
                          X: {holder.x_username}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className={`text-lg transition-colors cursor-pointer ${
                currentPage === 0
                  ? 'text-gray-300-temp cursor-not-allowed'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Previous
            </button>
            <span className="text-lg text-gray-300">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              className={`text-lg transition-colors cursor-pointer ${
                currentPage === totalPages - 1
                  ? 'text-gray-300-temp cursor-not-allowed'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Next
            </button>
          </div>
        )}


        {holders.length === 0 && (
          <p className="text-xl text-gray-300">No holders found for this token</p>
        )}
      </main>
    </div>
  );
}