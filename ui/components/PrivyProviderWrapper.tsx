'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { ReactNode } from 'react';

interface PrivyProviderWrapperProps {
  children: ReactNode;
}

export function PrivyProviderWrapper({ children }: PrivyProviderWrapperProps) {
  // Configure Solana wallet connectors
  const solanaConnectors = toSolanaWalletConnectors({
    // Disable auto-connect to prevent unwanted extension popups on page load
    shouldAutoConnect: false
  });

  // Privy App ID from environment variable
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    console.error('NEXT_PUBLIC_PRIVY_APP_ID is not set');
    return <div>Privy App ID is not configured</div>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // Authentication methods configuration
        loginMethods: [
          'wallet',  // Wallet connections
          'twitter', // Twitter OAuth for verification
          'github'   // GitHub OAuth for verification
        ],

        // Appearance configuration
        appearance: {
          theme: 'dark',
          accentColor: '#000000',
          showWalletLoginFirst: true, // Show wallet login first
          walletChainType: 'solana-only', // Only show Solana wallets
          // Only show Solana wallets - NO Ethereum wallets
          walletList: ['phantom', 'solflare', 'backpack'],
        },

        // External wallet configuration for Solana
        externalWallets: {
          solana: {
            connectors: solanaConnectors
          }
        },

        // Embedded wallet configuration - disabled since we're only using external wallets
        embeddedWallets: {
          showWalletUIs: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}