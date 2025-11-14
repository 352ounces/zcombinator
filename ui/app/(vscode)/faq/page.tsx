'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export default function FaqPage() {
  const { theme } = useTheme();
  const [openQuestions, setOpenQuestions] = useState<Set<number>>(new Set());
  const textColor = theme === 'dark' ? '#ffffff' : '#0a0a0a';
  
  const cardBg = theme === 'dark' ? '#222222' : '#ffffff';
  const cardBorder = theme === 'dark' ? '#1C1C1C' : '#e5e5e5';
  const shadowStyle = theme === 'dark' 
    ? '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)'
    : '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)';

  const toggleQuestion = (index: number) => {
    setOpenQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const PlusIcon = ({ isOpen }: { isOpen: boolean }) => {
    const iconColor = theme === 'dark' ? '#ffffff' : '#0a0a0a';
    return (
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={`transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
        style={{ stroke: iconColor }}
      >
        <path 
          d="M6 12.0005H12M12 12.0005H18M12 12.0005V6.00049M12 12.0005V18.0005" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="flex flex-col gap-6 px-5">
      {/* FAQ Items */}
      <div className="flex flex-col gap-[12px]">
        {/* Question 1 */}
        <div 
          className="rounded-[12px] px-[12px] py-[20px] flex flex-col"
          style={{
            fontFamily: 'Inter, sans-serif',
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: shadowStyle,
          }}
        >
          <button
            onClick={() => toggleQuestion(1)}
            className="flex items-start justify-between gap-[12px] w-full text-left"
          >
            <h2 className="font-medium text-[20px] leading-[1.34] tracking-[-0.2px] flex-1" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
              Why are all ZC launched tokens (including $ZC) mintable?
            </h2>
            <PlusIcon isOpen={openQuestions.has(1)} />
          </button>
          {openQuestions.has(1) && (
            <p className="font-normal text-[14px] leading-[1.4] max-w-[680px] mt-[10px]" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
              Only the ZC protocol (NOT the token dev) can mint tokens. It will do so automatically at the end of each Quantum Market to pay users whose PRs get merged. This aligns incentives with token price growth, rewarding all users who create value.
            </p>
          )}
        </div>

        {/* Question 2 */}
        <div 
          className="rounded-[12px] px-[12px] py-[20px] flex flex-col"
          style={{
            fontFamily: 'Inter, sans-serif',
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: shadowStyle,
          }}
        >
          <button
            onClick={() => toggleQuestion(2)}
            className="flex items-start justify-between gap-[12px] w-full text-left"
          >
            <h2 className="font-medium text-[20px] leading-[1.34] tracking-[-0.2px] flex-1" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
              What is the utility of $ZC?
            </h2>
            <PlusIcon isOpen={openQuestions.has(2)} />
          </button>
          {openQuestions.has(2) && (
            <p className="font-normal text-[14px] leading-[1.4] max-w-[680px] mt-[10px]" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
              $ZC represents a stake in the Z Combinator treasury, which receives a portion of all token mints from platform launches. Other launched tokens on ZC have utilities as determined by their founders. More $ZC utilities coming soon.
            </p>
          )}
        </div>

        {/* Question 3 */}
        <div 
          className="rounded-[12px] px-[12px] py-[20px] flex flex-col"
          style={{
            fontFamily: 'Inter, sans-serif',
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: shadowStyle,
          }}
        >
          <button
            onClick={() => toggleQuestion(3)}
            className="flex items-start justify-between gap-[12px] w-full text-left"
          >
            <h2 className="font-medium text-[20px] leading-[1.34] tracking-[-0.2px] flex-1" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
              How does staking work? What are the rewards for staking?
            </h2>
            <PlusIcon isOpen={openQuestions.has(3)} />
          </button>
          {openQuestions.has(3) && (
            <p className="font-normal text-[14px] leading-[1.4] max-w-[680px] mt-[10px]" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
              All ZC launched tokens will have native staking. Users who lock their tokens in the vault will earn rewards from protocol-minted tokens. Currently only available for $ZC and $oogway.
            </p>
          )}
        </div>

        {/* Question 4 */}
        <div 
          className="rounded-[12px] px-[12px] py-[20px] flex flex-col"
          style={{
            fontFamily: 'Inter, sans-serif',
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: shadowStyle,
          }}
        >
          <button
            onClick={() => toggleQuestion(4)}
            className="flex items-start justify-between gap-[12px] w-full text-left"
          >
            <h2 className="font-medium text-[20px] leading-[1.34] tracking-[-0.2px] flex-1" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
              Are there trading fees?
            </h2>
            <PlusIcon isOpen={openQuestions.has(4)} />
          </button>
          {openQuestions.has(4) && (
            <p className="font-normal text-[14px] leading-[1.4] max-w-[680px] mt-[10px]" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
              There are no trading fees for any ZC launched token currently.
            </p>
          )}
        </div>

        {/* Question 5 */}
        <div 
          className="rounded-[12px] px-[12px] py-[20px] flex flex-col"
          style={{
            fontFamily: 'Inter, sans-serif',
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: shadowStyle,
          }}
        >
          <button
            onClick={() => toggleQuestion(5)}
            className="flex items-start justify-between gap-[12px] w-full text-left"
          >
            <h2 className="font-medium text-[20px] leading-[1.34] tracking-[-0.2px] flex-1" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
              As a dev, isn&apos;t it weird that I have to dump my tokens to fund myself?
            </h2>
            <PlusIcon isOpen={openQuestions.has(5)} />
          </button>
          {openQuestions.has(5) && (
            <p className="font-normal text-[14px] leading-[1.4] max-w-[680px] mt-[10px]" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
              Projects relying on trading fees are unsustainable. Controlled token emissions let founders fuel growth through incentives, creating long-term value. Both users and founders get rich by contributing to and sharing ownership of a valuable project.
            </p>
          )}
        </div>

        {/* Question 6 */}
        <div 
          className="rounded-[12px] px-[12px] py-[20px] flex flex-col"
          style={{
            fontFamily: 'Inter, sans-serif',
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: shadowStyle,
          }}
        >
          <button
            onClick={() => toggleQuestion(6)}
            className="flex items-start justify-between gap-[12px] w-full text-left"
          >
            <h2 className="font-medium text-[20px] leading-[1.34] tracking-[-0.2px] flex-1" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
              How can you get involved?
            </h2>
            <PlusIcon isOpen={openQuestions.has(6)} />
          </button>
          {openQuestions.has(6) && (
            <div className="flex flex-col gap-0 font-normal text-[14px] leading-[1.4] max-w-[680px] mt-[10px]" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
              <p>
                If you want to found a startup, launch a ZC token and follow the steps on the{' '}
                <Link href="/" className="underline cursor-pointer" style={{ color: textColor }}>
                  landing page
                </Link>
                .
              </p>
              <p>
                If you want help grow existing projects, submit PRs to and trade Quantum Markets for any ZC launched project (
                <a
                  href="https://github.com/zcombinatorio/zcombinator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline cursor-pointer"
                  style={{ color: textColor }}
                >
                  including ZC itself
                </a>
                !) to earn substantial token rewards.
              </p>
            </div>
          )}
        </div>

        {/* Question 7 */}
        <div 
          className="rounded-[12px] px-[12px] py-[20px] flex flex-col gap-[10px]"
          style={{
            fontFamily: 'Inter, sans-serif',
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: shadowStyle,
          }}
        >
          <h2 className="font-medium text-[20px] leading-[1.34] tracking-[-0.2px]" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
            Have other questions?
          </h2>
          <p className="font-normal text-[14px] leading-[1.4] max-w-[680px]" style={{ fontFamily: 'Inter, sans-serif', color: textColor }}>
            Join{' '}
            <a
              href="https://discord.gg/MQfcX9QM2r"
              target="_blank"
              rel="noopener noreferrer"
              className="underline cursor-pointer"
              style={{ color: textColor }}
            >
              our discord
            </a>{' '}
            and ask them!
          </p>
        </div>
      </div>
    </div>
  );
}