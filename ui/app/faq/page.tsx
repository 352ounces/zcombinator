'use client';

import { Navigation } from '@/components/Navigation';

export default function FAQ() {

  return (
    <div className="min-h-screen bg-[#000000]">
      <main className="px-0 sm:px-4 relative">
        <div className="bg-[#141414] min-h-screen text-[#F7FCFE] rounded-none sm:rounded-4xl relative">
          <div className="max-w-4xl px-8 py-16 sm:px-12 sm:py-24">
            <h1 className="text-5xl font-bold mb-12">𝓩 FAQ</h1>

            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold text-[#F7FCFE] mb-3">Why are tokens mintable?</h2>
                <p className="text-xl text-gray-300">Developers DO NOT have the ability to mint tokens. The protocol programmatically mints 1M tokens every 24 hours, only claimable by the developer, while the token has no trading fees. Developers cannot mint any more tokens. This ensures the developer only gets paid when market cap goes up, and they have incentive to keep building for the long term.</p>
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-[#F7FCFE] mb-3">How does staking work? What are the rewards for staking?</h2>
                <p className="text-xl text-gray-300">All tokens will have native staking built into their launches. The protocol automatically mints tokens to reward the staking vault. Users in the staking vault lock their tokens to earn a part of these rewards. Currently, ZC and oogway are the only tokens with staking.</p>
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-[#F7FCFE] mb-3">What are fees? What is the utility of the token?</h2>
                <p className="text-xl text-gray-300">For the Z Combinator token and protocol, a small portion of all token mints for all launches on the platform are sent to the Z Combinator treasury. The Z Combinator token represents a stake of this treasury. For other launchpad tokens, fees are based on the individual products themselves and each has their own utility.</p>
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-[#F7FCFE] mb-3">How can devs get involved?</h2>
                <p className="text-xl text-gray-300">Launch ideas, projects, or anything in between. Collect market feedback quickly to iterate into building something people actually want to use!</p>
              </div>
            </div>

            <Navigation />
          </div>
        </div>
      </main>
    </div>
  );
}