'use client';

import { Navigation } from '@/components/Navigation';

export default function DeveloperFAQ() {

  return (
    <div className="min-h-screen bg-[#000000]">
      <main className="px-0 sm:px-4 relative">
        <div className="bg-[#141414] min-h-screen text-[#F7FCFE] rounded-none sm:rounded-4xl relative">
          <div className="max-w-4xl px-8 py-16 sm:px-12 sm:py-24">
            <h1 className="text-5xl font-bold mb-12">𝓩 Developer FAQ</h1>

            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold text-[#F7FCFE] mb-3">Isn&apos;t it weird that I have to dump my tokens to actually bootstrap?</h2>
                <p className="text-xl text-gray-300 mb-4">Any project that relies on trading fees for funding is unsustainable and doomed for failure. With a constant but controlled stream of tokens, founders can fuel growth via incentives for product and attention bootstrapping, leading to much larger gains in the long term.</p>
                <p className="text-xl text-gray-300 mb-4">Once real growth occurs, both users and founders are made rich by contributing to and sharing ownership of a valuable project and its token.</p>
                <p className="text-xl text-gray-300">Short term projects thrive on trading fee models. Long term projects thrive using token emissions to fund operations and incentivize growth, creating true value.</p>
              </div>
            </div>

            <Navigation />
          </div>
        </div>
      </main>
    </div>
  );
}
