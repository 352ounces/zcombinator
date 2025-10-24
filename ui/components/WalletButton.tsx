'use client';

import { useWallet } from './WalletProvider';
import { usePrivy } from '@privy-io/react-auth';
import { useState } from 'react';

interface WalletButtonProps {
  onLaunch?: () => void;
  disabled?: boolean;
  isLaunching?: boolean;
  isGeneratingCA?: boolean;
  isPresale?: boolean;
}

export const WalletButton = ({ onLaunch, disabled = false, isLaunching = false, isGeneratingCA = false, isPresale = false }: WalletButtonProps) => {
  const { connecting, externalWallet } = useWallet();
  const { login, authenticated, linkWallet } = usePrivy();
  const [error, setError] = useState<string | null>(null);

  const handleButtonClick = async () => {
    // Only allow launch if there's an external wallet connected
    if (externalWallet && onLaunch) {
      onLaunch();
      return;
    }

    try {
      setError(null);

      // First check if user is authenticated, if not, login first
      if (!authenticated) {
        // Login with wallet directly
        await login();
      } else {
        // If already authenticated, link additional wallet
        await linkWallet();
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError('Failed to connect wallet. Please try again.');
    }
  };

  // Show loading state while connecting
  if (connecting) {
    return (
      <button
        disabled
        className="text-xl text-gray-300 opacity-50 cursor-not-allowed"
      >
        Connecting...
      </button>
    );
  }

  // Show error if there is one
  if (error) {
    return (
      <div className="space-y-2">
        <div className="text-red-400 text-sm">{error}</div>
        <button
          onClick={() => setError(null)}
          className="text-xl text-gray-300 hover:text-white transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }


  return (
    <button
      onClick={handleButtonClick}
      disabled={connecting || disabled}
      className={`text-xl font-bold transition-colors cursor-pointer disabled:opacity-50 ${
        externalWallet || isLaunching || isGeneratingCA ? 'text-[#b2e9fe] hover:text-[#d0f2ff]' : 'text-gray-300 hover:text-white'
      }`}
    >
      {isGeneratingCA
        ? 'Generating CA...'
        : isLaunching
        ? 'Launching...'
        : externalWallet
        ? isPresale ? 'LAUNCH PRESALE' : 'LAUNCH'
        : 'CONNECT WALLET'}
    </button>
  );
};