'use client';

import { useState } from 'react';
import { useWallet } from './WalletProvider';
import { usePrivy } from '@privy-io/react-auth';
import { Transaction } from '@solana/web3.js';
import { InfoTooltip } from '@/components/InfoTooltip';
import bs58 from 'bs58';

interface VestingModalProps {
  tokenSymbol: string;
  tokenAddress: string;
  vestingInfo: VestingInfo | null;
  onClaimSuccess: () => void;
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

export function VestingModal({
  tokenSymbol,
  tokenAddress,
  vestingInfo,
  onClaimSuccess
}: VestingModalProps) {
  const { wallet, activeWallet } = useWallet();
  const { authenticated, login, linkWallet } = usePrivy();
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Format token amount with 6 decimals and K/M abbreviations
  const formatTokenAmount = (amount: string, decimals = 6): string => {
    if (!amount || amount === '0') return '0';
    const divisor = Math.pow(10, decimals);
    const value = parseFloat(amount) / divisor;

    // Format with K for thousands, M for millions
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }

    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    });
  };

  const handleConnectWallet = async () => {
    try {
      if (!authenticated) {
        await login();
      } else {
        await linkWallet();
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err);
    }
  };

  const handleClaim = async () => {
    if (!wallet || !activeWallet || !vestingInfo) {
      return;
    }

    setIsClaiming(true);
    setClaimError(null);
    setClaimSuccess(false);

    try {
      // Step 1: Prepare the claim transaction
      const prepareResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/presale/${tokenAddress}/claims/prepare`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userWallet: wallet.toBase58() })
        }
      );

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        throw new Error(errorData.error || 'Failed to prepare claim');
      }

      const { transaction: serializedTx, timestamp } = await prepareResponse.json();

      // Step 2: Sign the transaction WITHOUT modifying blockhash
      const txBuffer = bs58.decode(serializedTx);
      const transaction = Transaction.from(txBuffer);

      // Set fee payer (this doesn't affect signatures)
      transaction.feePayer = wallet;

      // Serialize transaction for Privy signing
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      // Sign transaction using Privy wallet
      const signedResult = await activeWallet.signTransaction({
        transaction: serializedTransaction,
      });

      // Get the signed transaction bytes (already a Uint8Array)
      const signedTransaction = signedResult.signedTransaction;

      // Step 3: Confirm the claim
      const confirmResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/presale/${tokenAddress}/claims/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signedTransaction: bs58.encode(signedTransaction),
            timestamp
          })
        }
      );

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json();
        throw new Error(errorData.error || 'Failed to confirm claim');
      }

      const { signature } = await confirmResponse.json();
      console.log('Claim successful! Signature:', signature);

      setClaimSuccess(true);
      onClaimSuccess();

      // Clear success message after 3 seconds
      setTimeout(() => setClaimSuccess(false), 3000);

    } catch (error) {
      console.error('Claim error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to claim tokens';
      setClaimError(errorMessage);
    } finally {
      setIsClaiming(false);
    }
  };

  if (!vestingInfo) {
    return (
      <div className="space-y-8">
        <div className="border-b border-gray-800 pb-6">
          <h2 className="text-2xl font-bold mb-4">Vesting</h2>
          {!wallet ? (
            <p className="text-gray-300 text-lg">Connect your wallet to view vesting information</p>
          ) : (
            <p className="text-gray-300 text-lg">No vesting allocation found for your wallet</p>
          )}
        </div>

        {!wallet && (
          <button
            onClick={handleConnectWallet}
            className="w-full py-3 text-xl font-bold bg-white text-black hover:bg-gray-200 transition-colors"
          >
            Connect Wallet
          </button>
        )}
      </div>
    );
  }

  const remainingTokens = parseFloat(vestingInfo.totalAllocated) - parseFloat(vestingInfo.totalClaimed);
  const hasTokensToClaimNow = parseFloat(vestingInfo.claimableAmount) > 0;
  const hoursRemaining = Math.floor((100 - vestingInfo.vestingProgress) * 3.36);

  // Check if we're in a cooldown period
  const isInCooldown = vestingInfo.nextUnlockTime && new Date(vestingInfo.nextUnlockTime) > new Date();
  const canClaimNow = hasTokensToClaimNow && !isInCooldown;

  // Calculate time until next unlock for display
  const getTimeUntilUnlock = () => {
    if (!vestingInfo.nextUnlockTime || !isInCooldown) return null;
    const timeUntil = new Date(vestingInfo.nextUnlockTime).getTime() - Date.now();
    const minutes = Math.ceil(timeUntil / 60000);
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    const hours = Math.ceil(minutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  };

  const timeUntilUnlock = getTimeUntilUnlock();

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h2 className="text-2xl font-bold mb-4">Vesting</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-300 text-lg">
            <span>Your allocation: <span className="text-white font-bold">{formatTokenAmount(vestingInfo.totalAllocated)} {tokenSymbol}</span></span>
            <InfoTooltip text="Total tokens allocated to you from the presale, vesting linearly over 2 weeks" />
          </div>
          <div className="text-gray-300 text-lg">
            Already claimed: <span className="text-white font-bold">{formatTokenAmount(vestingInfo.totalClaimed)} {tokenSymbol}</span>
          </div>
          <div className="text-gray-300 text-lg">
            Vesting progress: <span className="text-white font-bold">{vestingInfo.vestingProgress.toFixed(1)}%</span>
            {vestingInfo.isFullyVested ? (
              <span className="text-green-400 ml-2">✓ Fully Vested</span>
            ) : (
              <span className="text-gray-400 ml-2">({hoursRemaining} hours left)</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-lg text-gray-300">
            Available to Claim
            {isInCooldown && <span className="text-yellow-400 text-sm ml-2">(Cooldown active)</span>}
          </label>
          <div className="relative">
            <div className="w-full py-3 border-b border-gray-800 text-xl">
              <span className={`${canClaimNow ? 'text-white' : 'text-gray-500'}`}>
                {formatTokenAmount(vestingInfo.claimableAmount)}
              </span>
              <span className="text-gray-300 ml-2">{tokenSymbol}</span>
            </div>
          </div>
          <div className="h-5">
            {claimError && (
              <p className="text-sm text-red-400">
                {claimError}
              </p>
            )}
            {claimSuccess && (
              <p className="text-sm text-green-400">
                Tokens claimed successfully! ✓
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center text-gray-300">
            <span>Remaining to vest:</span>
            <span className="font-mono">{formatTokenAmount(remainingTokens.toString())} {tokenSymbol}</span>
          </div>
          {!vestingInfo.isFullyVested && vestingInfo.nextUnlockTime && (
            <div className={`flex justify-between items-center ${isInCooldown ? 'text-yellow-400' : 'text-gray-300'}`}>
              <span>Next unlock:</span>
              <span className="font-mono">
                {isInCooldown ? (
                  <>In {timeUntilUnlock} ({new Date(vestingInfo.nextUnlockTime).toLocaleTimeString()})</>
                ) : (
                  new Date(vestingInfo.nextUnlockTime).toLocaleTimeString()
                )}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={handleClaim}
          disabled={isClaiming || !canClaimNow}
          className="w-full py-3 text-xl font-bold bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isClaiming ? 'Processing...' :
           isInCooldown ? `Claim available in ${timeUntilUnlock}` :
           hasTokensToClaimNow ? `Claim ${formatTokenAmount(vestingInfo.claimableAmount)} ${tokenSymbol}` :
           'No Tokens Available'}
        </button>
      </div>
    </div>
  );
}