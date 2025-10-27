'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ZCombinatorLogo from '@/components/ZCombinatorLogo';
import { Navigation } from '@/components/Navigation';

export default function Home() {
  const [showGradients, setShowGradients] = useState(false);
  const [heroOffset, setHeroOffset] = useState(0);
  const [logoOffset, setLogoOffset] = useState(0);
  const [logoSize, setLogoSize] = useState('h-[40rem]');
  const [currentCard, setCurrentCard] = useState(0);
  const [heroReady, setHeroReady] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  const aiWorkers = [
    {
      title: 'GVQ',
      subtitle: 'ZC1',
      skills: ['Scout founder', 'Bagscreener founder', 'Scannoors member', 'Ex TradFi quant'],
      apps: ['slack', 'microsoft', 'teams', 'chrome', 'jira', 'teams'],
      twitter: 'https://x.com/GVQ_xx',
      pfp: '/gvq-pfp.jpg'
    },
    {
      title: 'Oogway',
      subtitle: 'ZC1',
      skills: ['Percent founder', '$oogway founder', 'Ex OlympusDAO policy team', 'Ex TradFi investment banking'],
      apps: ['quickbooks', 'zapier', 'discord', 'kubernetes', 'slack', 'teams', 'github', 'docusign'],
      twitter: 'https://x.com/oogway_defi',
      pfp: '/oogway-pfp.jpg'
    },
    {
      title: 'Aelix',
      subtitle: 'ZC1',
      skills: ['Percent co-founder', '$oogway co-founder', 'CS+Math+Phil at Duke', 'Ex SWE at AWS Cloud'],
      apps: ['jira', 'spotify', 'slack', 'teams'],
      twitter: 'https://x.com/waniak_',
      pfp: '/aelix-pfp.jpg'
    },
    {
      title: 'You',
      subtitle: 'ZC1',
      skills: ['Building DeFi protocols', 'Smart contract optimization', 'Cross-chain bridging'],
      apps: ['notion', 'kubernetes', 'slack', 'teams', 'discord', 'docusign', 'spotify'],
      twitter: undefined,
      pfp: '/z-pfp.jpg'
    },
    {
      title: 'You',
      subtitle: 'ZC1',
      skills: ['NFT marketplace development', 'Token economics design', 'Community governance'],
      apps: ['quickbooks', 'excel', 'slack', 'teams'],
      twitter: undefined,
      pfp: '/z-pfp.jpg'
    },
    {
      title: 'You',
      subtitle: 'ZC1',
      skills: ['Layer 2 scaling solutions', 'MEV protection systems', 'Wallet integration'],
      apps: ['hubspot', 'canva', 'google', 'slack', 'teams'],
      twitter: undefined,
      pfp: '/z-pfp.jpg'
    },
    {
      title: 'You',
      subtitle: 'ZC1',
      skills: ['Solidity development', 'Protocol auditing', 'Gas optimization'],
      apps: ['salesforce', 'hubspot', 'linkedin', 'slack', 'teams'],
      twitter: undefined,
      pfp: '/z-pfp.jpg'
    },
    {
      title: 'You',
      subtitle: 'ZC1',
      skills: ['Decentralized identity systems', 'ZK proof implementation', 'Oracle integration'],
      apps: ['docusign', 'adobe', 'dropbox', 'slack', 'teams'],
      twitter: undefined,
      pfp: '/z-pfp.jpg'
    },
    {
      title: 'You',
      subtitle: 'ZC1',
      skills: ['DAO tooling', 'Staking mechanisms', 'Liquidity mining strategies'],
      apps: ['github', 'jira', 'kubernetes', 'docker', 'slack'],
      twitter: undefined,
      pfp: '/z-pfp.jpg'
    },
    {
      title: 'You',
      subtitle: 'ZC1',
      skills: ['On-chain analytics', 'AMM development', 'Tokenomics modeling'],
      apps: ['zendesk', 'intercom', 'slack', 'teams', 'notion'],
      twitter: undefined,
      pfp: '/z-pfp.jpg'
    }
  ];

  const scrollCarouselRight = () => {
    if (carouselRef.current && currentCard < aiWorkers.length - 1) {
      const nextIndex = currentCard + 1;
      setCurrentCard(nextIndex);
      const cardWidth = window.innerWidth < 640 ? 386 : 426; // Mobile: 360px + 26px gap, Desktop: 400px + 26px gap
      carouselRef.current.scrollTo({
        left: nextIndex * cardWidth,
        behavior: 'smooth'
      });
    }
  };

  const scrollCarouselLeft = () => {
    if (carouselRef.current && currentCard > 0) {
      const prevIndex = currentCard - 1;
      setCurrentCard(prevIndex);
      const cardWidth = window.innerWidth < 640 ? 386 : 426; // Mobile: 360px + 26px gap, Desktop: 400px + 26px gap
      carouselRef.current.scrollTo({
        left: prevIndex * cardWidth,
        behavior: 'smooth'
      });
    }
  };

  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCarouselScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (carouselRef.current) {
        const scrollLeft = carouselRef.current.scrollLeft;
        const scrollWidth = carouselRef.current.scrollWidth;
        const clientWidth = carouselRef.current.clientWidth;
        const cardWidth = window.innerWidth < 640 ? 386 : 426; // Mobile: 360px + 26px gap, Desktop: 400px + 26px gap

        // Calculate which card is currently in view
        let newIndex = Math.round(scrollLeft / cardWidth);

        // Check if we're at the very start
        if (scrollLeft <= 10) {
          newIndex = 0;
        }
        // Check if we're at the very end
        else if (scrollLeft + clientWidth >= scrollWidth - 10) {
          newIndex = aiWorkers.length - 1;
        }

        setCurrentCard(newIndex);
      }
    }, 50); // Debounce by 50ms
  }, [aiWorkers.length]);

  useEffect(() => {
    // Scroll to top on page load
    window.scrollTo(0, 0);

    // Calculate viewport height minus header and some padding
    const calculateHeroPosition = () => {
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const headerHeight = 200; // Approximate header + announcement height
      const textHeight = 180; // Adjusted for two title lines + subheader + button
      setHeroOffset(viewportHeight - headerHeight - 100 - textHeight); // Adjust for all text

      // Calculate dynamic logo size based on viewport
      // Base size is 40rem (640px) for 1512x982 viewport
      // Use average of width and height scaling for better responsiveness
      const widthScale = viewportWidth / 1512;
      const heightScale = viewportHeight / 982;
      const scaleFactor = (widthScale + heightScale) / 2; // Average for balanced scaling
      const baseLogoHeight = 640;
      const logoHeight = Math.max(320, Math.min(2400, baseLogoHeight * scaleFactor)); // Increased max to 150rem

      console.log('Viewport:', viewportWidth, 'x', viewportHeight);
      console.log('Scale factor:', scaleFactor);
      console.log('Logo height:', logoHeight);

      // Set logo size class based on calculated height
      if (logoHeight <= 400) {
        setLogoSize('h-[25rem]');
      } else if (logoHeight <= 480) {
        setLogoSize('h-[30rem]');
      } else if (logoHeight <= 560) {
        setLogoSize('h-[35rem]');
      } else if (logoHeight <= 640) {
        setLogoSize('h-[40rem]');
      } else if (logoHeight <= 720) {
        setLogoSize('h-[45rem]');
      } else if (logoHeight <= 800) {
        setLogoSize('h-[50rem]');
      } else if (logoHeight <= 880) {
        setLogoSize('h-[55rem]');
      } else if (logoHeight <= 960) {
        setLogoSize('h-[60rem]');
      } else if (logoHeight <= 1040) {
        setLogoSize('h-[65rem]');
      } else if (logoHeight <= 1120) {
        setLogoSize('h-[70rem]');
      } else if (logoHeight <= 1200) {
        setLogoSize('h-[75rem]');
      } else if (logoHeight <= 1280) {
        setLogoSize('h-[80rem]');
      } else if (logoHeight <= 1360) {
        setLogoSize('h-[85rem]');
      } else if (logoHeight <= 1440) {
        setLogoSize('h-[90rem]');
      } else if (logoHeight <= 1520) {
        setLogoSize('h-[95rem]');
      } else if (logoHeight <= 1600) {
        setLogoSize('h-[100rem]');
      } else if (logoHeight <= 1760) {
        setLogoSize('h-[110rem]');
      } else if (logoHeight <= 1920) {
        setLogoSize('h-[120rem]');
      } else if (logoHeight <= 2080) {
        setLogoSize('h-[130rem]');
      } else if (logoHeight <= 2240) {
        setLogoSize('h-[140rem]');
      } else {
        setLogoSize('h-[150rem]');
      }

      // Calculate logo position - bottom aligned
      setLogoOffset(viewportHeight - headerHeight - logoHeight);

      // Mark hero as ready after calculations
      setHeroReady(true);
    };

    calculateHeroPosition();
    window.addEventListener('resize', calculateHeroPosition);

    const handleScroll = () => {
      setShowGradients(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', calculateHeroPosition);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#000000]">
      {/* Main Content */}
      <main className="px-0 sm:px-4 relative">
        <div className="bg-[#141414] min-h-screen text-[#F7FCFE] rounded-none sm:rounded-4xl relative">
          {/* Sticky Header */}
          <div className="sticky top-0 sm:top-4 z-40 rounded-none sm:rounded-t-4xl" style={{background: showGradients ? 'linear-gradient(to bottom, #141414 0%, #141414 50%, transparent 100%)' : '#141414'}}>
            <div className="px-8 py-12 sm:px-8">
              <h1>
                <div className="hidden sm:block">
                  <ZCombinatorLogo />
                </div>
                <Image
                  src="/logos/z-logo-white.png"
                  alt="Z"
                  width={40}
                  height={40}
                  className="h-10 w-auto block sm:hidden"
                />
              </h1>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC');
                }}
                className="flex items-center gap-2 px-0 py-1 mt-3 transition-opacity hover:opacity-70 group"
              >
                <code className="text-sm text-[#F7FCFE] font-mono">GVvPZp...Lh6jZC</code>
                <svg className="w-4 h-4 text-[#F7FCFE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <a
                href="https://github.com/zcombinatorio/zcombinator"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-0 py-1 mt-2 transition-opacity hover:opacity-70"
              >
                <svg className="w-4 h-4 text-[#F7FCFE]" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-[#F7FCFE]">GitHub</span>
              </a>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="relative" style={{ minHeight: heroReady ? 'auto' : '100vh' }}>
            {/* Gradient overlay that covers content */}
            {showGradients && (
              <div className="fixed top-0 left-0 right-0 h-32 sm:h-64 bg-gradient-to-b from-black to-transparent pointer-events-none z-30"></div>
            )}
            <div className="px-8 pb-16 sm:px-12 sm:pb-24 relative" style={{ visibility: heroReady ? 'visible' : 'hidden' }}>
              {/* Logo positioned on right side - desktop only */}
              <div className="hidden sm:block absolute right-8 sm:right-12 transition-all duration-300 z-10" style={{ top: `${logoOffset}px` }}>
                <Image
                  key={logoSize}
                  src="/logos/z-logo-lp.png"
                  alt="Z Logo"
                  width={1200}
                  height={1200}
                  className={`${logoSize} w-auto transition-all duration-300`}
                  priority
                />
              </div>

              {/* Hero Text positioned at bottom of initial viewport */}
              <div className="max-w-4xl relative z-20">
                <div style={{ paddingTop: `${heroOffset}px`, opacity: heroReady ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }} className="hidden sm:block">
                  <h2 className="text-6xl font-bold text-[#F7FCFE]">Instant distribution</h2>
                  <h2 className="text-6xl font-bold text-[#F7FCFE]">for your product</h2>
                  <p className="text-xl text-[#CDCCCB] mt-4 mb-6">Use tokens to bootstrap attention and reward real users.</p>
                  <Link href="/launch" className="bg-[#F7FCFE] text-black px-10 py-4 rounded-full font-bold text-lg hover:opacity-90 transition-opacity mb-48 inline-block">
                    LAUNCH
                  </Link>
                </div>
                {/* Mobile version with logo above text */}
                <div className="block sm:hidden" style={{ paddingTop: `${Math.max(heroOffset - 500, 24)}px`, opacity: heroReady ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}>
                  <Image
                    src="/logos/z-logo-lp.png"
                    alt="Z Logo"
                    width={600}
                    height={600}
                    className="w-full h-auto mb-8"
                    priority
                  />
                  <h2 className="text-6xl font-bold text-[#F7FCFE]">Instant distribution</h2>
                  <h2 className="text-6xl font-bold text-[#F7FCFE]">for your product</h2>
                  <p className="text-xl text-[#CDCCCB] mt-4 mb-6">Use tokens to bootstrap attention and reward real users.</p>
                  <Link href="/launch" className="bg-[#F7FCFE] text-black px-10 py-1 rounded-full font-bold text-lg hover:opacity-90 transition-opacity mb-48 inline-block">
                    LAUNCH
                  </Link>
                </div>
              </div>

              {/* Features Section */}
              <div>
                <div>
                  <h2 className="text-4xl font-bold mb-4">Token launchpads are broken.</h2>
                  <p className="text-xl text-gray-300 mb-20">
                    <span><strong>Fixed supply</strong> and <strong>volume-based rewards</strong> incentivize short term building and investing.</span> This leads developers to:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-24">
                    <div className="flex items-center gap-4">
                      <svg className="w-10 h-10 flex-shrink-0 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      <p className="text-xl text-gray-300">Bundle supply, maximize volume, then dump their tokens</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <svg className="w-10 h-10 flex-shrink-0 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                      </svg>
                      <p className="text-xl text-gray-300">Struggle to fund themselves</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <svg className="w-10 h-10 flex-shrink-0 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                      <p className="text-xl text-gray-300">Chase attention instead of building</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <svg className="w-10 h-10 flex-shrink-0 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </svg>
                      <p className="text-xl text-gray-300">Abandon projects they have no meaningful stake in</p>
                    </div>
                  </div>
                  <h2 className="text-4xl font-bold mb-4 mt-12">Z Combinator fixes this.</h2>

                  {/* Sticky Cards Container */}
                  <div className="mt-20 relative">
                    {/* First Card - Autonomously picks up tasks */}
                    <div className="relative sm:sticky sm:top-48 bg-[#141414] z-0 py-12 border-t border-white">
                      <div className="flex flex-col sm:flex-row items-start gap-8">
                        <div className="flex-1">
                          <h3 className="text-4xl font-semibold mb-4">No fees.</h3>
                          <p className="text-xl text-gray-300 mb-4">
                            Tokens launched on Z Combinator have <strong>0 platform fees</strong>, compared to over 2% on some other launchpads. A better world for traders is a better world for devs.
                          </p>
                          <p className="text-xl text-gray-300">
                            All Z Combinator tokens have an initial supply of 1 billion tokens, and are immediately tradable on a bonding curve. When enough liquidity is raised, it migrates to a normal AMM that also has <strong>0 trading fees</strong>.
                          </p>
                        </div>
                        <div className="flex-1 w-full sm:w-auto">
                          {/* Static SOL tokens visualization */}
                          <div className="w-full aspect-[5/4] bg-[#2B2B2A] rounded-lg relative overflow-hidden">
                            <svg
                              viewBox="0 0 400 320"
                              className="w-full h-full"
                              preserveAspectRatio="xMidYMid meet"
                            >
                              {/* Define grayscale filter */}
                              <defs>
                                <filter id="grayscale">
                                  <feColorMatrix
                                    type="matrix"
                                    values="0.33 0.33 0.33 0 0
                                            0.33 0.33 0.33 0 0
                                            0.33 0.33 0.33 0 0
                                            0 0 0 1 0"/>
                                </filter>
                              </defs>

                              {/* Static SOL tokens positioned across the canvas */}
                              <image href="/sol-token-1.png" x="40" y="80" width="25" height="25" filter="url(#grayscale)" opacity="0.7" />
                              <image href="/sol-token-2.png" x="120" y="120" width="28" height="28" filter="url(#grayscale)" opacity="0.8" />
                              <image href="/sol-token-3.png" x="200" y="60" width="22" height="22" filter="url(#grayscale)" opacity="0.6" />
                              <image href="/sol-token-1.png" x="280" y="100" width="26" height="26" filter="url(#grayscale)" opacity="0.75" />
                              <image href="/sol-token-2.png" x="90" y="180" width="24" height="24" filter="url(#grayscale)" opacity="0.65" />
                              <image href="/sol-token-3.png" x="170" y="200" width="27" height="27" filter="url(#grayscale)" opacity="0.85" />
                              <image href="/sol-token-1.png" x="250" y="170" width="23" height="23" filter="url(#grayscale)" opacity="0.7" />
                              <image href="/sol-token-2.png" x="330" y="140" width="25" height="25" filter="url(#grayscale)" opacity="0.6" />
                              <image href="/sol-token-3.png" x="60" y="240" width="20" height="20" filter="url(#grayscale)" opacity="0.5" />
                              <image href="/sol-token-1.png" x="150" y="140" width="30" height="30" filter="url(#grayscale)" opacity="0.9" />
                              <image href="/sol-token-2.png" x="320" y="220" width="22" height="22" filter="url(#grayscale)" opacity="0.55" />
                              <image href="/sol-token-3.png" x="220" y="250" width="18" height="18" filter="url(#grayscale)" opacity="0.45" />
                              <image href="/sol-token-1.png" x="360" y="80" width="21" height="21" filter="url(#grayscale)" opacity="0.5" />
                              <image href="/sol-token-2.png" x="20" y="150" width="26" height="26" filter="url(#grayscale)" opacity="0.7" />
                              <image href="/sol-token-3.png" x="300" y="40" width="19" height="19" filter="url(#grayscale)" opacity="0.4" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Spacer for scroll - desktop only */}
                    <div className="hidden sm:block h-[400px]"></div>

                    {/* Second Card - Orchestrates multiple AI agents */}
                    <div className="relative sm:sticky sm:top-48 bg-[#141414] z-0 py-12 border-t border-white">
                      <div className="flex flex-col sm:flex-row items-start gap-8">
                        <div className="flex-1">
                          <h3 className="text-4xl font-semibold mb-4">Programmatic supply minting.</h3>
                          <p className="text-xl text-gray-300 mb-4">
                            Instead, the protocol mints 1M tokens every 24 hours to the builder. <strong><em>Builders cannot mint tokens themselves, preventing rugs.</em></strong>
                          </p>
                          <p className="text-xl text-gray-300">
                            This ensures builders are rewarded when market cap increases, not volume, while continually having funding to keep building for the long term.
                          </p>
                        </div>
                        <div className="flex-1 w-full sm:w-auto">
                          {/* Static clock images */}
                          <div className="bg-[#2B2B2A] rounded-2xl w-full aspect-[5/4] relative overflow-hidden flex items-center justify-center">
                            {/* Background smaller clocks */}
                            <Image
                              src="/clock.png"
                              alt=""
                              width={100}
                              height={100}
                              className="absolute top-[10%] left-[15%] w-[10%] h-[10%] object-contain grayscale opacity-30"
                            />
                            <Image
                              src="/clock.png"
                              alt=""
                              width={100}
                              height={100}
                              className="absolute top-[20%] right-[10%] w-[15%] h-[15%] object-contain grayscale opacity-40"
                            />
                            <Image
                              src="/clock.png"
                              alt=""
                              width={100}
                              height={100}
                              className="absolute bottom-[25%] left-[8%] w-[12%] h-[12%] object-contain grayscale opacity-25"
                            />
                            <Image
                              src="/clock.png"
                              alt=""
                              width={100}
                              height={100}
                              className="absolute bottom-[15%] right-[20%] w-[8%] h-[8%] object-contain grayscale opacity-35"
                            />
                            <Image
                              src="/clock.png"
                              alt=""
                              width={100}
                              height={100}
                              className="absolute top-[5%] left-[45%] w-[6%] h-[6%] object-contain grayscale opacity-20"
                            />
                            <Image
                              src="/clock.png"
                              alt=""
                              width={100}
                              height={100}
                              className="absolute bottom-[10%] left-[30%] w-[9%] h-[9%] object-contain grayscale opacity-45"
                            />
                            <Image
                              src="/clock.png"
                              alt=""
                              width={100}
                              height={100}
                              className="absolute top-[35%] right-[5%] w-[7%] h-[7%] object-contain grayscale opacity-30"
                            />
                            <Image
                              src="/clock.png"
                              alt=""
                              width={100}
                              height={100}
                              className="absolute bottom-[5%] right-[45%] w-[11%] h-[11%] object-contain grayscale opacity-25"
                            />

                            {/* Main clock in center */}
                            <Image
                              src="/clock.png"
                              alt="24h programmatic minting"
                              width={200}
                              height={200}
                              className="w-1/2 h-1/2 object-contain grayscale relative z-10"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Spacer for scroll - desktop only */}
                    <div className="hidden sm:block h-[400px]"></div>

                    {/* Third Card - Placeholder */}
                    <div className="relative sm:sticky sm:top-48 bg-[#141414] z-0 py-12 border-t border-white">
                      <div className="flex flex-col sm:flex-row items-start gap-8">
                        <div className="flex-1">
                          <h3 className="text-4xl font-semibold mb-4">Manage new mints.</h3>
                          <p className="text-xl text-gray-300 mb-4">
                            Builders can easily claim newly minted supply, track and reward contributions, and host their community.
                          </p>
                          <p className="text-xl text-gray-300">
                            With controlled, consistent token emissions, the best builders will use their tokens to incentivize sustainable product growth without scaring off traders.
                          </p>
                        </div>
                        <div className="flex-1 w-full sm:w-auto">
                          {/* Token Distribution Network visualization */}
                          <div className="w-full aspect-[5/4] bg-[#2B2B2A] rounded-lg relative overflow-hidden">
                            <svg
                              viewBox="0 0 400 320"
                              className="w-full h-full"
                              preserveAspectRatio="xMidYMid meet"
                            >
                              {/* Define grayscale gradient for tokens */}
                              <defs>
                                <radialGradient id="tokenGradient1">
                                  <stop offset="0%" stopColor="#E8E8E8" stopOpacity="0.7" />
                                  <stop offset="100%" stopColor="#A0A0A0" stopOpacity="0.7" />
                                </radialGradient>
                                <radialGradient id="tokenGradient2">
                                  <stop offset="0%" stopColor="#D0D0D0" stopOpacity="0.6" />
                                  <stop offset="100%" stopColor="#909090" stopOpacity="0.6" />
                                </radialGradient>
                                <radialGradient id="tokenGradientCenter">
                                  <stop offset="0%" stopColor="#F0F0F0" stopOpacity="0.9" />
                                  <stop offset="100%" stopColor="#B0B0B0" stopOpacity="0.9" />
                                </radialGradient>

                                <style>
                                  {`
                                    @keyframes flowDot1 { 0%, 100% { offset-distance: 0%; opacity: 0; } 10% { opacity: 0.8; } 90% { opacity: 0.8; } 100% { offset-distance: 100%; opacity: 0; } }
                                    @keyframes flowDot2 { 0%, 100% { offset-distance: 0%; opacity: 0; } 10% { opacity: 0.8; } 90% { opacity: 0.8; } 100% { offset-distance: 100%; opacity: 0; } }
                                    @keyframes flowDot3 { 0%, 100% { offset-distance: 0%; opacity: 0; } 10% { opacity: 0.8; } 90% { opacity: 0.8; } 100% { offset-distance: 100%; opacity: 0; } }
                                    @keyframes pulse1 { 0%, 100% { r: 16px; } 50% { r: 18px; } }
                                    @keyframes pulse2 { 0%, 100% { r: 13px; } 50% { r: 15px; } }
                                    @keyframes pulse3 { 0%, 100% { r: 18px; } 50% { r: 20px; } }
                                    @keyframes pulse4 { 0%, 100% { r: 14px; } 50% { r: 16px; } }
                                    @keyframes pulse5 { 0%, 100% { r: 11px; } 50% { r: 13px; } }
                                    @keyframes pulse6 { 0%, 100% { r: 15px; } 50% { r: 17px; } }
                                    @keyframes pulse7 { 0%, 100% { r: 9px; } 50% { r: 11px; } }
                                    @keyframes pulse8 { 0%, 100% { r: 12px; } 50% { r: 14px; } }
                                    @keyframes pulse9 { 0%, 100% { r: 13px; } 50% { r: 15px; } }
                                    @keyframes pulse10 { 0%, 100% { r: 8px; } 50% { r: 10px; } }
                                    @keyframes pulse11 { 0%, 100% { r: 7px; } 50% { r: 9px; } }
                                    @keyframes pulse12 { 0%, 100% { r: 10px; } 50% { r: 12px; } }
                                    @keyframes pulseCenter { 0%, 100% { r: 25px; } 50% { r: 27px; } }
                                    .flow-dot-1 { animation: flowDot1 3s ease-in-out infinite; }
                                    .flow-dot-2 { animation: flowDot2 3.5s ease-in-out infinite 0.5s; }
                                    .flow-dot-3 { animation: flowDot3 4s ease-in-out infinite 1s; }
                                    .flow-dot-4 { animation: flowDot1 3.2s ease-in-out infinite 1.5s; }
                                    .flow-dot-5 { animation: flowDot2 3.8s ease-in-out infinite 2s; }
                                    .flow-dot-6 { animation: flowDot3 3.3s ease-in-out infinite 0.3s; }
                                    .flow-dot-7 { animation: flowDot1 3.6s ease-in-out infinite 1.2s; }
                                    .flow-dot-8 { animation: flowDot2 3.4s ease-in-out infinite 0.8s; }
                                    .flow-dot-9 { animation: flowDot3 3.9s ease-in-out infinite 1.8s; }
                                    .flow-dot-10 { animation: flowDot1 3.7s ease-in-out infinite 2.3s; }
                                    .flow-dot-11 { animation: flowDot2 3.1s ease-in-out infinite 0.6s; }
                                    .flow-dot-12 { animation: flowDot3 4.1s ease-in-out infinite 1.4s; }
                                    .pulse-1 { animation: pulse1 2.5s ease-in-out infinite; }
                                    .pulse-2 { animation: pulse2 3s ease-in-out infinite 0.5s; }
                                    .pulse-3 { animation: pulse3 2.8s ease-in-out infinite 1s; }
                                    .pulse-4 { animation: pulse4 3.2s ease-in-out infinite 0.3s; }
                                    .pulse-5 { animation: pulse5 2.6s ease-in-out infinite 1.5s; }
                                    .pulse-6 { animation: pulse6 3.1s ease-in-out infinite 0.8s; }
                                    .pulse-7 { animation: pulse7 2.9s ease-in-out infinite 1.2s; }
                                    .pulse-8 { animation: pulse8 3.3s ease-in-out infinite 0.2s; }
                                    .pulse-9 { animation: pulse9 2.7s ease-in-out infinite 1.8s; }
                                    .pulse-10 { animation: pulse10 3.4s ease-in-out infinite 0.6s; }
                                    .pulse-11 { animation: pulse11 2.4s ease-in-out infinite 1.3s; }
                                    .pulse-12 { animation: pulse12 3.5s ease-in-out infinite 0.4s; }
                                    .pulse-center { animation: pulseCenter 4s ease-in-out infinite; }
                                  `}
                                </style>
                              </defs>

                              {/* Connection lines from center to outer nodes */}
                              <line x1="200" y1="160" x2="75" y2="65" stroke="#666" strokeWidth="1" opacity="0.3" />
                              <line x1="200" y1="160" x2="330" y2="95" stroke="#666" strokeWidth="1" opacity="0.25" />
                              <line x1="200" y1="160" x2="65" y2="220" stroke="#666" strokeWidth="1" opacity="0.35" />
                              <line x1="200" y1="160" x2="310" y2="235" stroke="#666" strokeWidth="1" opacity="0.3" />
                              <line x1="200" y1="160" x2="125" y2="50" stroke="#666" strokeWidth="1" opacity="0.2" />
                              <line x1="200" y1="160" x2="280" y2="70" stroke="#666" strokeWidth="1" opacity="0.25" />
                              <line x1="200" y1="160" x2="150" y2="270" stroke="#666" strokeWidth="1" opacity="0.28" />
                              <line x1="200" y1="160" x2="345" y2="180" stroke="#666" strokeWidth="1" opacity="0.3" />
                              <line x1="200" y1="160" x2="50" y2="145" stroke="#666" strokeWidth="1" opacity="0.25" />
                              <line x1="200" y1="160" x2="245" y2="270" stroke="#666" strokeWidth="1" opacity="0.22" />
                              <line x1="200" y1="160" x2="175" y2="95" stroke="#666" strokeWidth="1" opacity="0.18" />
                              <line x1="200" y1="160" x2="115" y2="185" stroke="#666" strokeWidth="1" opacity="0.2" />

                              {/* Animated flowing dots along connection lines */}
                              <circle r="3" fill="#CCC" className="flow-dot-1">
                                <animateMotion dur="3s" repeatCount="indefinite" path="M 200 160 L 75 65" />
                              </circle>
                              <circle r="3" fill="#CCC" className="flow-dot-2">
                                <animateMotion dur="3.5s" repeatCount="indefinite" begin="0.5s" path="M 200 160 L 330 95" />
                              </circle>
                              <circle r="3" fill="#CCC" className="flow-dot-3">
                                <animateMotion dur="4s" repeatCount="indefinite" begin="1s" path="M 200 160 L 65 220" />
                              </circle>
                              <circle r="3" fill="#CCC" className="flow-dot-4">
                                <animateMotion dur="3.2s" repeatCount="indefinite" begin="1.5s" path="M 200 160 L 310 235" />
                              </circle>
                              <circle r="3" fill="#CCC" className="flow-dot-5">
                                <animateMotion dur="3.8s" repeatCount="indefinite" begin="2s" path="M 200 160 L 125 50" />
                              </circle>
                              <circle r="3" fill="#CCC" className="flow-dot-6">
                                <animateMotion dur="3.3s" repeatCount="indefinite" begin="0.3s" path="M 200 160 L 280 70" />
                              </circle>

                              {/* Outer token nodes with varied sizes, positions, and pulsing animation */}
                              <circle cx="75" cy="65" r="16" fill="url(#tokenGradient1)" className="pulse-1" />
                              <circle cx="330" cy="95" r="13" fill="url(#tokenGradient2)" className="pulse-2" />
                              <circle cx="65" cy="220" r="18" fill="url(#tokenGradient1)" className="pulse-3" />
                              <circle cx="310" cy="235" r="14" fill="url(#tokenGradient1)" className="pulse-4" />
                              <circle cx="50" cy="145" r="11" fill="url(#tokenGradient2)" className="pulse-5" />
                              <circle cx="345" cy="180" r="15" fill="url(#tokenGradient2)" className="pulse-6" />
                              <circle cx="125" cy="50" r="9" fill="url(#tokenGradient2)" className="pulse-7" />
                              <circle cx="280" cy="70" r="12" fill="url(#tokenGradient2)" className="pulse-8" />
                              <circle cx="150" cy="270" r="13" fill="url(#tokenGradient2)" className="pulse-9" />
                              <circle cx="245" cy="270" r="8" fill="url(#tokenGradient2)" className="pulse-10" />
                              <circle cx="175" cy="95" r="7" fill="url(#tokenGradient2)" className="pulse-11" />
                              <circle cx="115" cy="185" r="10" fill="url(#tokenGradient2)" className="pulse-12" />

                              {/* Central hub token (larger) with pulsing animation */}
                              <circle cx="200" cy="160" r="25" fill="url(#tokenGradientCenter)" className="pulse-center" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Spacer for scroll - desktop only */}
                    <div className="hidden sm:block h-[400px]"></div>
                  </div>
                </div>
              </div>

              {/* Constrained content from mission statement onwards */}
              <div className="max-w-[1600px] mx-auto mt-48">
                {/* Mission Statement - Full Width */}
                <div className="w-full">
                <p className="text-4xl font-semibold text-[#F7FCFE] leading-tight">
                  Z Combinator enables token launches that align builders and holders via time-controlled token emissions.
                </p>
                <div className="bg-[#2B2B2A] rounded-xl p-8 mt-12 flex items-center justify-center relative mb-24">
                  <div className="relative w-full">
                    <Image src="/banner.png" alt="ZC Community" width={1920} height={1080} className="w-full h-auto object-contain rounded-lg" />
                    {/* Gradient overlays for fade effect */}
                    <div className="absolute inset-0 rounded-lg pointer-events-none"
                         style={{
                           background: `
                             radial-gradient(ellipse at center, transparent 40%, #2B2B2A 90%),
                             linear-gradient(to right, #2B2B2A 0%, transparent 15%, transparent 85%, #2B2B2A 100%),
                             linear-gradient(to bottom, #2B2B2A 0%, transparent 15%, transparent 85%, #2B2B2A 100%)
                           `
                         }}>
                    </div>
                  </div>
                </div>
              </div>

              <div className="max-w-[1600px] mx-auto">
                {/* First class of builders section */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mt-36">
                  <h3 className="text-4xl font-semibold text-[#F7FCFE] lg:col-span-2">
                    The first class of ZC builders.
                  </h3>
                  <p className="text-xl text-gray-300 lg:col-span-3">
                    These devs are proving that tokens can be used to their full potential to quickly bootstrap network effects and invalidate their ideas, laying the foundation for a new class of builders.
                  </p>
                </div>

                {/* Dev Carousel */}
                <div className="relative mt-16">
                  <div className="relative">
                    {/* Gradient overlays for fade effect */}
                    {currentCard > 0 && (
                      <div className="absolute left-0 -top-4 -bottom-4 w-12 sm:w-32 bg-gradient-to-r from-[#141414] to-transparent z-20 pointer-events-none"></div>
                    )}
                    {currentCard < aiWorkers.length - 1 && (
                      <div className="absolute right-0 -top-4 -bottom-4 w-12 sm:w-32 bg-gradient-to-l from-[#141414] to-transparent z-20 pointer-events-none"></div>
                    )}

                    {/* Carousel container */}
                    <div
                      ref={carouselRef}
                      className="flex gap-6 overflow-x-auto overflow-y-visible scrollbar-hide scroll-smooth py-4"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      onScroll={handleCarouselScroll}
                    >
                      {aiWorkers.map((worker, index) => (
                        <div
                          key={index}
                          className="flex-shrink-0 w-[360px] sm:w-[400px] min-h-[250px] bg-[#2B2B2A] rounded-2xl relative overflow-visible sm:overflow-hidden transition-transform duration-300 hover:scale-105"
                        >
                          <div className={`flex h-full ${worker.title === 'You' ? 'blur-sm' : ''}`}>
                            {/* Main content area */}
                            <div className="p-6 flex-1 relative z-10">
                              {/* Card header */}
                              <div className="mb-6">
                                <div className="flex items-center gap-3">
                                  <h4 className="text-xl font-semibold text-[#F7FCFE]">{worker.title}</h4>
                                  {worker.twitter && (
                                    <a
                                      href={worker.twitter}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-gray-300 hover:text-[#F7FCFE] transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                      </svg>
                                    </a>
                                  )}
                                </div>
                                <p className="text-sm text-gray-300-temp">{worker.subtitle}</p>
                              </div>

                              {/* Bio section */}
                              <div className="mb-6">
                                <div className="mb-3">
                                  <span className="text-xs text-gray-300-temp uppercase tracking-wider">Bio</span>
                                </div>
                                <div className="space-y-2 relative z-20">
                                  {worker.skills.map((skill, skillIndex) => (
                                    <div key={skillIndex} className="text-sm text-gray-300 break-normal">
                                      {skill}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Profile picture with gradient */}
                            {worker.pfp && (
                              <div className="absolute right-0 top-0 h-full w-48">
                                <Image
                                  src={worker.pfp}
                                  alt={`${worker.title} profile`}
                                  width={192}
                                  height={240}
                                  className="w-full h-full object-cover grayscale"
                                  style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                                />
                                <div
                                  className="absolute inset-0"
                                  style={{
                                    background: 'linear-gradient(to right, #2B2B2A 0%, #2B2B2A 20%, rgba(43, 43, 42, 0.8) 40%, rgba(43, 43, 42, 0.3) 60%, transparent 100%)'
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Lock icon and text overlay for "You" cards */}
                          {worker.title === 'You' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                              <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <p className="text-lg font-semibold text-gray-200">TBA</p>
                              <p className="text-sm text-gray-300">(could be you)</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Navigation buttons */}
                  {currentCard > 0 && (
                    <button
                      onClick={scrollCarouselLeft}
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#262626] rounded-full flex items-center justify-center hover:opacity-90 transition-opacity z-20"
                    >
                      <svg className="w-6 h-6 text-[#F7FCFE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  {currentCard < aiWorkers.length - 1 && (
                    <button
                      onClick={scrollCarouselRight}
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#262626] rounded-full flex items-center justify-center hover:opacity-90 transition-opacity z-20"
                    >
                      <svg className="w-6 h-6 text-[#F7FCFE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div>
                {/* What is $ZC? Section */}
                <div className="mt-36">
                  <h2 className="text-4xl font-semibold text-[#F7FCFE] mb-8">What is $ZC?</h2>

                  <p className="text-xl text-gray-300 mb-12">
                    $ZC is the first token launched on Z Combinator. <span className="font-bold">We use the exact same product we&apos;re delivering to all developers on our platform.</span>
                    <br /><br />
                    $ZC represents a stake in all launches on our platform. Z Combinator takes a small portion of all token mints for each launch on the platform, aligning us and all $ZC holders with every developer through shared token ownership.
                    <br /><br />
                    We are using $ZC emissions to continuously reward contributors who launch projects and drive attention, usage, and feedback. Visible, direct rewards pull in more contributors and accelerate growth. Great builders will mirror this with their own daily mints to bootstrap their networks and compress the time it takes to iterate on market feedback.
                    <br /><br />
                    There are four ways to earn emissions right now:
                  </p>

                  {/* Statistics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
                    {/* Stat 1 - Top Left */}
                    <div className="relative py-12 pl-4 pr-8 flex flex-col justify-between h-[280px]">
                      <div className="absolute left-0 top-12 bottom-12 w-[1px] bg-white"></div>
                      <div className="absolute right-0 top-12 bottom-12 w-[1px] bg-white"></div>
                      <p className="text-lg sm:text-2xl text-gray-300-temp uppercase tracking-wider">
                        LAUNCH GOOD PROJECTS
                      </p>
                      <p className="text-[48px] sm:text-[72px] font-light text-white leading-none">
                        +$ZC
                      </p>
                    </div>

                    {/* Stat 2 - Top Right (mobile) / Second (desktop) */}
                    <div className="relative py-12 pl-4 pr-8 flex flex-col justify-between h-[280px]">
                      <div className="hidden sm:block absolute right-0 top-12 bottom-12 w-[1px] bg-white"></div>
                      <p className="text-lg sm:text-2xl text-gray-300-temp uppercase tracking-wider">
                        ONBOARD DEVS
                      </p>
                      <p className="text-[48px] sm:text-[72px] font-light text-white leading-none">
                        +$ZC
                      </p>
                    </div>

                    {/* Stat 3 - Bottom Left (mobile) / Third (desktop) */}
                    <div className="relative py-12 pl-4 pr-8 flex flex-col justify-between h-[280px]">
                      <div className="absolute left-0 top-12 bottom-12 w-[1px] bg-white"></div>
                      <div className="absolute right-0 top-12 bottom-12 w-[1px] bg-white"></div>
                      <p className="text-lg sm:text-2xl text-gray-300-temp uppercase tracking-wider">
                        DRIVE ATTENTION
                      </p>
                      <p className="text-[48px] sm:text-[72px] font-light text-white leading-none">
                        +$ZC
                      </p>
                    </div>

                    {/* Stat 4 - Bottom Right (mobile) / Fourth (desktop) */}
                    <div className="py-12 pl-4 pr-8 flex flex-col justify-between h-[280px]">
                      <p className="text-lg sm:text-2xl text-gray-300-temp uppercase tracking-wider">
                        GIVE GOOD FEEDBACK
                      </p>
                      <p className="text-[48px] sm:text-[72px] font-light text-white leading-none">
                        +$ZC
                      </p>
                    </div>
                  </div>

                  {/* Launch Button */}
                  <div className="flex justify-center mt-12">
                    <Link href="/launch" className="bg-[#F7FCFE] text-black px-10 py-4 rounded-full font-bold text-lg hover:opacity-90 transition-opacity inline-block">
                      LAUNCH
                    </Link>
                  </div>
                </div>
              </div>
              </div>{/* End of max-width wrapper */}
            </div>
          </div>

          {/* Polkadot pattern with gradient fade */}
          <div className="relative w-full h-28 overflow-hidden rounded-4xl">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle, #2B2B2B 1.5px, transparent 1.5px)`,
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 10px 10px',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom, #141414 0%, transparent 60%, transparent 100%)`,
              }}
            />
          </div>
        </div>
      </main>

      <Navigation />
    </div>
  );
}
