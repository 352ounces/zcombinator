'use client';

import React, { useEffect, useState } from 'react';

interface NoFeesNoRewardsStreamProps {
  className?: string;
  tokenColor?: string;
  bgColor?: string;
}

const NoFeesNoRewardsStream: React.FC<NoFeesNoRewardsStreamProps> = ({
  className = '',
  tokenColor = '#38B26C',
  bgColor = '#1B1B1B',
}) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Generate token positions with staggered start times
  const tokens = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    delay: (i * 0.8) + 's',
    yOffset: Math.sin(i * 0.5) * 2, // Slight vertical variation
  }));

  // Valve positions
  const valves = [
    { x: 120, y: 30, side: 'top' },
    { x: 200, y: 30, side: 'top' },
    { x: 320, y: 30, side: 'top' },
    { x: 160, y: 70, side: 'bottom' },
    { x: 280, y: 70, side: 'bottom' },
    { x: 360, y: 70, side: 'bottom' },
  ];

  return (
    <div
      className={`relative w-full h-full ${className}`}
      style={{ backgroundColor: bgColor, borderRadius: '16px' }}
      aria-label="No trading fees nor rewards – value flows without leakage"
    >
      <svg
        viewBox="0 0 400 100"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Glow filter for tokens */}
          <filter id="tokenGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Gradient for the main tube */}
          <linearGradient id="tubeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2a2a2a" />
            <stop offset="50%" stopColor="#1f1f1f" />
            <stop offset="100%" stopColor="#2a2a2a" />
          </linearGradient>
        </defs>

        {/* Main horizontal tube */}
        <rect
          x="20"
          y="45"
          width="360"
          height="10"
          rx="5"
          fill="url(#tubeGradient)"
          stroke="#333"
          strokeWidth="0.5"
        />

        {/* Side pipes with valves */}
        {valves.map((valve, index) => (
          <g key={`valve-${index}`}>
            {/* Pipe stub */}
            <rect
              x={valve.x - 2}
              y={valve.side === 'top' ? valve.y : 55}
              width="4"
              height={valve.side === 'top' ? 15 : 15}
              fill="#2a2a2a"
              stroke="#333"
              strokeWidth="0.5"
            />

            {/* Valve cap */}
            <circle
              cx={valve.x}
              cy={valve.y}
              r="4"
              fill="#6B7280"
              stroke="#4a4a4a"
              strokeWidth="0.5"
            />

            {/* Attempted drip animation */}
            {!prefersReducedMotion && (
              <circle
                cx={valve.x}
                cy={valve.side === 'top' ? valve.y + 6 : valve.y - 6}
                r="2"
                fill={tokenColor}
                opacity="0"
              >
                <animate
                  attributeName="opacity"
                  values="0;0;0.6;0"
                  dur="4s"
                  begin={`${index * 0.7}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="r"
                  values="2;2;3;2"
                  dur="4s"
                  begin={`${index * 0.7}s`}
                  repeatCount="indefinite"
                />
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={`0,0; 0,${valve.side === 'top' ? '3' : '-3'}; 0,0`}
                  dur="4s"
                  begin={`${index * 0.7}s`}
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        ))}

        {/* Flowing tokens */}
        {!prefersReducedMotion && tokens.map((token) => (
          <circle
            key={`token-${token.id}`}
            r="4"
            fill={tokenColor}
            filter="url(#tokenGlow)"
            cy={50 + token.yOffset}
          >
            <animate
              attributeName="cx"
              values="-10;410"
              dur="8s"
              begin={token.delay}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;1;1;1;1;0"
              dur="8s"
              begin={token.delay}
              repeatCount="indefinite"
            />
          </circle>
        ))}

        {/* Static tokens for reduced motion */}
        {prefersReducedMotion && (
          <>
            <circle cx="50" cy="50" r="4" fill={tokenColor} filter="url(#tokenGlow)" />
            <circle cx="150" cy="50" r="4" fill={tokenColor} filter="url(#tokenGlow)" />
            <circle cx="250" cy="50" r="4" fill={tokenColor} filter="url(#tokenGlow)" />
            <circle cx="350" cy="50" r="4" fill={tokenColor} filter="url(#tokenGlow)" />
          </>
        )}
      </svg>

      {/* Tooltip text */}
      <div
        className={`absolute top-4 left-4 text-sm pointer-events-none ${
          prefersReducedMotion ? 'opacity-100' : 'animate-pulse-fade'
        }`}
        style={{ color: '#C7D2FE', fontSize: '14px' }}
      >
        No trading fees. No volume rewards.
      </div>

      <style jsx>{`
        @keyframes pulse-fade {
          0%, 100% { opacity: 0; }
          20%, 80% { opacity: 1; }
        }

        .animate-pulse-fade {
          animation: pulse-fade 5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default NoFeesNoRewardsStream;

/* Usage Example:
 *
 * import NoFeesNoRewardsStream from '@/components/NoFeesNoRewardsStream';
 *
 * function App() {
 *   return (
 *     <div style={{ width: '600px', height: '200px' }}>
 *       <NoFeesNoRewardsStream />
 *     </div>
 *   );
 * }
 *
 * // With custom props:
 * <NoFeesNoRewardsStream
 *   tokenColor="#00ff00"
 *   bgColor="#2B2B2A"
 *   className="shadow-lg"
 * />
 */