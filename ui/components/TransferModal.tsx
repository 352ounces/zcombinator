'use client';

import { useState } from 'react';
import { useWallet } from '@/components/WalletProvider';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getMint
} from '@solana/spl-token';
import { useSignTransaction } from '@privy-io/react-auth/solana';
import { showToast } from '@/components/Toast';
import { createMemoInstruction } from '@solana/spl-memo';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenAddress: string;
  tokenSymbol: string;
  userBalance: string;
  onSuccess?: () => void;
}

export function TransferModal({ isOpen, onClose, tokenAddress, tokenSymbol, userBalance, onSuccess }: TransferModalProps) {
  const { wallet, activeWallet } = useWallet();
  const { signTransaction } = useSignTransaction();
  const [amount, setAmount] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [description, setDescription] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; address?: string; description?: string }>({});
  const [transferProgress, setTransferProgress] = useState<string>('');

  // Helper function to safely parse user balance
  const parseUserBalance = (balance: string): number => {
    if (balance === '--') return 0;
    const parsed = parseFloat(balance);
    return isNaN(parsed) ? 0 : parsed;
  };

  const validateInputs = () => {
    const newErrors: { amount?: string; address?: string; description?: string } = {};

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

    // Validate Solana address
    if (!toAddress || toAddress.trim() === '') {
      newErrors.address = 'Recipient address is required';
    } else {
      try {
        new PublicKey(toAddress);
      } catch {
        newErrors.address = 'Invalid Solana address';
      }
    }

    // Validate description (required)
    if (!description || description.trim() === '') {
      newErrors.description = 'Description is required';
    } else if (description.trim().length > 200) {
      newErrors.description = 'Description must be less than 200 characters';
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
        setErrors(prev => ({ ...prev, amount: undefined }));
      }
    }
  };

  const handleAddressChange = (value: string) => {
    setToAddress(value);
    if (errors.address && value) {
      try {
        new PublicKey(value);
        setErrors(prev => ({ ...prev, address: undefined }));
      } catch {}
    }
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (errors.description && value.trim() && value.trim().length <= 200) {
      setErrors(prev => ({ ...prev, description: undefined }));
    }
  };

  const handleTransfer = async () => {
    if (!validateInputs() || !wallet || !activeWallet) return;

    setIsTransferring(true);
    setTransferProgress('Preparing transfer...');

    try {
      const { Connection } = await import('@solana/web3.js');
      const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com');

      const fromPublicKey = wallet;
      const toPublicKey = new PublicKey(toAddress);
      const mintPublicKey = new PublicKey(tokenAddress);

      // Get actual token decimals
      const mintInfo = await getMint(connection, mintPublicKey);
      const decimals = mintInfo.decimals;

      // Convert amount to token units using actual decimals
      const amountInTokens = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));

      // Get associated token accounts
      const fromTokenAccount = await getAssociatedTokenAddress(mintPublicKey, fromPublicKey);
      const toTokenAccount = await getAssociatedTokenAddress(mintPublicKey, toPublicKey, true);

      // Create transaction
      const transaction = new Transaction();

      // Check if recipient's associated token account exists
      const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);

      if (!toTokenAccountInfo) {
        // If account doesn't exist, add instruction to create it
        const createATAInstruction = createAssociatedTokenAccountInstruction(
          fromPublicKey, // payer
          toTokenAccount, // ata
          toPublicKey, // owner
          mintPublicKey // mint
        );
        transaction.add(createATAInstruction);
      }

      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromPublicKey,
        amountInTokens,
        [],
        TOKEN_PROGRAM_ID
      );

      transaction.add(transferInstruction);

      // Add memo instruction with the description
      if (description.trim()) {
        const memoInstruction = createMemoInstruction(description.trim(), [fromPublicKey]);
        transaction.add(memoInstruction);
      }

      // Get recent blockhash and set transaction properties
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPublicKey;

      // Sign and send transaction with modern approach
      setTransferProgress('Please approve transaction in your wallet...');
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

      setTransferProgress('Confirming transaction...');
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
      showToast('success', `Successfully transferred ${amount} ${tokenSymbol}`);

      // Reset form and close modal
      setAmount('');
      setToAddress('');
      setDescription('');

      // Call success callback to refresh balance
      if (onSuccess) {
        onSuccess();
      }

      onClose();

    } catch (error) {
      console.error('Transfer error:', error);
      // Better error handling
      let errorMessage = 'Transfer failed';
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
      setIsTransferring(false);
      setTransferProgress('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-black border border-gray-800 p-8 max-w-md w-full mx-4">
        <h2 className="text-5xl font-bold text-white mb-8">Transfer {tokenSymbol}</h2>

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

          <div>
            <p className="text-xl text-gray-300 mb-4">Recipient Address</p>
            <input
              type="text"
              value={toAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="Solana address"
              className="w-full px-4 py-3 bg-black border border-gray-800 text-xl text-white placeholder:text-gray-300-temp focus:outline-none focus:border-white font-mono"
            />
            {errors.address && <p className="text-red-400 text-lg mt-2">{errors.address}</p>}
          </div>

          <div>
            <p className="text-xl text-gray-300 mb-4">Description (Required)</p>
            <textarea
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="What's this transfer for?"
              maxLength={200}
              rows={3}
              className="w-full px-4 py-3 bg-black border border-gray-800 text-xl text-white placeholder:text-gray-300-temp focus:outline-none focus:border-white resize-none"
            />
            <div className="flex justify-between text-lg text-gray-300 mt-2">
              <span>{description.length}/200 characters</span>
            </div>
            {errors.description && <p className="text-red-400 text-lg mt-2">{errors.description}</p>}
          </div>

          {transferProgress && (
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
              <p className="text-lg text-gray-300">{transferProgress}</p>
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
            onClick={handleTransfer}
            disabled={isTransferring}
            className={`flex-1 text-xl transition-colors cursor-pointer py-3 ${
              isTransferring
                ? 'text-gray-300-temp cursor-not-allowed'
                : 'text-white hover:text-gray-300'
            }`}
          >
            {isTransferring ? 'Transferring...' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}