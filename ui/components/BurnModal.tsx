'use client';

import { useState } from 'react';
import { useWallet } from '@/components/WalletProvider';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  createBurnInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  getMint
} from '@solana/spl-token';
import { useSignTransaction } from '@privy-io/react-auth/solana';
import { showToast } from '@/components/Toast';

interface BurnModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenAddress: string;
  tokenSymbol: string;
  userBalance: string;
  onSuccess?: () => void;
}


export function BurnModal({ isOpen, onClose, tokenAddress, tokenSymbol, userBalance, onSuccess }: BurnModalProps) {
  const { wallet, activeWallet } = useWallet();
  const { signTransaction } = useSignTransaction();
  const [amount, setAmount] = useState('');
  const [isBurning, setIsBurning] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string }>({});
  const [burnProgress, setBurnProgress] = useState<string>('');

  // Helper function to safely parse user balance
  const parseUserBalance = (balance: string): number => {
    if (balance === '--') return 0;
    const parsed = parseFloat(balance);
    return isNaN(parsed) ? 0 : parsed;
  };

  const validateInputs = () => {
    const newErrors: { amount?: string } = {};

    // Validate amount
    if (!amount || amount.trim() === '') {
      newErrors.amount = 'Amount is required';
    } else {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        newErrors.amount = 'Amount must be a positive number';
      } else if (numAmount > parseUserBalance(userBalance)) {
        newErrors.amount = 'Amount exceeds available balance';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Live validation on input change
  const handleAmountChange = (value: string) => {
    setAmount(value);
    if (errors.amount) {
      const numAmount = parseFloat(value);
      if (!isNaN(numAmount) && numAmount > 0 && numAmount <= parseUserBalance(userBalance)) {
        setErrors({});
      }
    }
  };

  const handleBurn = async () => {
    if (!validateInputs() || !wallet || !activeWallet) return;

    setIsBurning(true);
    setBurnProgress('Preparing burn transaction...');

    try {
      const { Connection } = await import('@solana/web3.js');
      const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com');

      const ownerPublicKey = wallet;
      const mintPublicKey = new PublicKey(tokenAddress);

      // Get actual token decimals
      const mintInfo = await getMint(connection, mintPublicKey);
      const decimals = mintInfo.decimals;

      // Convert amount to token units using actual decimals
      const amountInTokens = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));

      // Get associated token account
      const tokenAccount = await getAssociatedTokenAddress(mintPublicKey, ownerPublicKey);

      // Create burn instruction
      const burnInstruction = createBurnInstruction(
        tokenAccount,
        mintPublicKey,
        ownerPublicKey,
        amountInTokens,
        [],
        TOKEN_PROGRAM_ID
      );

      // Create transaction
      const transaction = new Transaction();
      transaction.add(burnInstruction);

      // Get recent blockhash and set transaction properties
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = ownerPublicKey;

      // Sign and send transaction with modern approach
      setBurnProgress('Please approve transaction in your wallet...');
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      });

      const { signedTransaction: signedTxBytes } = await signTransaction({
        transaction: serializedTransaction,
        wallet: activeWallet!
      });

      const signedTransaction = Transaction.from(signedTxBytes);
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        }
      );

      setBurnProgress('Confirming burn transaction...');

      // Simple confirmation polling like other parts of the app
      let confirmed = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      while (!confirmed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        attempts++;

        try {
          const status = await connection.getSignatureStatus(signature, {
            searchTransactionHistory: false
          });

          if (status.value) {
            if (status.value.err) {
              throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
            }

            if (status.value.confirmationStatus === 'confirmed' || status.value.confirmationStatus === 'finalized') {
              confirmed = true;
              break;
            }
          }
        } catch (pollError) {
          console.warn('Error polling transaction status:', pollError);
        }
      }

      if (!confirmed) {
        throw new Error('Transaction confirmation timeout');
      }

      // Show success toast
      showToast('success', `Successfully burned ${amount} ${tokenSymbol} tokens`);

      // Reset form and close modal
      setAmount('');

      // Call success callback to refresh balance
      if (onSuccess) {
        onSuccess();
      }

      onClose();

    } catch (error) {
      console.error('Burn error:', error);
      // Better error handling
      let errorMessage = 'Burn failed';
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction cancelled';
        } else if (error.message.includes('insufficient')) {
          errorMessage = 'Insufficient SOL for transaction fee';
        } else {
          errorMessage = error.message;
        }
      }
      showToast('error', errorMessage);
      setErrors({ amount: errorMessage });
    } finally {
      setIsBurning(false);
      setBurnProgress('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-black border border-gray-800 p-8 max-w-md w-full mx-4">
        <h2 className="text-5xl font-bold text-white mb-8">Burn {tokenSymbol}</h2>

        <div className="space-y-6">
          <div>
            <p className="text-xl text-gray-300 mb-4">Amount</p>
            <input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 bg-black border border-gray-800 text-xl text-white placeholder:text-gray-300-temp focus:outline-none focus:border-white"
            />
            <div className="flex justify-between text-lg text-gray-300 mt-2">
              <span>Available: {userBalance === '--' ? '--' : parseUserBalance(userBalance).toLocaleString()}</span>
              <button
                onClick={() => setAmount(userBalance === '--' ? '0' : userBalance)}
                className="text-white hover:text-gray-300 transition-colors cursor-pointer"
              >
                Max
              </button>
            </div>
            {errors.amount && <p className="text-red-400 text-lg mt-2">{errors.amount}</p>}
          </div>

          {burnProgress && (
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-400"></div>
              <p className="text-lg text-gray-300">{burnProgress}</p>
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-8">
          <button
            onClick={onClose}
            className="flex-1 text-xl text-gray-300 hover:text-white transition-colors cursor-pointer py-3"
          >
            Cancel
          </button>
          <button
            onClick={handleBurn}
            disabled={isBurning}
            className={`flex-1 text-xl transition-colors cursor-pointer py-3 ${
              isBurning
                ? 'text-gray-300-temp cursor-not-allowed'
                : 'text-red-400 hover:text-red-300'
            }`}
          >
            {isBurning ? 'Burning...' : 'Burn'}
          </button>
        </div>
      </div>
    </div>
  );
}