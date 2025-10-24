'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSignMessage, useWallets } from '@privy-io/react-auth/solana';

interface SecureVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SecureVerificationModal({
  isOpen,
  onClose,
  onSuccess
}: SecureVerificationModalProps) {
  const { signMessage } = useSignMessage();
  const { getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'request' | 'sign' | 'verify' | 'success'>('request');
  const [challengeData, setChallengeData] = useState<{ nonce: string; message: string; expiresAt: string } | null>(null);

  // Get the first connected wallet
  const wallet = wallets[0];

  if (!isOpen) return null;

  const handleRequestChallenge = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get Privy access token
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Failed to get authentication token');
      }

      // Request verification challenge
      const response = await fetch('/api/verify-designated/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to request challenge');
      }

      const data = await response.json();
      setChallengeData(data.challenge);
      setStep('sign');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSignAndVerify = async () => {
    if (!signMessage || !challengeData || !wallet) {
      setError('Please connect a wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Convert message string to Uint8Array for signing
      const messageBytes = new TextEncoder().encode(challengeData.message);

      // Sign the challenge message with Privy
      const { signature } = await signMessage({
        message: messageBytes,
        wallet: wallet,
      });

      // Signature is a Uint8Array, convert directly to base64
      const signatureBase64 = Buffer.from(signature).toString('base64');

      setStep('verify');

      // Get Privy access token
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Failed to get authentication token');
      }

      // Submit verification
      const response = await fetch('/api/verify-designated/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          challengeNonce: challengeData.nonce,
          signature: signatureBase64
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Verification failed');
      }

      const data = await response.json();

      if (data.tokensVerified && data.tokensVerified.length > 0) {
        setStep('success');
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 2000);
      } else {
        setError('No designated tokens found for your social profiles');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4 text-white">
          Secure Wallet Verification
        </h2>

        {step === 'request' && (
          <div>
            <p className="text-gray-300 mb-4">
              To claim designated tokens, you need to verify ownership of your wallet
              and linked social accounts.
            </p>

            <div className="bg-yellow-900/20 border border-yellow-600 rounded p-3 mb-4">
              <p className="text-sm text-yellow-300">
                This process will:
              </p>
              <ul className="text-sm text-yellow-300 mt-2 list-disc list-inside">
                <li>Verify your Privy authentication</li>
                <li>Request a wallet signature to prove ownership</li>
                <li>Link your social accounts to your wallet</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-600 rounded p-3 mb-4">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleRequestChallenge}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Requesting...' : 'Start Verification'}
              </button>
            </div>
          </div>
        )}

        {step === 'sign' && (
          <div>
            <p className="text-gray-300 mb-4">
              Please sign the message in your wallet to verify ownership.
              This will NOT trigger any blockchain transaction or cost gas fees.
            </p>

            <div className="bg-gray-800 rounded p-3 mb-4 max-h-40 overflow-y-auto">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                {challengeData?.message}
              </pre>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-600 rounded p-3 mb-4">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('request')}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                disabled={loading}
              >
                Back
              </button>
              <button
                onClick={handleSignAndVerify}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loading || !signMessage || !wallet}
              >
                {loading ? 'Signing...' : wallet ? 'Sign & Verify' : 'Connect Wallet First'}
              </button>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-300">Verifying your signature...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <h3 className="text-xl font-bold text-white mb-2">Verification Successful!</h3>
            <p className="text-gray-300">Your wallet has been verified for designated token claims.</p>
          </div>
        )}
      </div>
    </div>
  );
}