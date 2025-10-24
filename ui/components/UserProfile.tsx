'use client';

import { useWallet } from './WalletProvider';
import { usePrivy } from '@privy-io/react-auth';
import { useExportWallet } from '@privy-io/react-auth/solana';
import { useState } from 'react';

export function UserProfile() {
  const {
    isPrivyAuthenticated,
    privyUser,
    hasTwitter,
    hasGithub,
    twitterUsername,
    githubUsername,
    embeddedWallet,
    externalWallet
  } = useWallet();

  const { linkTwitter, linkGithub, unlinkTwitter, unlinkGithub, logout, linkWallet } = usePrivy();
  const { exportWallet } = useExportWallet();
  const [isLinking, setIsLinking] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isPrivyAuthenticated || !privyUser) {
    return null;
  }

  const handleLinkTwitter = async () => {
    try {
      setIsLinking(true);
      await linkTwitter();
    } catch (error) {
      console.error('Failed to link Twitter:', error);
    } finally {
      setIsLinking(false);
    }
  };

  const handleLinkGithub = async () => {
    try {
      setIsLinking(true);
      await linkGithub();
    } catch (error) {
      console.error('Failed to link GitHub:', error);
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkTwitter = async () => {
    try {
      setIsLinking(true);
      const twitterAccount = (privyUser as { linkedAccounts?: Array<{ type: string; address: string }> })?.linkedAccounts?.find(
        (account) => account.type === 'twitter_oauth'
      );
      if (twitterAccount) {
        await unlinkTwitter(twitterAccount.address);
      }
    } catch (error) {
      console.error('Failed to unlink Twitter:', error);
    } finally {
      setIsLinking(false);
    }
  };

  const handleCopyWallet = async (walletAddress: string) => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy wallet address:', error);
    }
  };

  const handleConnectWallet = async () => {
    try {
      setIsLinking(true);
      await linkWallet();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsLinking(false);
    }
  };

  const handleExportPrivateKey = async () => {
    try {
      await exportWallet();
    } catch (error) {
      console.error('Failed to export wallet:', error);
    }
  };

  const handleUnlinkGithub = async () => {
    try {
      setIsLinking(true);
      const githubAccount = (privyUser as { linkedAccounts?: Array<{ type: string; address: string }> })?.linkedAccounts?.find(
        (account) => account.type === 'github_oauth'
      );
      if (githubAccount) {
        await unlinkGithub(githubAccount.address);
      }
    } catch (error) {
      console.error('Failed to unlink GitHub:', error);
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Connected Wallet */}
      <div className="flex justify-between items-center">
        <p className="text-xl text-gray-300">
          Connected Wallet: {externalWallet ? (
            <button
              onClick={() => handleCopyWallet(externalWallet.toString())}
              className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
              title="Copy wallet address"
            >
              <span className="text-xl text-white font-mono">
                {externalWallet.toString().slice(0, 6)}...{externalWallet.toString().slice(-6)}
              </span>
              {copied ? (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          ) : (
            <span className="text-gray-300-temp">Not connected</span>
          )}
        </p>
        {!externalWallet && (
          <button
            onClick={handleConnectWallet}
            disabled={isLinking}
            className="text-xl font-bold text-gray-300 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            CONNECT
          </button>
        )}
      </div>

      {/* Embedded Wallet */}
      <div className="flex justify-between items-center">
        <p className="text-xl text-gray-300">
          Embedded Wallet: {embeddedWallet ? (
            <button
              onClick={() => handleCopyWallet(embeddedWallet.toString())}
              className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
              title="Copy wallet address"
            >
              <span className="text-xl text-white font-mono">
                {embeddedWallet.toString().slice(0, 6)}...{embeddedWallet.toString().slice(-6)}
              </span>
              {copied ? (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          ) : (
            <span className="text-gray-300-temp">Not available</span>
          )}
        </p>
        {embeddedWallet && (
          <button
            onClick={handleExportPrivateKey}
            className="text-xl font-bold text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            EXPORT PK
          </button>
        )}
      </div>

      {/* Twitter */}
      <div className="flex justify-between items-center">
        <p className="text-xl text-gray-300">
          X: {hasTwitter ? (
            <span className="text-white">@{twitterUsername}</span>
          ) : (
            <span className="text-gray-300-temp">Not connected</span>
          )}
        </p>
        {hasTwitter ? (
          <button
            onClick={handleUnlinkTwitter}
            disabled={isLinking}
            className="text-xl font-bold text-gray-300 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            DISCONNECT
          </button>
        ) : (
          <button
            onClick={handleLinkTwitter}
            disabled={isLinking}
            className="text-xl font-bold text-gray-300 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            CONNECT
          </button>
        )}
      </div>

      {/* GitHub */}
      <div className="flex justify-between items-center">
        <p className="text-xl text-gray-300">
          GitHub: {hasGithub ? (
            <span className="text-white">@{githubUsername}</span>
          ) : (
            <span className="text-gray-300-temp">Not connected</span>
          )}
        </p>
        {hasGithub ? (
          <button
            onClick={handleUnlinkGithub}
            disabled={isLinking}
            className="text-xl font-bold text-gray-300 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            DISCONNECT
          </button>
        ) : (
          <button
            onClick={handleLinkGithub}
            disabled={isLinking}
            className="text-xl font-bold text-gray-300 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            CONNECT
          </button>
        )}
      </div>

      {/* Logout */}
      <div>
        <button
          onClick={logout}
          className="text-xl font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
        >
          LOGOUT
        </button>
      </div>
    </div>
  );
}