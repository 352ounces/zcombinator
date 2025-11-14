'use client';

import { useTheme } from '@/contexts/ThemeContext';

interface ProposalCardProps {
  id: string;
  title: string;
  status: 'Active' | 'Passed' | 'Failed';
  tokenSymbol?: string;
  summary: string;
  twapGap?: number;
  timeAgo: string;
  onClick?: () => void;
  onMoreInfo?: () => void;
  onTrade?: () => void;
}

export function ProposalCard({
  id,
  title,
  status,
  tokenSymbol = '$ZC',
  summary,
  twapGap,
  timeAgo,
  onClick,
  onMoreInfo,
  onTrade,
}: ProposalCardProps) {
  const { theme } = useTheme();
  const cardBg = theme === 'dark' ? '#222222' : '#ffffff';
  const cardBorder = theme === 'dark' ? '#1C1C1C' : '#e5e5e5';
  const textColor = theme === 'dark' ? '#ffffff' : '#0a0a0a';
  const secondaryTextColor = theme === 'dark' ? '#B8B8B8' : '#717182';
  const buttonBg = theme === 'dark' ? '#303030' : '#ffffff';
  const buttonHover = theme === 'dark' ? '#2a2a2a' : '#f6f6f7';
  const twapBadgeBg = theme === 'dark' ? '#35343F' : '#d1cfe7';
  const twapBadgeText = theme === 'dark' ? '#8C88CD' : '#403D6D';

  const getStatusStyles = () => {
    switch (status) {
      case 'Passed':
        return {
          backgroundColor: theme === 'dark' ? '#A8F5C3' : '#dcfce7',
          text: 'text-[#008236]',
          icon: (
            <svg className="w-[11px] h-[11px]" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_20_992)">
                <path fillRule="evenodd" clipRule="evenodd" d="M9.84184 2.6809C10.0527 2.92211 10.0527 3.31318 9.84184 3.55439L4.80184 9.3191C4.59095 9.5603 4.24905 9.5603 4.03816 9.3191L1.15816 6.02498C0.947279 5.78377 0.947279 5.3927 1.15816 5.15149C1.36905 4.91029 1.71095 4.91029 1.92184 5.15149L4.42 8.00887L9.07816 2.6809C9.28905 2.4397 9.63096 2.4397 9.84184 2.6809Z" fill="#008236"/>
              </g>
              <defs>
                <clipPath id="clip0_20_992">
                  <rect width="11" height="11" fill="white"/>
                </clipPath>
              </defs>
            </svg>
          ),
        };
      case 'Active':
        return {
          backgroundColor: theme === 'dark' ? '#B8D5FC' : '#dbeafe',
          text: 'text-[#1447e6]',
          icon: (
            <svg className="w-[11px] h-[11px]" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="6" cy="5.5" r="3" fill="#1447E6"/>
            </svg>
          ),
        };
      case 'Failed':
        return {
          backgroundColor: theme === 'dark' ? '#F8A6A6' : '#fee2e2',
          text: 'text-[#dc2626]',
          icon: (
            <svg className="w-[11px] h-[11px]" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_20_998)">
                <path d="M2.99982 8.49982L8 3.49963" stroke="#C90000" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M2.99982 3.50018L8 8.50037" stroke="#C90000" strokeWidth="1.5" strokeLinecap="round"/>
              </g>
              <defs>
                <clipPath id="clip0_20_998">
                  <rect width="11" height="11" fill="white"/>
                </clipPath>
              </defs>
            </svg>
          ),
        };
    }
  };

  const statusStyles = getStatusStyles();

  // Format time display: for active proposals, replace "ago" with "left"
  const formatTimeDisplay = (timeAgo: string, status: 'Active' | 'Passed' | 'Failed'): string => {
    if (status === 'Active') {
      return timeAgo.replace('ago', 'left');
    }
    return timeAgo; // Keep "ago" for Passed and Failed
  };

  const shadowStyle = theme === 'dark' 
    ? '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)'
    : '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)';

  return (
    <div
      onClick={onClick}
      className="rounded-[12px] p-[20px] flex flex-col gap-[12px] min-h-[200px] min-w-[320px] cursor-pointer"
      style={{ 
        fontFamily: 'Inter, sans-serif',
        backgroundColor: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: shadowStyle,
      }}
    >
      {/* Name and Tags */}
      <div className="flex flex-col gap-[8px] items-start w-full">
        <p className="font-normal text-[16px] leading-[1.4] w-full" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
          {title}
        </p>
        <div className="flex gap-[10px] items-center">
          {/* Status Tag */}
          <div className="flex gap-[4px] items-center justify-center px-[4px] py-0 h-[18px] rounded-[6px]" style={{ backgroundColor: statusStyles.backgroundColor }}>
            <div className="flex items-center justify-center">
              {statusStyles.icon}
            </div>
            <p className={`font-medium text-[10px] leading-[14px] ${statusStyles.text} capitalize tracking-[0.1px]`} style={{ fontFamily: 'Inter, sans-serif' }}>
              {status}
            </p>
          </div>
          {/* Token Symbol Tag */}
          <div className="flex gap-[7px] items-center justify-center px-[4px] py-[2px] rounded-[6px]" style={{ border: `1px solid ${cardBorder}` }}>
            <p className="font-medium text-[10px] leading-[1.4] capitalize" style={{ fontFamily: 'Inter, sans-serif', color: secondaryTextColor }}>
              {tokenSymbol}
            </p>
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className="flex flex-1 flex-col gap-[20px] items-start w-full">
        {/* Summary */}
        <div className="flex flex-col gap-[8px] items-start w-full">
          <p className="font-normal text-[14px] leading-[1.1]" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
            Summary
          </p>
          <p className="font-normal text-[13px] leading-[1.4] w-full" style={{ fontFamily: 'Inter, sans-serif', color: secondaryTextColor }}>
            {summary}
          </p>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-1 flex-col gap-[16px] items-start justify-end w-full">
          {/* TWAP Gap and Time */}
          <div className="flex items-start justify-between w-full">
            <div className="flex-1 flex gap-[10px] items-start">
              <p className={`font-normal text-[12px] leading-[1.4] ${status === 'Active' ? 'whitespace-nowrap' : ''}`} style={{ fontFamily: 'Inter, sans-serif', color: secondaryTextColor }}>
                {status === 'Active' ? 'Current TWAP Pass-Fail Gap' : 'Final TWAP Pass-Fail Gap'}
              </p>
              {twapGap !== undefined && (
                <div className="flex gap-[10px] items-center justify-center px-[4px] py-0 rounded-[6px]" style={{ backgroundColor: twapBadgeBg }}>
                  <p className="font-normal text-[12px] leading-[1.6]" style={{ fontFamily: 'Inter, sans-serif', color: twapBadgeText }}>
                    {twapGap.toFixed(2)}%
                  </p>
                </div>
              )}
            </div>
            <p className="font-normal text-[12px] leading-[1.4]" style={{ fontFamily: 'Inter, sans-serif', color: secondaryTextColor }}>
              {formatTimeDisplay(timeAgo, status)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-[8px] items-start justify-center w-full">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTrade?.();
              }}
              className="flex-1 flex gap-[4px] items-center justify-center px-[12px] py-[10px] rounded-[6px] transition-colors"
              style={{ 
                fontFamily: 'Inter, sans-serif',
                backgroundColor: buttonBg,
                border: `1px solid ${cardBorder}`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = buttonHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = buttonBg;
              }}
            >
              <span className="font-semibold text-[12px] leading-[12px] tracking-[0.24px] capitalize" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
                Trade
              </span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTrade?.();
              }}
              className="rounded-[6.75px] w-[34px] h-[34px] flex items-center justify-center transition-colors"
              style={{ 
                fontFamily: 'Inter, sans-serif',
                backgroundColor: buttonBg,
                border: `1px solid ${cardBorder}`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = buttonHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = buttonBg;
              }}
            >
              <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ color: textColor }}>
                <path d="M16 22.0273V19.1573C16.0375 18.6804 15.9731 18.2011 15.811 17.7511C15.6489 17.3011 15.3929 16.8907 15.06 16.5473C18.2 16.1973 21.5 15.0073 21.5 9.54728C21.4997 8.15111 20.9627 6.80848 20 5.79728C20.4559 4.57579 20.4236 3.22563 19.91 2.02728C19.91 2.02728 18.73 1.67728 16 3.50728C13.708 2.8861 11.292 2.8861 9 3.50728C6.27 1.67728 5.09 2.02728 5.09 2.02728C4.57638 3.22563 4.54414 4.57579 5 5.79728C4.03013 6.81598 3.49252 8.17074 3.5 9.57728C3.5 14.9973 6.8 16.1873 9.94 16.5773C9.611 16.9173 9.35726 17.3227 9.19531 17.7672C9.03335 18.2117 8.96681 18.6853 9 19.1573V22.0273M9 20.0273C6 21.0003 3.5 20.0273 2 17.0273" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

