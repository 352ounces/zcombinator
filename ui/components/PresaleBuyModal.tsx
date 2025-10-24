'use client';

import { useState } from 'react';
import { useWallet } from '@/components/WalletProvider';
import { usePrivy } from '@privy-io/react-auth';
import { InfoTooltip } from '@/components/InfoTooltip';
import { Transaction, PublicKey, Connection } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { useParams } from 'next/navigation';

const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
  'confirmed'
);

// $ZC Token Configuration
const ZC_TOKEN_MINT = new PublicKey("GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC");
const ZC_DECIMALS = 6;
const ZC_PER_TOKEN = Math.pow(10, ZC_DECIMALS);

interface PresaleBuyModalProps {
  tokenSymbol: string;
  status: string;
  maxContribution?: number;
  userContribution?: number;
  escrowAddress?: string;
  onSuccess?: () => void;
}

export function PresaleBuyModal({ tokenSymbol, status, maxContribution = 10, userContribution = 0, escrowAddress, onSuccess }: PresaleBuyModalProps) {
  const params = useParams();
  const tokenAddress = params.tokenAddress as string;
  const { wallet, activeWallet, connecting } = useWallet();
  const { login, authenticated, linkWallet } = usePrivy();
  const [amount, setAmount] = useState('');
  const [isContributing, setIsContributing] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string }>({});

  // Calculate remaining allowance
  const remainingAllowance = maxContribution === Infinity ? Infinity : maxContribution - userContribution;

  const validateInputs = () => {
    const newErrors: { amount?: string } = {};

    if (!amount || amount.trim() === '') {
      newErrors.amount = 'Amount is required';
    } else {
      const numAmount = parseInt(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        newErrors.amount = 'Amount must be a positive number';
      } else if (remainingAllowance !== Infinity && numAmount > remainingAllowance) {
        newErrors.amount = `Amount exceeds remaining allowance of ${Math.floor(remainingAllowance)} $ZC`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAmountChange = (value: string) => {
    // Prevent negative values and decimal points
    if (value.startsWith('-') || value.includes('.')) {
      return;
    }

    // Only allow integer values
    const intValue = value.replace(/[^\d]/g, '');
    setAmount(intValue);

    // Real-time validation feedback
    if (intValue.trim() !== '') {
      const numAmount = parseInt(intValue);
      if (!isNaN(numAmount)) {
        if (remainingAllowance !== Infinity && numAmount > remainingAllowance) {
          setErrors({ amount: `Amount exceeds remaining allowance of ${Math.floor(remainingAllowance)} $ZC` });
        } else if (numAmount <= 0) {
          setErrors({ amount: 'Amount must be positive' });
        } else {
          setErrors({});
        }
      }
    } else {
      setErrors({});
    }
  };

  const handleConnectWallet = async () => {
    try {
      if (!authenticated) {
        login();
      } else {
        linkWallet();
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setErrors({ amount: 'Failed to connect wallet. Please try again.' });
    }
  };

  const handleBuy = async () => {
    // If wallet is not connected, connect it instead
    if (!wallet) {
      await handleConnectWallet();
      return;
    }

    if (!validateInputs() || !activeWallet || !escrowAddress) return;

    setIsContributing(true);

    try {
      const amountZC = parseInt(amount);
      const amountWithDecimals = Math.floor(amountZC * ZC_PER_TOKEN);
      const walletAddress = wallet.toBase58();

      // Get user's $ZC token account
      const userTokenAccount = await getAssociatedTokenAddress(
        ZC_TOKEN_MINT,
        wallet,
        true
      );

      // Get escrow's $ZC token account
      const escrowPubkey = new PublicKey(escrowAddress);
      const escrowTokenAccount = await getAssociatedTokenAddress(
        ZC_TOKEN_MINT,
        escrowPubkey,
        true
      );

      // Check if user's token account exists and get balance
      let userTokenAccountInfo;
      let userZCBalance = 0;
      try {
        userTokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
        if (userTokenAccountInfo) {
          // Fetch the actual token balance
          const tokenAccountData = await connection.getTokenAccountBalance(userTokenAccount);
          userZCBalance = Number(tokenAccountData.value.amount);
        }
      } catch (err) {
        // Account doesn't exist
        userTokenAccountInfo = null;
      }

      // Check user has enough $ZC tokens
      if (userZCBalance < amountWithDecimals) {
        throw new Error(`Insufficient $ZC balance. Required: ${amountZC} $ZC`);
      }

      // Check if escrow's token account exists
      let escrowTokenAccountInfo;
      try {
        escrowTokenAccountInfo = await connection.getAccountInfo(escrowTokenAccount);
      } catch (err) {
        escrowTokenAccountInfo = null;
      }

      // Create transaction
      const transaction = new Transaction();

      // Add instruction to create escrow's token account if it doesn't exist (user pays)
      if (!escrowTokenAccountInfo) {
        const createEscrowATAInstruction = createAssociatedTokenAccountInstruction(
          wallet, // payer (user pays)
          escrowTokenAccount,
          escrowPubkey, // owner
          ZC_TOKEN_MINT
        );
        transaction.add(createEscrowATAInstruction);
      }

      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        userTokenAccount,
        escrowTokenAccount,
        wallet,
        amountWithDecimals
      );
      transaction.add(transferInstruction);

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet;

      // Serialize transaction for Privy signing
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      // Sign transaction using Privy wallet
      const signedResult = await activeWallet.signTransaction({
        transaction: serializedTransaction,
      });

      // Deserialize the signed transaction
      const signedTx = Transaction.from(Buffer.from(signedResult.signedTransaction));

      // Send and confirm the signed transaction
      const signature = await connection.sendRawTransaction(
        signedTx.serialize()
      );

      await connection.confirmTransaction(signature, 'confirmed');

      // Record the transaction in the database (using api-server)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const recordResponse = await fetch(`${apiUrl}/presale/${tokenAddress}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionSignature: signature,
          walletAddress,
          amountTokens: amountWithDecimals, // Amount in $ZC smallest units (6 decimals)
          tokenMint: ZC_TOKEN_MINT.toBase58(), // Add token mint for verification
        }),
      });

      if (!recordResponse.ok) {
        const error = await recordResponse.json();
        console.error('Failed to record transaction:', error);
        // Don't throw - transaction succeeded, just recording failed
      }

      // Success!
      if (onSuccess) {
        onSuccess();
      }

      setAmount('');
      setErrors({});
    } catch (error) {
      console.error('Buy error:', error);

      // Determine error message based on error type
      let errorMessage = 'Transaction failed. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction cancelled.';
        } else if (error.message.includes('Insufficient')) {
          errorMessage = error.message;
        } else if (error.message.includes('blockhash')) {
          errorMessage = 'Transaction expired. Please try again.';
        } else {
          errorMessage = error.message;
        }
      }

      setErrors({ amount: errorMessage });
    } finally {
      setIsContributing(false);
    }
  };

  const setPercentage = (percent: number) => {
    const calculatedAmount = Math.floor(remainingAllowance * percent / 100);
    setAmount(calculatedAmount.toString());
    if (errors.amount) {
      setErrors({});
    }
  };

  const setFixedAmount = (sol: number) => {
    setAmount(sol.toString());
    if (errors.amount) {
      setErrors({});
    }
  };

  const isDisabled = status !== 'pending';
  const isAmountInvalid = amount.trim() !== '' && (parseInt(amount) <= 0 || (remainingAllowance !== Infinity && parseInt(amount) > remainingAllowance) || isNaN(parseInt(amount)));
  const isUnlimited = maxContribution === Infinity;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h2 className="text-2xl font-bold mb-4">Buy</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-300 text-lg">
            <span>Your max contribution: <span className="text-white font-bold">{isUnlimited ? 'Unlimited' : `${maxContribution.toFixed(0)} $ZC`}</span></span>
            <InfoTooltip text={isUnlimited ? "No limit on buy size - presale is open to everyone" : "Maximum buy size based on your holdings of the required tokens"} />
          </div>
            <div className="text-gray-300 text-lg">
            Your contribution: <span className="text-white font-bold">{userContribution.toFixed(0)} $ZC</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-lg text-gray-300">Amount ($ZC)</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0"
              disabled={isDisabled}
              min="0"
              step="1"
              className={`w-full py-3 bg-transparent border-0 border-b border-gray-800 focus:outline-none focus:border-white transition-colors text-xl placeholder:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50 disabled:cursor-not-allowed`}
              autoComplete="off"
            />
            {!isUnlimited && (
              <button
                type="button"
                onClick={() => setPercentage(100)}
                disabled={isDisabled}
                className="absolute right-2 top-2 text-lg text-gray-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                tabIndex={-1}
              >
                MAX
              </button>
            )}
          </div>
          <div className="h-5">
            {errors.amount && (
              <p className="text-sm text-red-400">
                {errors.amount}
              </p>
            )}
          </div>
        </div>

        {isUnlimited ? (
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={() => setFixedAmount(0.1)}
              disabled={isDisabled}
              className="py-2 text-lg text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              0.1
            </button>
            <button
              onClick={() => setFixedAmount(0.2)}
              disabled={isDisabled}
              className="py-2 text-lg text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              0.2
            </button>
            <button
              onClick={() => setFixedAmount(0.5)}
              disabled={isDisabled}
              className="py-2 text-lg text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              0.5
            </button>
            <button
              onClick={() => setFixedAmount(1)}
              disabled={isDisabled}
              className="py-2 text-lg text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              1
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={() => setPercentage(10)}
              disabled={isDisabled}
              className="py-2 text-lg text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              10%
            </button>
            <button
              onClick={() => setPercentage(25)}
              disabled={isDisabled}
              className="py-2 text-lg text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              25%
            </button>
            <button
              onClick={() => setPercentage(50)}
              disabled={isDisabled}
              className="py-2 text-lg text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              50%
            </button>
            <button
              onClick={() => setPercentage(75)}
              disabled={isDisabled}
              className="py-2 text-lg text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              75%
            </button>
          </div>
        )}

        <button
          onClick={handleBuy}
          disabled={isContributing || connecting || (isDisabled && !!wallet) || (isAmountInvalid && !!wallet)}
          className="w-full py-3 text-xl font-bold bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {connecting ? 'Connecting...' : isContributing ? 'Processing...' : !wallet ? 'Connect Wallet' : status !== 'pending' ? 'Presale Closed' : 'Buy'}
        </button>
      </div>
    </div>
  );
}
