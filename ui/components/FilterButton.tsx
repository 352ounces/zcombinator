'use client';

import { useTheme } from '@/contexts/ThemeContext';

interface FilterButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export function FilterButton({ label, isActive, onClick }: FilterButtonProps) {
  const { theme } = useTheme();
  
  const activeBg = theme === 'dark' ? '#5A5798' : '#403d6d';
  const inactiveBg = theme === 'dark' ? '#222222' : '#ffffff';
  const inactiveBorder = theme === 'dark' ? '#1C1C1C' : '#e5e5e5';
  const inactiveText = theme === 'dark' ? '#ffffff' : '#0a0a0a';
  const inactiveHover = theme === 'dark' ? '#2a2a2a' : '#f6f6f7';

  return (
    <button
      onClick={onClick}
      className="rounded-[8px] px-[12px] py-[6px] transition-colors flex items-center justify-center h-[32px]"
      style={{ 
        fontFamily: 'Inter, sans-serif',
        backgroundColor: isActive ? activeBg : inactiveBg,
        border: isActive ? 'none' : `1px solid ${inactiveBorder}`,
        color: isActive ? '#ffffff' : inactiveText,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = inactiveHover;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = inactiveBg;
        }
      }}
    >
      <span className="font-semibold text-[12px] leading-[12px] tracking-[0.24px] capitalize">
        {label}
      </span>
    </button>
  );
}

