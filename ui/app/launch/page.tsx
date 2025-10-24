'use client';

import { WalletButton } from '@/components/WalletButton';
import { ImageUpload } from '@/components/ImageUpload';
import { useWallet } from '@/components/WalletProvider';
import { Navigation } from '@/components/Navigation';
import { useState, useMemo, useRef } from 'react';
import { Keypair, Transaction, Connection } from '@solana/web3.js';
import { useSignTransaction } from '@privy-io/react-auth/solana';
import { useRouter } from 'next/navigation';
import bs58 from 'bs58';

export default function LaunchPage() {
  const { activeWallet, externalWallet } = useWallet();
  const { signTransaction } = useSignTransaction();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    ticker: '',
    caEnding: '',
    image: '',
    website: '',
    twitter: '',
    description: '',
    creatorTwitter: '',
    creatorGithub: '',
    presale: false,
    presaleTokens: [''],
    quoteToken: 'SOL' as 'SOL' | 'ZC'
  });

  const [isLaunching, setIsLaunching] = useState(false);
  const [isGeneratingCA, setIsGeneratingCA] = useState(false);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const cancelGenerationRef = useRef(false);

  // Validation functions
  const validateName = (name: string) => {
    // Required field, max 32 characters
    return name.length > 0 && name.length <= 32;
  };

  const validateTicker = (ticker: string) => {
    // Required field, max 10 characters
    return ticker.length > 0 && ticker.length <= 10;
  };

  const validateCAEnding = (caEnding: string) => {
    // Optional field - valid if empty or up to 3 characters
    if (caEnding.length > 3) return false;

    // Check for invalid Base58 characters: 0, O, I, l
    const invalidChars = /[0OIl]/;
    return !invalidChars.test(caEnding);
  };

  const validateWebsite = (website: string) => {
    // Optional field - valid if empty or valid URL
    if (!website) return true;
    try {
      // If no protocol, try adding https://
      const urlToTest = website.match(/^https?:\/\//) ? website : `https://${website}`;
      new URL(urlToTest);
      return true;
    } catch {
      return false;
    }
  };

  const validateTwitter = (twitter: string) => {
    // Optional field - valid if empty or Twitter/X URL (profile or tweet)
    if (!twitter) return true;
    // Accept with or without protocol
    const urlToTest = twitter.match(/^https?:\/\//) ? twitter : `https://${twitter}`;
    return /^https?:\/\/(www\.)?(twitter|x)\.com\/[A-Za-z0-9_]+(\/status\/\d+)?\/?(\?.*)?$/.test(urlToTest);
  };

  const validateCreatorTwitter = (twitter: string) => {
    // Optional field - valid if empty or Twitter/X profile URL
    if (!twitter) return true;
    // Accept with or without protocol
    const urlToTest = twitter.match(/^https?:\/\//) ? twitter : `https://${twitter}`;
    return /^https?:\/\/(www\.)?(twitter|x)\.com\/[A-Za-z0-9_]+\/?(\?.*)?$/.test(urlToTest);
  };

  const validateCreatorGithub = (github: string) => {
    // Optional field - valid if empty or GitHub profile URL
    if (!github) return true;
    // Accept with or without protocol
    const urlToTest = github.match(/^https?:\/\//) ? github : `https://${github}`;
    return /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9-]+\/?$/.test(urlToTest);
  };

  const validateDescription = (description: string) => {
    // Optional field - valid if empty or under 280 characters
    return description.length <= 280;
  };

  const validateSolanaAddress = (address: string) => {
    // Optional field - valid if empty
    if (!address) return true;
    // Check if it's a valid base58 address (typically 32-44 characters)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  };

  // Track field validity
  const fieldValidity = useMemo(() => ({
    name: validateName(formData.name),
    ticker: validateTicker(formData.ticker),
    caEnding: validateCAEnding(formData.caEnding),
    website: validateWebsite(formData.website),
    twitter: validateTwitter(formData.twitter),
    description: validateDescription(formData.description),
    image: !!formData.image,
    creatorTwitter: validateCreatorTwitter(formData.creatorTwitter),
    creatorGithub: validateCreatorGithub(formData.creatorGithub),
    presaleTokens: !formData.presale || formData.presaleTokens.every(t => validateSolanaAddress(t))
  }), [formData]);

  // Check if form is valid (only name, ticker, image are required)
  const isFormValid = useMemo(() => {
    return fieldValidity.name &&
           fieldValidity.ticker &&
           fieldValidity.caEnding &&
           fieldValidity.website &&
           fieldValidity.twitter &&
           fieldValidity.description &&
           fieldValidity.image &&
           fieldValidity.creatorTwitter &&
           fieldValidity.creatorGithub &&
           fieldValidity.presaleTokens;
  }, [fieldValidity]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddPresaleToken = () => {
    if (formData.presaleTokens.length < 5) {
      setFormData(prev => ({
        ...prev,
        presaleTokens: [...prev.presaleTokens, '']
      }));
    }
  };

  const handleRemovePresaleToken = (index: number) => {
    setFormData(prev => {
      const newTokens = prev.presaleTokens.filter((_, i) => i !== index);
      return {
        ...prev,
        presaleTokens: newTokens.length === 0 ? [''] : newTokens
      };
    });
  };

  const handlePresaleTokenChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      presaleTokens: prev.presaleTokens.map((token, i) => i === index ? value : token)
    }));
  };


  const generateTokenKeypair = async (caEnding?: string) => {
    // Generate keypair with optional custom ending

    if (!caEnding) {
      // Generate a simple keypair if no CA ending specified
      const keypair = Keypair.generate();
      const address = keypair.publicKey.toString();
      // Simple keypair generated successfully
      return { keypair, address };
    }

    // Searching for keypair with custom ending

    // Generate keypairs until we find one ending with the specified CA ending
    let keypair: Keypair;
    let attempts = 0;
    const maxAttempts = 10000000; // Limit attempts to prevent infinite loop

    do {
      // Check for cancellation
      if (cancelGenerationRef.current) {
        // Generation cancelled by user
        throw new Error('Generation cancelled');
      }

      keypair = Keypair.generate();
      attempts++;

      // Update progress every 10000 attempts
      if (attempts % 10000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    } while (!keypair.publicKey.toString().endsWith(caEnding) && attempts < maxAttempts && !cancelGenerationRef.current);

    // Check if cancelled after the loop
    if (cancelGenerationRef.current) {
      // Generation cancelled by user after loop
      throw new Error('Generation cancelled');
    }

    const finalAddress = keypair.publicKey.toString();
    // Found matching keypair successfully

    return { keypair, address: finalAddress };
  };

  const handleCancel = () => {
    // Cancel button clicked
    cancelGenerationRef.current = true;
  };

  const handleLaunch = async () => {
    if (!isFormValid || isLaunching || isGeneratingCA || !externalWallet || !activeWallet) return;

    cancelGenerationRef.current = false; // Reset cancel flag

    try {
      // For presales, we don't generate the keypair here
      let keypair: Keypair | null = null;

      if (!formData.presale) {
        // Only generate keypair for non-presale launches
        const hasCAEnding = formData.caEnding && formData.caEnding.length > 0;

        if (hasCAEnding) {
          setIsGeneratingCA(true);
        }

        const result = await generateTokenKeypair(hasCAEnding ? formData.caEnding : undefined);
        keypair = result.keypair;

        if (hasCAEnding) {
          setIsGeneratingCA(false);
        }
      }

      setIsLaunching(true);

      // Step 1: Upload metadata
      const metadata = {
        name: formData.name,
        symbol: formData.ticker,
        description: formData.description || undefined,
        image: formData.image || undefined,
        website: formData.website ? (formData.website.match(/^https?:\/\//) ? formData.website : `https://${formData.website}`) : undefined,
        twitter: formData.twitter ? (formData.twitter.match(/^https?:\/\//) ? formData.twitter : `https://${formData.twitter}`) : undefined,
        caEnding: formData.caEnding || undefined,
        creatorTwitter: formData.creatorTwitter ? (formData.creatorTwitter.match(/^https?:\/\//) ? formData.creatorTwitter : `https://${formData.creatorTwitter}`) : undefined,
        creatorGithub: formData.creatorGithub ? (formData.creatorGithub.match(/^https?:\/\//) ? formData.creatorGithub : `https://${formData.creatorGithub}`) : undefined,
      };

      const metadataResponse = await fetch('/api/upload-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      });

      const metadataData = await metadataResponse.json();

      if (!metadataResponse.ok) {
        throw new Error(metadataData.error || 'Metadata upload failed');
      }

      // Step 2: Check if presale - if so, create presale record and redirect
      if (formData.presale) {
        const presaleResponse = await fetch('/api/presale', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            symbol: formData.ticker,
            uri: metadataData.url,
            creatorWallet: externalWallet.toString(),
            presaleTokens: formData.presaleTokens.filter(t => t.trim()),
            caEnding: formData.caEnding || undefined,
            creatorTwitter: formData.creatorTwitter ? (formData.creatorTwitter.match(/^https?:\/\//) ? formData.creatorTwitter : `https://${formData.creatorTwitter}`) : undefined,
            creatorGithub: formData.creatorGithub ? (formData.creatorGithub.match(/^https?:\/\//) ? formData.creatorGithub : `https://${formData.creatorGithub}`) : undefined,
          }),
        });

        const presaleData = await presaleResponse.json();

        if (!presaleResponse.ok) {
          throw new Error(presaleData.error || 'Presale creation failed');
        }

        // Redirect to presale page
        router.push(`/presale/${presaleData.tokenAddress}`);
        return;
      }

      // Step 2: Create launch transaction (for normal launches)
      if (!keypair) {
        throw new Error('Keypair not generated for normal launch');
      }

      const launchResponse = await fetch('/api/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseMintPublicKey: keypair.publicKey.toString(),
          name: formData.name,
          symbol: formData.ticker,
          uri: metadataData.url,
          payerPublicKey: externalWallet.toString(),
          quoteToken: formData.quoteToken,
        }),
      });

      const launchData = await launchResponse.json();

      if (!launchResponse.ok) {
        throw new Error(launchData.error || 'Transaction creation failed');
      }

      // Step 3: Sign transaction following Phantom's recommended order
      // Per Phantom docs: wallet signs first, then additional signers
      const transactionBuffer = bs58.decode(launchData.transaction);
      const transaction = Transaction.from(transactionBuffer);

      // 1. Phantom wallet signs first (user is fee payer)
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      });

      const { signedTransaction: signedTxBytes } = await signTransaction({
        transaction: serializedTransaction,
        wallet: activeWallet!
      });

      const walletSignedTx = Transaction.from(signedTxBytes);

      // 2. Additional signer (base mint keypair) signs after
      walletSignedTx.partialSign(keypair);

      // 3. Send the fully signed transaction
      const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com');
      const signature = await connection.sendRawTransaction(
        walletSignedTx.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        }
      );

      const signedTransaction = { signature };

      setTransactionSignature(signedTransaction.signature);
      // Transaction sent successfully

      // Step 4: Confirm transaction and record in database
      const confirmResponse = await fetch('/api/launch/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionSignature: signedTransaction.signature,
          baseMint: launchData.baseMint,
          name: formData.name,
          symbol: formData.ticker,
          uri: metadataData.url,
          creatorWallet: externalWallet.toString(),
          creatorTwitter: formData.creatorTwitter || undefined,
          creatorGithub: formData.creatorGithub || undefined,
        }),
      });

      await confirmResponse.json();

      if (!confirmResponse.ok) {
        // Failed to confirm launch
      } else {
        // Launch confirmed and recorded in database
      }

    } catch (error) {
      // Launch error occurred
      if (error instanceof Error && error.message === 'Generation cancelled') {
        // Launch cancelled - no metadata will be uploaded
      } else {
        alert(`Failed to launch token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsLaunching(false);
      setIsGeneratingCA(false);
      cancelGenerationRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-[#000000]">
      <main className="px-0 sm:px-4 relative">
        <div className="bg-[#141414] min-h-screen text-[#F7FCFE] rounded-none sm:rounded-4xl relative">
          <div className="max-w-7xl mx-auto px-8 py-12 sm:px-12 sm:py-16">
        <h1 className="text-5xl font-bold mb-12">𝓩 Launch</h1>

        <div className="flex gap-12">
          {/* Left side - Token Details */}
          <div className="flex-grow space-y-6">
            {/* Top row - Image and basic info */}
            <div className="flex gap-6 items-stretch">
              <div className="flex-shrink-0 w-[200px] min-h-[200px]">
                <ImageUpload
                  onImageUpload={(url) => setFormData(prev => ({ ...prev, image: url }))}
                  currentImage={formData.image}
                  name={formData.name || 'token'}
                />
              </div>

              <div className="flex-grow space-y-6">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Name*"
                  maxLength={32}
                  autoComplete="off"
                  className={`w-full py-2 bg-transparent border-0 border-b focus:outline-none transition-colors text-xl placeholder:text-gray-300 ${
                    formData.name && !fieldValidity.name
                      ? 'border-red-500 text-red-400 focus:border-red-500 placeholder:text-red-400'
                      : formData.name
                      ? 'border-gray-800 text-[#b2e9fe] focus:border-white'
                      : 'border-gray-800 text-gray-300 focus:border-white'
                  }`}
                />

                <input
                  type="text"
                  name="ticker"
                  value={formData.ticker}
                  onChange={handleInputChange}
                  placeholder="Ticker*"
                  maxLength={10}
                  autoComplete="off"
                  className={`w-full py-2 bg-transparent border-0 border-b focus:outline-none transition-colors text-xl placeholder:text-gray-300 ${
                    formData.ticker && !fieldValidity.ticker
                      ? 'border-red-500 text-red-400 focus:border-red-500 placeholder:text-red-400'
                      : formData.ticker
                      ? 'border-gray-800 text-[#b2e9fe] focus:border-white'
                      : 'border-gray-800 text-gray-300 focus:border-white'
                  }`}
                />

                <input
                  type="text"
                  name="caEnding"
                  value={formData.caEnding}
                  onChange={handleInputChange}
                  placeholder="CA Ending"
                  maxLength={3}
                  autoComplete="off"
                  className={`w-full py-2 bg-transparent border-0 border-b focus:outline-none transition-colors text-xl placeholder:text-gray-300 ${
                    formData.caEnding && !fieldValidity.caEnding
                      ? 'border-red-500 text-red-400 focus:border-red-500 placeholder:text-red-400'
                      : formData.caEnding
                      ? 'border-gray-800 text-[#b2e9fe] focus:border-white'
                      : 'border-gray-800 text-gray-300 focus:border-white'
                  }`}
                />
              </div>
            </div>

            {/* Website and Twitter */}
            <div className="grid grid-cols-2 gap-6">
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                placeholder="Website"
                autoComplete="off"
                className={`w-full py-2 bg-transparent border-0 border-b focus:outline-none transition-colors text-xl placeholder:text-gray-300 ${
                  formData.website && !fieldValidity.website
                    ? 'border-red-500 text-red-400 focus:border-red-500 placeholder:text-red-400'
                    : formData.website
                    ? 'border-gray-800 text-[#b2e9fe] focus:border-white'
                    : 'border-gray-800 text-gray-300 focus:border-white'
                }`}
              />

              <input
                type="text"
                name="twitter"
                value={formData.twitter}
                onChange={handleInputChange}
                placeholder="X URL"
                autoComplete="off"
                className={`w-full py-2 bg-transparent border-0 border-b focus:outline-none transition-colors text-xl placeholder:text-gray-300 ${
                  formData.twitter && !fieldValidity.twitter
                    ? 'border-red-500 text-red-400 focus:border-red-500 placeholder:text-red-400'
                    : formData.twitter
                    ? 'border-gray-800 text-[#b2e9fe] focus:border-white'
                    : 'border-gray-800 text-gray-300 focus:border-white'
                }`}
              />
            </div>

            {/* Description - full width below */}
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Description"
              rows={4}
              maxLength={280}
              className={`w-full py-2 bg-transparent border-0 border-b focus:outline-none transition-colors text-xl placeholder:text-gray-300 resize-none ${
                formData.description && !fieldValidity.description
                  ? 'border-red-500 text-red-400 focus:border-red-500 placeholder:text-red-400'
                  : formData.description
                  ? 'border-gray-800 text-[#b2e9fe] focus:border-white'
                  : 'border-gray-800 text-gray-300 focus:border-white'
              }`}
            />
          </div>

          {/* Right side - Creator Designation */}
          <div className="flex-shrink-0 space-y-6" style={{ width: 'calc(50% - 100px - 1.5rem)' }}>
            <p className="text-lg text-gray-300">Give rewards to... (optional, do not fill this out for yourself)</p>

            <input
              type="text"
              name="creatorTwitter"
              value={formData.creatorTwitter}
              onChange={handleInputChange}
              placeholder="Dev X Profile URL"
              autoComplete="off"
              className={`w-full py-2 bg-transparent border-0 border-b focus:outline-none transition-colors text-xl placeholder:text-gray-300 ${
                formData.creatorTwitter && !fieldValidity.creatorTwitter
                  ? 'border-red-500 text-red-400 focus:border-red-500 placeholder:text-red-400'
                  : formData.creatorTwitter
                  ? 'border-gray-800 text-[#b2e9fe] focus:border-white'
                  : 'border-gray-800 text-gray-300 focus:border-white'
              }`}
            />

            <input
              type="text"
              name="creatorGithub"
              value={formData.creatorGithub}
              onChange={handleInputChange}
              placeholder="Dev GitHub Profile URL"
              autoComplete="off"
              className={`w-full py-2 bg-transparent border-0 border-b focus:outline-none transition-colors text-xl placeholder:text-gray-300 ${
                formData.creatorGithub && !fieldValidity.creatorGithub
                  ? 'border-red-500 text-red-400 focus:border-red-500 placeholder:text-red-400'
                  : formData.creatorGithub
                  ? 'border-gray-800 text-[#b2e9fe] focus:border-white'
                  : 'border-gray-800 text-gray-300 focus:border-white'
              }`}
            />

            <div className="space-y-4 mt-4">
              <div>
                <p className="text-lg text-gray-300 mb-3">Quote Token</p>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="quoteToken"
                      value="SOL"
                      checked={formData.quoteToken === 'SOL'}
                      onChange={(e) => setFormData(prev => ({ ...prev, quoteToken: e.target.value as 'SOL' | 'ZC' }))}
                      className="w-5 h-5 cursor-pointer accent-[#b2e9fe]"
                    />
                    <span className="text-lg text-gray-300">SOL</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="quoteToken"
                      value="ZC"
                      checked={formData.quoteToken === 'ZC'}
                      onChange={(e) => setFormData(prev => ({ ...prev, quoteToken: e.target.value as 'SOL' | 'ZC' }))}
                      className="w-5 h-5 cursor-pointer accent-[#b2e9fe]"
                    />
                    <span className="text-lg text-gray-300">ZC</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="presale"
                  checked={formData.presale}
                  onChange={(e) => setFormData(prev => ({ ...prev, presale: e.target.checked }))}
                  className="w-5 h-5 cursor-pointer accent-[#b2e9fe]"
                />
                <label htmlFor="presale" className="text-lg text-gray-300 cursor-pointer">
                  Presale
                </label>
                <div className="relative group">
                  <svg
                    className="w-4 h-4 text-gray-400 cursor-help"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                    <path strokeWidth="2" d="M12 16v-4m0-4h.01"/>
                  </svg>
                  <div className="absolute left-6 top-0 w-64 p-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-sm text-gray-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 pointer-events-none">
                    Make the launch a presale. Only buyers holding the specified tokens will be allowed to buy in the pre-sale round. The size of their buys will be proportional to holdings.
                  </div>
                </div>
              </div>
            </div>

            {formData.presale && (
              <div className="mt-6 space-y-4">
                <p className="text-sm text-gray-400">Token Contract Addresses (optional)</p>
                {formData.presaleTokens.map((token, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={token}
                      onChange={(e) => handlePresaleTokenChange(index, e.target.value)}
                      placeholder="Token CA"
                      autoComplete="off"
                      className={`flex-grow py-2 bg-transparent border-0 border-b focus:outline-none transition-colors text-lg placeholder:text-gray-300 ${
                        token && !validateSolanaAddress(token)
                          ? 'border-red-500 text-red-400 focus:border-red-500 placeholder:text-red-400'
                          : token
                          ? 'border-gray-800 text-[#b2e9fe] focus:border-white'
                          : 'border-gray-800 text-gray-300 focus:border-white'
                      }`}
                    />
                    {(formData.presaleTokens.length > 1 || (formData.presaleTokens.length === 1 && token.trim())) && (
                      <button
                        onClick={() => handleRemovePresaleToken(index)}
                        className="text-gray-400 hover:text-red-400 transition-colors text-xl"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {formData.presaleTokens.length < 5 && (
                  <button
                    onClick={handleAddPresaleToken}
                    className="text-sm text-gray-400 hover:text-[#b2e9fe] transition-colors"
                  >
                    + Add Token
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-8">
          <WalletButton onLaunch={handleLaunch} disabled={externalWallet ? (!isFormValid || isLaunching || isGeneratingCA) : false} isLaunching={isLaunching} isGeneratingCA={isGeneratingCA} isPresale={formData.presale} />

          {isGeneratingCA && (
            <button
              onClick={handleCancel}
              className="text-xl text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>

        {transactionSignature && (
          <div className="mt-6">
            <p className="text-lg text-green-400">
              Success!{' '}
              <a
                href={`https://solscan.io/tx/${transactionSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green-300 underline"
              >
                Transaction
              </a>
            </p>
          </div>
        )}

        <Navigation />
          </div>
        </div>
      </main>
    </div>
  );
}