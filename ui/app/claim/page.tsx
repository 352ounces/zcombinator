'use client';

import { Navigation } from '@/components/Navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useWallet } from '@/components/WalletProvider';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClaimPage() {
  const { login, ready, authenticated } = usePrivy();
  const { isPrivyAuthenticated } = useWallet();
  const router = useRouter();

  // Redirect if already authenticated
  useEffect(() => {
    if (isPrivyAuthenticated && authenticated) {
      router.push('/manage');
    }
  }, [isPrivyAuthenticated, authenticated, router]);

  const handleSocialLogin = (provider: 'twitter' | 'github') => {
    login({
      loginMethods: [provider]
      // Embedded Solana wallet is created automatically for social logins
    });
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#000000]">
        <main className="px-0 sm:px-4 relative">
          <div className="bg-[#141414] min-h-screen text-[#F7FCFE] rounded-none sm:rounded-4xl relative">
            <div className="max-w-7xl mx-auto px-8 py-12 sm:px-12 sm:py-16">
              <h1 className="text-5xl font-bold mb-12">𝓩 Claim</h1>
              <p className="text-xl text-gray-300">Loading...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000]">
      <main className="px-0 sm:px-4 relative">
        <div className="bg-[#141414] min-h-screen text-[#F7FCFE] rounded-none sm:rounded-4xl relative">
          <div className="max-w-7xl mx-auto px-8 py-12 sm:px-12 sm:py-16">
            <h1 className="text-5xl font-bold mb-12">𝓩 Claim</h1>

            <div className="max-w-2xl space-y-8">
              <p className="text-xl text-gray-300 mb-8">
                Claim your Z Combinator rewards by connecting your X or GitHub account.
                This will create an embedded wallet for you to receive tokens. NOTE: If you launched a token, manage your token on the Portfolio page. Only use this page if you were designated a token from someone else.
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => handleSocialLogin('twitter')}
                  className="w-full py-4 px-6 border border-gray-800 hover:border-white text-xl text-gray-300 hover:text-white transition-colors cursor-pointer text-left"
                >
                  Connect with X (Twitter)
                </button>

                <button
                  onClick={() => handleSocialLogin('github')}
                  className="w-full py-4 px-6 border border-gray-800 hover:border-white text-xl text-gray-300 hover:text-white transition-colors cursor-pointer text-left"
                >
                  Connect with GitHub
                </button>
              </div>

              <div className="mt-12 pt-8 border-t border-gray-800">
                <p className="text-sm text-gray-300-temp">
                  By connecting, you&apos;ll create an embedded wallet that you can export later.
                  No external wallet connection is required.
                </p>
              </div>

              <Navigation />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}