'use client';

import { useWallet } from '@/components/WalletProvider';
import { UserProfile } from '@/components/UserProfile';
import { Navigation } from '@/components/Navigation';

export default function VerifyPage() {
  const { isPrivyAuthenticated } = useWallet();

  // Redirect if no wallet connected
  if (!isPrivyAuthenticated) {
    return (
      <div className="min-h-screen bg-[#000000]">
        <main className="px-0 sm:px-4 relative">
          <div className="bg-[#141414] min-h-screen text-[#F7FCFE] rounded-none sm:rounded-4xl relative">
            <div className="max-w-7xl mx-auto px-8 py-12 sm:px-12 sm:py-16">
              <h1 className="text-5xl font-bold mb-12">Verify Account</h1>
              <p className="text-xl text-gray-300 mb-8">
                Connect your wallet and socials to manage your account and claim tokens.
              </p>
              <Navigation />
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
            <h1 className="text-5xl font-bold mb-12">𝓩 Account</h1>

            <div className="space-y-6 mb-12">
              <p className="text-xl text-gray-300">
                Connect your wallet and socials to launch and claim tokens. Verified accounts get increased rewards from all Z Combinator devs and projects.
              </p>
            </div>

            {/* User Profile Component */}
            <UserProfile />

            <Navigation />
          </div>
        </div>
      </main>
    </div>
  );
}