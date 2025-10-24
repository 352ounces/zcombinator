'use client';

import { PublicKey } from '@solana/web3.js';

export function DirectPhantomButton({ onConnect }: { onConnect: (publicKey: PublicKey) => void }) {
  const connectPhantom = async () => {
    try {
      // Check if Phantom is installed
      const { solana } = window as { solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: PublicKey }> } };
      
      if (solana?.isPhantom) {
        console.log('Phantom detected!');
        
        // Request connection
        const response = await solana.connect();
        console.log('Connected to Phantom:', response.publicKey.toString());
        
        onConnect(response.publicKey);
      } else {
        alert('Phantom wallet not found! Please install it.');
        window.open('https://phantom.app/', '_blank');
      }
    } catch (error) {
      console.error('Error connecting to Phantom:', error);
    }
  };

  return (
    <button 
      onClick={connectPhantom}
      className="text-xl text-gray-300 hover:text-white transition-colors cursor-pointer"
    >
      Connect Phantom Directly (Debug)
    </button>
  );
}
