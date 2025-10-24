import { useState } from 'react';
import Link from 'next/link';

interface TokenCardProps {
  tokenName: string | null;
  tokenSymbol: string | null;
  tokenAddress: string;
  creatorWallet: string;
  creatorTwitter?: string | null;
  creatorGithub?: string | null;
  metadata?: {
    name: string;
    symbol: string;
    image: string;
    website?: string;
    twitter?: string;
    description?: string;
  } | null;
  status?: string;
  createdAt?: string;
  launchTime?: string;
  marketCap?: number;
  totalClaimed?: string;
  availableToClaim?: string;
  onClick?: () => void;
  showStats?: boolean;
  isCreator?: boolean;
}

export function TokenCard({
  tokenName,
  tokenSymbol,
  tokenAddress,
  creatorWallet,
  creatorTwitter,
  creatorGithub,
  metadata,
  status,
  createdAt,
  launchTime,
  marketCap,
  totalClaimed,
  availableToClaim,
  onClick,
  showStats = true,
  isCreator = false,
}: TokenCardProps) {
  const [copiedAddress, setCopiedAddress] = useState(false);

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes > 0 ? `${diffMinutes}m ago` : 'just now';
    }
  };

  const formatTokenAmount = (amount: string | undefined) => {
    if (!amount) return '0';
    const num = parseFloat(amount);
    if (num >= 1_000_000_000) {
      return `${Math.floor(num / 1_000_000_000)}B`;
    } else if (num >= 1_000_000) {
      return `${Math.floor(num / 1_000_000)}M`;
    } else if (num >= 1_000) {
      return `${Math.floor(num / 1_000)}K`;
    }
    return Math.floor(num).toString();
  };

  const formatMarketCap = (marketCap: number | undefined) => {
    if (!marketCap) return '-';
    if (marketCap >= 1_000_000) {
      return `$${(marketCap / 1_000_000).toFixed(2)}M`;
    } else if (marketCap >= 1_000) {
      return `$${(marketCap / 1_000).toFixed(2)}K`;
    }
    return `$${marketCap.toFixed(2)}`;
  };

  const handleCopyAddress = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(tokenAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const formatSocials = (twitter: string | null | undefined, github: string | null | undefined) => {
    const socials: React.ReactElement[] = [];

    if (twitter) {
      const twitterMatch = twitter.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/);
      const username = twitterMatch ? twitterMatch[1] : twitter;
      const twitterUrl = twitter.startsWith('http') ? twitter : `https://x.com/${username}`;

      socials.push(
        <a
          key="twitter"
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-300 hover:text-gray-200 transition-colors"
        >
          @{username}
        </a>
      );
    }

    if (github) {
      const githubMatch = github.match(/github\.com\/([A-Za-z0-9-]+)/);
      const username = githubMatch ? githubMatch[1] : github;
      const githubUrl = github.startsWith('http') ? github : `https://github.com/${username}`;

      if (socials.length > 0) {
        socials.push(<span key="separator" className="text-gray-300">, </span>);
      }

      socials.push(
        <a
          key="github"
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-300 hover:text-gray-200 transition-colors"
        >
          gh:{username}
        </a>
      );
    }

    return socials.length > 0 ? <>{socials}</> : <span className="text-gray-300">-</span>;
  };

  const CopyIcon = () => (
    <svg
      className="w-4 h-4 inline-block ml-1 align-middle mb-[2px]"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );

  const CheckIcon = () => (
    <svg
      className="w-4 h-4 inline-block ml-1 align-middle mb-[2px]"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );

  return (
    <div
      onClick={onClick}
      className={`bg-zinc-900/30 border border-gray-800 rounded-xl p-6 transition-colors ${
        onClick ? 'hover:bg-gray-900/50 cursor-pointer' : ''
      }`}
    >
      <div className="flex gap-6">
        {/* Token Image */}
        <div className="flex-shrink-0">
          {metadata?.image ? (
            <img
              src={metadata.image}
              alt={tokenName || 'Token'}
              className="w-24 h-24 rounded-lg object-cover"
            />
          ) : (
            <div className="w-24 h-24 bg-gray-800 rounded-lg flex items-center justify-center">
              <span className="text-gray-300 text-xs">No image</span>
            </div>
          )}
        </div>

        {/* Token Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-xl font-bold text-[#F7FCFE]">
                  {tokenName || '-'}
                </h3>
                <span className="text-gray-300 font-medium">
                  {tokenSymbol || '-'}
                </span>
                {marketCap !== undefined && (
                  <span className="text-sm text-green-400 font-semibold">
                    {formatMarketCap(marketCap)}
                  </span>
                )}
                {status && (
                  <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded font-medium">
                    {status.toUpperCase()}
                  </span>
                )}
                {isCreator && (
                  <Link
                    href="/manage"
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-1 text-sm bg-[#F7FCFE] text-black font-semibold rounded hover:bg-gray-200 transition-colors"
                  >
                    Manage
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                {launchTime && (
                  <span className="text-gray-300">
                    {formatTime(launchTime)}
                  </span>
                )}
                <button
                  onClick={(e) => handleCopyAddress(e)}
                  className="flex items-center gap-1 text-gray-300 hover:text-gray-200 transition-colors"
                >
                  <span className="font-mono">
                    {formatAddress(tokenAddress)}
                  </span>
                  {copiedAddress ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            </div>

            {/* Links */}
            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
              {metadata?.website && (
                <a
                  href={metadata.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-[#F7FCFE] transition-colors"
                  title="Website"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </a>
              )}
              {metadata?.twitter && (
                <a
                  href={metadata.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-[#F7FCFE] transition-colors"
                  title="Twitter"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Description */}
          {metadata?.description && (
            <p className="text-gray-300 text-sm">{metadata.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
