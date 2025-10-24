import React from 'react';
import Image from 'next/image';

interface ZCombinatorLogoProps {
  className?: string;
  textClassName?: string;
  logoHeight?: string;
  color?: string;
  maskStyle?: boolean;
  expanded?: boolean;
}

const ZCombinatorLogo: React.FC<ZCombinatorLogoProps> = ({
  className = '',
  textClassName = 'text-4xl font-bold',
  logoHeight = 'h-10',
  color = '#FFFFFF',
  maskStyle = false,
  expanded = false
}) => {
  if (expanded) {
    // Use the expanded PNG logo
    return (
      <div className={`w-full ${className}`}>
        <Image
          src="/logos/zcomb-expanded-logo.png"
          alt="Z Combinator"
          width={1600}
          height={200}
          className="w-full h-auto block"
          style={{
            filter: color !== '#FFFFFF' ? 'invert(0.1)' : 'none',
            maxWidth: '100%'
          }}
        />
      </div>
    );
  }

  if (maskStyle) {
    // For mask style, create a full-width layout
    return (
      <div className={`flex items-center justify-between ${className}`}>
        <div
          className={`${logoHeight} aspect-square flex-shrink-0`}
          style={{
            backgroundColor: color,
            WebkitMask: `url("/logos/z-logo-white.png") center center / contain no-repeat`,
            mask: `url("/logos/z-logo-white.png") center center / contain no-repeat`,
          }}
        />
        <span
          className={`font-bold`}
          style={{
            color: color,
            fontSize: `calc(${logoHeight.replace('h-', '')} * 0.25rem * 1.5)`, // Proportional text size
            lineHeight: 1,
            letterSpacing: `calc(${logoHeight.replace('h-', '')} * 0.25rem * 0.3)`, // Wide letter spacing to fill width
          }}
        >
          Combinator
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src="/logos/z-logo-white.png"
        alt="Z"
        width={40}
        height={40}
        className={`${logoHeight} w-auto mr-2`}
      />
      <span className={textClassName}>Combinator</span>
    </div>
  );
};

export default ZCombinatorLogo;