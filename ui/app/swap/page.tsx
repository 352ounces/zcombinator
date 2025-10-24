'use client';

import { useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { useWallet } from '@/components/WalletProvider';
import { usePrivy } from '@privy-io/react-auth';
import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL, TransactionMessage, VersionedTransaction, AddressLookupTableAccount } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { CpAmm } from '@meteora-ag/cp-amm-sdk';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';
import { showToast } from '@/components/Toast';

// Import refactored services
import { getQuote } from './services/quoteService';
import { executeSwap } from './services/swapService';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
const ALT_ADDRESS = '8wUFS6aQ4fSN7BnvXJP83ZDRbVgq3KzPHeVsWqVWJk4B';

const SOL_TO_ZC_POOL = 'CCZdbVvDqPN8DmMLVELfnt9G1Q9pQNt3bTGifSpUY9Ad';
const ZC_TO_TEST_POOL = 'EGXMUVs2c7xQv12prySkRwNTznCNgLiVwnNByEP9Xg6i';
const ZC_TO_SHIRTLESS_POOL = 'EcE7GyMLvTK6tLWz2q7FopWqoW5836BbBh78nteon9vQ'; // ZC ↔ SHIRTLESS (ZC-quoted)
const SHIRTLESS_TO_GITPOST_POOL = '7LpSRp9R1KaVvgpgjrWfCLB476x4CKKVvf5ZmbpMugVU'; // SHIRTLESS ↔ GitPost (SHIRTLESS-quoted)
const WSOL = new PublicKey('So11111111111111111111111111111111111111112');
const ZC_MINT = new PublicKey('GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC');
const TEST_MINT = new PublicKey('9q7QYACmxQmj1XATGua2eXpWfZHztibB4gw59FJobCts');
const SHIRTLESS_MINT = new PublicKey('34mjcwkHeZWqJ8Qe3WuMJjHnCZ1pZeAd3AQ1ZJkKH6is');
const GITPOST_MINT = new PublicKey('BSu52RaorX691LxPyGmLp2UiPzM6Az8w2Txd9gxbZN14');
const PERC_MINT = new PublicKey('zcQPTGhdiTMFM6erwko2DWBTkN8nCnAGM7MUX9RpERC');

type Token = 'SOL' | 'ZC' | 'TEST' | 'SHIRTLESS' | 'GITPOST' | 'PERC';

interface SolanaWalletProvider {
  signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
}

interface WindowWithWallets extends Window {
  solana?: SolanaWalletProvider;
  solflare?: SolanaWalletProvider;
}

export default function SwapPage() {
  const { wallet, isPrivyAuthenticated } = useWallet();
  const { login, authenticated, linkWallet } = usePrivy();
  const [fromToken, setFromToken] = useState<Token>('SOL');
  const [toToken, setToToken] = useState<Token>('ZC');
  const [amount, setAmount] = useState('');
  const [estimatedOutput, setEstimatedOutput] = useState('');
  const [priceImpact, setPriceImpact] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [slippage] = useState('1');
  const [lastQuoteTime, setLastQuoteTime] = useState<number>(0);
  const [quoteRefreshCountdown, setQuoteRefreshCountdown] = useState<number>(10);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [showFromSelector, setShowFromSelector] = useState(false);
  const [showToSelector, setShowToSelector] = useState(false);
  const [balances, setBalances] = useState<Record<Token, string>>({ SOL: '0', ZC: '0', TEST: '0', SHIRTLESS: '0', GITPOST: '0', PERC: '0' });
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [refreshingBalancesAfterSwap, setRefreshingBalancesAfterSwap] = useState(false);
  const [isMaxAmount, setIsMaxAmount] = useState(false);

  const getTokenSymbol = (token: Token): string => {
    if (token === 'SOL') return 'SOL';
    if (token === 'ZC') return 'ZC';
    if (token === 'TEST') return 'TEST';
    if (token === 'SHIRTLESS') return 'SHIRTLESS';
    if (token === 'GITPOST') return 'POST';
    if (token === 'PERC') return 'PERC';
    return token;
  };

  const getTokenIcon = (token: Token) => {
    if (token === 'SOL') return '/solana_logo.png';
    if (token === 'ZC') return '/zcombinator-logo.png';
    if (token === 'TEST') return '/percent.png';
    if (token === 'SHIRTLESS') return '/shirtless-logo.png';
    if (token === 'GITPOST') return '/gitpost-logo.png';
    if (token === 'PERC') return '/percent.png';
    return '/percent.png';
  };

  const formatBalance = (balance: string): string => {
    const bal = parseFloat(balance);
    if (bal >= 1000000000) return (bal / 1000000000).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (bal >= 1000000) return (bal / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (bal >= 1000) return (bal / 1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
    return parseFloat(bal.toFixed(4)).toString();
  };

  const copyWalletAddress = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet.toBase58());
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  };


  const fetchBalances = async () => {
    if (!wallet) return;

    setIsLoadingBalances(true);
    try {
      const connection = new Connection(RPC_URL, 'confirmed');
      const newBalances: Record<Token, string> = { SOL: '0', ZC: '0', TEST: '0', SHIRTLESS: '0', GITPOST: '0', PERC: '0' };

      // Fetch SOL balance
      const solBalance = await connection.getBalance(wallet);
      newBalances.SOL = (solBalance / LAMPORTS_PER_SOL).toFixed(4);

      // Fetch ZC balance
      try {
        const zcAta = await getAssociatedTokenAddress(ZC_MINT, wallet, true);
        const zcAccount = await getAccount(connection, zcAta);
        newBalances.ZC = (Number(zcAccount.amount) / Math.pow(10, 6)).toFixed(4);
      } catch (e) {
        newBalances.ZC = '0';
      }

      // Fetch TEST balance
      try {
        const testAta = await getAssociatedTokenAddress(TEST_MINT, wallet, true);
        const testAccount = await getAccount(connection, testAta);
        newBalances.TEST = (Number(testAccount.amount) / Math.pow(10, 6)).toFixed(4);
      } catch (e) {
        newBalances.TEST = '0';
      }

      // Fetch SHIRTLESS balance
      try {
        const shirtlessAta = await getAssociatedTokenAddress(SHIRTLESS_MINT, wallet, true);
        const shirtlessAccount = await getAccount(connection, shirtlessAta);
        newBalances.SHIRTLESS = (Number(shirtlessAccount.amount) / Math.pow(10, 6)).toFixed(4);
      } catch (e) {
        newBalances.SHIRTLESS = '0';
      }

      // Fetch GITPOST balance
      try {
        const gitpostAta = await getAssociatedTokenAddress(GITPOST_MINT, wallet, true);
        const gitpostAccount = await getAccount(connection, gitpostAta);
        newBalances.GITPOST = (Number(gitpostAccount.amount) / Math.pow(10, 6)).toFixed(4);
      } catch (e) {
        newBalances.GITPOST = '0';
      }

      // Fetch PERC balance
      try {
        const percAta = await getAssociatedTokenAddress(PERC_MINT, wallet, true);
        const percAccount = await getAccount(connection, percAta);
        newBalances.PERC = (Number(percAccount.amount) / Math.pow(10, 6)).toFixed(4);
      } catch (e) {
        newBalances.PERC = '0';
      }

      setBalances(newBalances);
    } catch (error) {
      console.error('Error fetching balances:', error);
    } finally {
      setIsLoadingBalances(false);
    }
  };

  // Fetch balances on mount and when wallet changes
  useEffect(() => {
    if (wallet && isPrivyAuthenticated) {
      fetchBalances();
    }
  }, [wallet, isPrivyAuthenticated]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowFromSelector(false);
      setShowToSelector(false);
    };

    if (showFromSelector || showToSelector) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showFromSelector, showToSelector]);

  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setAmount('');
    setEstimatedOutput('');
    setIsMaxAmount(false);
  };

  // Determine swap route based on from/to tokens and migration status
  const getSwapRoute = (from: Token, to: Token): 'direct-cp' | 'direct-dbc' | 'double' | 'triple' | 'invalid' => {
    if (from === to) return 'invalid';

    // Direct CP-AMM swaps
    if ((from === 'SOL' && to === 'ZC') || (from === 'ZC' && to === 'SOL')) return 'direct-cp';

    // Direct DBC swaps
    if ((from === 'ZC' && to === 'TEST') || (from === 'TEST' && to === 'ZC')) return 'direct-dbc';
    if ((from === 'ZC' && to === 'SHIRTLESS') || (from === 'SHIRTLESS' && to === 'ZC')) return 'direct-dbc';
    if ((from === 'SHIRTLESS' && to === 'GITPOST') || (from === 'GITPOST' && to === 'SHIRTLESS')) return 'direct-dbc';
    if ((from === 'ZC' && to === 'PERC') || (from === 'PERC' && to === 'ZC')) return 'direct-dbc';

    // Double swaps (2 hops)
    if (from === 'SOL' && to === 'TEST') return 'double'; // SOL → ZC → TEST
    if (from === 'TEST' && to === 'SOL') return 'double'; // TEST → ZC → SOL
    if (from === 'SOL' && to === 'SHIRTLESS') return 'double'; // SOL → ZC → SHIRTLESS
    if (from === 'SHIRTLESS' && to === 'SOL') return 'double'; // SHIRTLESS → ZC → SOL
    if (from === 'ZC' && to === 'GITPOST') return 'double';
    if (from === 'GITPOST' && to === 'ZC') return 'double';
    if (from === 'SOL' && to === 'PERC') return 'double'; // SOL → ZC → PERC
    if (from === 'PERC' && to === 'SOL') return 'double'; // PERC → ZC → SOL

    // Triple swaps (3 hops)
    if (from === 'TEST' && to === 'SHIRTLESS') return 'triple'; // TEST → ZC → SHIRTLESS
    if (from === 'SHIRTLESS' && to === 'TEST') return 'triple'; // SHIRTLESS → ZC → TEST
    if (from === 'TEST' && to === 'GITPOST') return 'triple'; // TEST → ZC → SHIRTLESS → GITPOST
    if (from === 'GITPOST' && to === 'TEST') return 'triple'; // GITPOST → SHIRTLESS → ZC → TEST
    if (from === 'SOL' && to === 'GITPOST') return 'triple';
    if (from === 'GITPOST' && to === 'SOL') return 'triple';

    return 'invalid';
  };

  const getTokenDecimals = (token: Token): number => {
    if (token === 'SOL') return 9;
    if (token === 'ZC') return 6;
    if (token === 'TEST') return 6;
    if (token === 'SHIRTLESS') return 6;
    if (token === 'GITPOST') return 6;
    if (token === 'PERC') return 6;
    return 6;
  };

  const getTokenMint = (token: Token): PublicKey => {
    if (token === 'SOL') return WSOL;
    if (token === 'ZC') return ZC_MINT;
    if (token === 'TEST') return TEST_MINT;
    if (token === 'SHIRTLESS') return SHIRTLESS_MINT;
    if (token === 'GITPOST') return GITPOST_MINT;
    if (token === 'PERC') return PERC_MINT;
    return TEST_MINT;
  };

  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) {
      setEstimatedOutput('');
      setPriceImpact('');
      return;
    }

    const route = getSwapRoute(fromToken, toToken);
    if (route === 'invalid') {
      setEstimatedOutput('');
      setPriceImpact('');
      return;
    }

    const calculateQuote = async () => {
      setIsCalculating(true);
      try {
        const connection = new Connection(RPC_URL, 'confirmed');

        const quoteResult = await getQuote(
          connection,
          fromToken,
          toToken,
          amount,
          parseFloat(slippage)
        );

        if (quoteResult) {
          setEstimatedOutput(quoteResult.outputAmount);
          if (quoteResult.priceImpact) {
            setPriceImpact(quoteResult.priceImpact);
          }
          setLastQuoteTime(Date.now());
        }
      } catch (error) {
        console.error('Error calculating quote:', error);
        setEstimatedOutput('Error');
      } finally {
        setIsCalculating(false);
      }
    };

    const debounce = setTimeout(calculateQuote, 500);
    return () => clearTimeout(debounce);
  }, [amount, fromToken, toToken, slippage, refreshTrigger]);

  // Auto-refresh quotes every 10 seconds and update countdown
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || !estimatedOutput || estimatedOutput === 'Error') {
      setQuoteRefreshCountdown(10);
      return;
    }

    // Update countdown every second
    const countdownInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastQuoteTime) / 1000);
      const remaining = Math.max(0, 10 - elapsed);
      setQuoteRefreshCountdown(remaining);
    }, 1000);

    // Trigger refresh every 10 seconds
    const refreshInterval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 10000);

    return () => {
      clearInterval(countdownInterval);
      clearInterval(refreshInterval);
    };
  }, [amount, estimatedOutput, lastQuoteTime]);

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

  const handleSwap = async () => {
    const walletProvider = (window as WindowWithWallets).solana || (window as WindowWithWallets).solflare;
    if (!wallet || !isPrivyAuthenticated || !walletProvider) {
      showToast('error', 'Please connect your wallet');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      showToast('error', 'Please enter an amount');
      return;
    }

    setIsSwapping(true);
    try {
      const connection = new Connection(RPC_URL, 'confirmed');

      const result = await executeSwap({
        connection,
        wallet,
        fromToken,
        toToken,
        amount,
        slippage: parseFloat(slippage),
        isMaxAmount,
        walletProvider
      });

      showToast('success', 'Swap successful!');

      // Reset form
      setAmount('');
      setEstimatedOutput('');
      setIsMaxAmount(false);

      // Refresh balances after 10 seconds
      setRefreshingBalancesAfterSwap(true);
      setTimeout(async () => {
        await fetchBalances();
        setRefreshingBalancesAfterSwap(false);
      }, 10000);
    } catch (error: any) {
      console.error('Swap error:', error);
      showToast('error', error?.message || 'Swap failed');
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000]">
      <Navigation />
      <main className="px-0 sm:px-4 relative">
        <div className="bg-[#141414] min-h-screen text-[#F7FCFE] rounded-none sm:rounded-4xl">
          <div className="max-w-xl mx-auto pt-24 px-4 sm:px-8 pb-16">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold">𝓩 Swap</h1>
            </div>

            {/* Wallet Info */}
            {isPrivyAuthenticated && wallet && (
              <div className="bg-[#1E1E1E] rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-300">Connected Wallet</span>
                    <button
                      onClick={copyWalletAddress}
                      className="flex items-center gap-1 text-xs font-mono text-gray-400 hover:text-white transition-colors cursor-pointer"
                      title="Copy wallet address"
                    >
                      <span>{wallet.toBase58().slice(0, 4)}...{wallet.toBase58().slice(-4)}</span>
                      {copiedWallet ? (
                        <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                    {refreshingBalancesAfterSwap && (
                      <svg className="animate-spin h-3 w-3 text-[#F7FCFE]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                  </div>
                  {isLoadingBalances && (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-[#F7FCFE]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-xs text-gray-300">Refreshing...</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(['SOL', 'ZC', 'SHIRTLESS', 'GITPOST', 'PERC'] as Token[]).map((token) => (
                    <div key={token} className="bg-[#2B2B2A] rounded-lg p-3 flex items-center gap-3">
                      {getTokenIcon(token).startsWith('/') ? (
                        <img src={getTokenIcon(token)} alt={token} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">{getTokenIcon(token)}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">
                          {(() => {
                            const balance = parseFloat(balances[token]);
                            if (balance >= 1000000000) return (balance / 1000000000).toFixed(2).replace(/\.?0+$/, '') + 'B';
                            if (balance >= 1000000) return (balance / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
                            if (balance >= 1000) return (balance / 1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
                            // Show up to 4 decimal places without trailing zeros
                            return parseFloat(balance.toFixed(4)).toString();
                          })()}
                        </div>
                        <div className="text-xs text-gray-400">{getTokenSymbol(token)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Swap Container */}
            <div className="bg-[#1E1E1E] rounded-2xl p-4">
              {/* From Token */}
              <div className="bg-[#2B2B2A] rounded-xl p-4 mb-2">
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-300">You pay</label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-300">Balance:</span>
                    {getTokenIcon(fromToken).startsWith('/') ? (
                      <img src={getTokenIcon(fromToken)} alt={fromToken} className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">{getTokenIcon(fromToken)}</span>
                      </div>
                    )}
                    <span className="text-sm text-gray-300">{formatBalance(balances[fromToken])}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 relative">
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setIsMaxAmount(false);
                      }}
                      placeholder="0.0"
                      className="w-full bg-transparent text-3xl font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-16"
                      step="any"
                    />
                    <button
                      onClick={() => {
                        setAmount(balances[fromToken]);
                        setIsMaxAmount(true);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#F7FCFE] bg-[#1E1E1E] hover:bg-[#141414] px-2 py-1 rounded transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowFromSelector(!showFromSelector);
                        setShowToSelector(false);
                      }}
                      className="flex items-center gap-2 bg-[#1E1E1E] rounded-xl px-4 py-2 hover:bg-[#141414] transition-colors"
                    >
                      {getTokenIcon(fromToken).startsWith('/') ? (
                        <img src={getTokenIcon(fromToken)} alt={fromToken} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">{getTokenIcon(fromToken)}</span>
                        </div>
                      )}
                      <span className="font-semibold">{getTokenSymbol(fromToken)}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showFromSelector && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-full mt-2 left-0 bg-[#1E1E1E] border border-gray-700 rounded-xl overflow-hidden shadow-xl z-50 min-w-[160px]"
                      >
                        {(['SOL', 'ZC', 'SHIRTLESS', 'GITPOST', 'PERC'] as Token[]).filter(t => t !== fromToken && t !== toToken).map((token) => (
                          <button
                            key={token}
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('FROM dropdown clicked:', token);
                              setFromToken(token);
                              setShowFromSelector(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2B2B2A] transition-colors"
                          >
                            {getTokenIcon(token).startsWith('/') ? (
                              <img src={getTokenIcon(token)} alt={token} className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                                <span className="text-xs font-bold text-white">{getTokenIcon(token)}</span>
                              </div>
                            )}
                            <span className="font-semibold">{getTokenSymbol(token)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Switch Button */}
              <div className="flex justify-center -my-3 relative z-[5]">
                <button
                  onClick={switchTokens}
                  className="bg-[#1E1E1E] border-4 border-[#141414] p-2 rounded-xl hover:bg-[#2B2B2A] transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>

              {/* To Token */}
              <div className="bg-[#2B2B2A] rounded-xl p-4 mb-4">
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-300">You receive</label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-300">Balance:</span>
                    {getTokenIcon(toToken).startsWith('/') ? (
                      <img src={getTokenIcon(toToken)} alt={toToken} className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">{getTokenIcon(toToken)}</span>
                      </div>
                    )}
                    <span className="text-sm text-gray-300">{formatBalance(balances[toToken])}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 relative">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={isCalculating ? '...' : estimatedOutput}
                      readOnly
                      placeholder="0.0"
                      className="w-full bg-transparent text-3xl font-semibold focus:outline-none pr-16"
                    />
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowToSelector(!showToSelector);
                        setShowFromSelector(false);
                      }}
                      className="flex items-center gap-2 bg-[#1E1E1E] rounded-xl px-4 py-2 hover:bg-[#141414] transition-colors"
                    >
                      {getTokenIcon(toToken).startsWith('/') ? (
                        <img src={getTokenIcon(toToken)} alt={toToken} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">{getTokenIcon(toToken)}</span>
                        </div>
                      )}
                      <span className="font-semibold">{getTokenSymbol(toToken)}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showToSelector && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-full mt-2 left-0 bg-[#1E1E1E] border border-gray-700 rounded-xl overflow-hidden shadow-xl z-10 min-w-[160px]"
                      >
                        {(['SOL', 'ZC', 'SHIRTLESS', 'GITPOST', 'PERC'] as Token[]).filter(t => t !== fromToken && t !== toToken).map((token) => (
                          <button
                            key={token}
                            onClick={(e) => {
                              e.stopPropagation();
                              setToToken(token);
                              setShowToSelector(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2B2B2A] transition-colors"
                          >
                            {getTokenIcon(token).startsWith('/') ? (
                              <img src={getTokenIcon(token)} alt={token} className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                                <span className="text-xs font-bold text-white">{getTokenIcon(token)}</span>
                              </div>
                            )}
                            <span className="font-semibold">{getTokenSymbol(token)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Swap Info */}
              {estimatedOutput && estimatedOutput !== 'Error' && (
                <div className="bg-[#2B2B2A] rounded-xl p-4 mb-4 text-sm space-y-2">
                  <div className="flex justify-between items-center text-gray-300">
                    <span>Rate</span>
                    <div className="flex items-center gap-2">
                      <span>1 {getTokenSymbol(fromToken)} = {(parseFloat(estimatedOutput) / parseFloat(amount || '1')).toFixed(6)} {getTokenSymbol(toToken)}</span>
                      {quoteRefreshCountdown > 0 && (
                        <span className="text-xs text-gray-400">({quoteRefreshCountdown}s)</span>
                      )}
                    </div>
                  </div>
                  {priceImpact && (
                    <div className="flex justify-between text-gray-300">
                      <span>Price impact</span>
                      <span className={parseFloat(priceImpact) >= 10 ? 'text-red-400' : parseFloat(priceImpact) >= 5 ? 'text-yellow-400' : 'text-green-400'}>
                        {parseFloat(priceImpact).toFixed(2)}%
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-300">
                    <span>Route</span>
                    <span className="flex items-center gap-1 text-right">
                      {getSwapRoute(fromToken, toToken) === 'direct-cp' && (
                        <>
                          {getTokenIcon(fromToken).startsWith('/') ? (
                            <img src={getTokenIcon(fromToken)} alt={fromToken} className="w-4 h-4 rounded-full object-cover" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-white">{getTokenIcon(fromToken)}</span>
                            </div>
                          )}
                          <span>→</span>
                          {getTokenIcon(toToken).startsWith('/') ? (
                            <img src={getTokenIcon(toToken)} alt={toToken} className="w-4 h-4 rounded-full object-cover" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-white">{getTokenIcon(toToken)}</span>
                            </div>
                          )}
                        </>
                      )}
                      {getSwapRoute(fromToken, toToken) === 'direct-dbc' && (
                        <>
                          {getTokenIcon(fromToken).startsWith('/') ? (
                            <img src={getTokenIcon(fromToken)} alt={fromToken} className="w-4 h-4 rounded-full object-cover" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-white">{getTokenIcon(fromToken)}</span>
                            </div>
                          )}
                          <span>→</span>
                          {getTokenIcon(toToken).startsWith('/') ? (
                            <img src={getTokenIcon(toToken)} alt={toToken} className="w-4 h-4 rounded-full object-cover" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-white">{getTokenIcon(toToken)}</span>
                            </div>
                          )}
                        </>
                      )}
                      {getSwapRoute(fromToken, toToken) === 'double' && (() => {
                        // Determine middle token for double swaps
                        // ZC ↔ GITPOST routes through SHIRTLESS
                        // SOL ↔ SHIRTLESS routes through ZC
                        // All other double swaps route through ZC or SOL
                        let middleToken: Token;
                        if ((fromToken === 'ZC' && toToken === 'GITPOST') || (fromToken === 'GITPOST' && toToken === 'ZC')) {
                          middleToken = 'SHIRTLESS';
                        } else if ((fromToken === 'SOL' && toToken === 'SHIRTLESS') || (fromToken === 'SHIRTLESS' && toToken === 'SOL')) {
                          middleToken = 'ZC';
                        } else {
                          middleToken = 'ZC';
                        }

                        return (
                          <>
                            {getTokenIcon(fromToken).startsWith('/') ? (
                              <img src={getTokenIcon(fromToken)} alt={fromToken} className="w-4 h-4 rounded-full object-cover" />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-white">{getTokenIcon(fromToken)}</span>
                              </div>
                            )}
                            <span>→</span>
                            {getTokenIcon(middleToken).startsWith('/') ? (
                              <img src={getTokenIcon(middleToken)} alt={middleToken} className="w-4 h-4 rounded-full object-cover" />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-white">{getTokenIcon(middleToken)}</span>
                              </div>
                            )}
                            <span>→</span>
                            {getTokenIcon(toToken).startsWith('/') ? (
                              <img src={getTokenIcon(toToken)} alt={toToken} className="w-4 h-4 rounded-full object-cover" />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-white">{getTokenIcon(toToken)}</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {getSwapRoute(fromToken, toToken) === 'triple' && (
                        <>
                          {getTokenIcon(fromToken).startsWith('/') ? (
                            <img src={getTokenIcon(fromToken)} alt={fromToken} className="w-4 h-4 rounded-full object-cover" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-white">{getTokenIcon(fromToken)}</span>
                            </div>
                          )}
                          <span>→</span>
                          {getTokenIcon('ZC').startsWith('/') ? (
                            <img src={getTokenIcon('ZC')} alt="ZC" className="w-4 h-4 rounded-full object-cover" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-white">{getTokenIcon('ZC')}</span>
                            </div>
                          )}
                          <span>→</span>
                          {getTokenIcon('SHIRTLESS').startsWith('/') ? (
                            <img src={getTokenIcon('SHIRTLESS')} alt="SHIRTLESS" className="w-4 h-4 rounded-full object-cover" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-white">{getTokenIcon('SHIRTLESS')}</span>
                            </div>
                          )}
                          <span>→</span>
                          {getTokenIcon(toToken).startsWith('/') ? (
                            <img src={getTokenIcon(toToken)} alt={toToken} className="w-4 h-4 rounded-full object-cover" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-white">{getTokenIcon(toToken)}</span>
                            </div>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Swap Button */}
              <button
                onClick={!wallet ? handleConnectWallet : handleSwap}
                disabled={
                  !!wallet &&
                  (isSwapping ||
                   !amount ||
                   parseFloat(amount) <= 0 ||
                   estimatedOutput === 'Error' ||
                   parseFloat(amount) > parseFloat(balances[fromToken]))
                }
                className={`w-full font-bold py-4 rounded-xl transition-opacity disabled:cursor-not-allowed ${
                  !wallet || (wallet && amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(balances[fromToken]) && estimatedOutput !== 'Error')
                    ? 'bg-[#F7FCFE] text-black hover:opacity-90'
                    : 'bg-gray-600 text-gray-300 opacity-50'
                }`}
              >
                {!wallet
                  ? 'Connect Wallet'
                  : isSwapping
                  ? 'Swapping...'
                  : wallet && amount && parseFloat(amount) > parseFloat(balances[fromToken])
                  ? 'Insufficient Balance'
                  : 'Swap'}
              </button>
            </div>

            {/* Info Text */}
            <p className="text-sm text-gray-300 text-center mt-6">
              {getSwapRoute(fromToken, toToken) === 'direct-cp' && 'Direct swap via CP-AMM pool. '}
              {getSwapRoute(fromToken, toToken) === 'direct-dbc' && 'Direct swap via DBC pool. '}
              {getSwapRoute(fromToken, toToken) === 'double' && 'Multi-hop swap (2 hops). Executes in 1 transaction. '}
              {getSwapRoute(fromToken, toToken) === 'triple' && 'Multi-hop swap (3 hops). Executes in 1 transaction. '}
              Balances refresh 10 seconds after swap. Gas fees apply.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
