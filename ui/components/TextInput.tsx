'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function TextInput({ hasError = false, className = '', style, ...props }: TextInputProps) {
  const { theme } = useTheme();

  const backgroundColor = theme === 'dark' ? '#222222' : '#ffffff';
  const borderColor = theme === 'dark' ? '#1C1C1C' : '#e5e5e5';
  const textColor = theme === 'dark' ? '#B8B8B8' : '#717182';

  return (
    <input
      {...props}
      className={`border rounded-[8px] px-[9px] py-2 text-[16px] leading-[24px] focus:outline-none focus:border-[#403d6d] placeholder:text-[rgba(164,164,164,0.8)] h-[40px] ${
        hasError ? 'border-red-400' : ''
      } ${className}`}
      style={{
        fontFamily: 'Inter, sans-serif',
        backgroundColor,
        color: textColor,
        ...(hasError ? {} : { borderColor }),
        ...style,
      }}
    />
  );
}

