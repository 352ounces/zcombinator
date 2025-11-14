'use client';

import { ProposalCard } from '@/components/ProposalCard';
import { FilterButton } from '@/components/FilterButton';
import { useState, useMemo, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { MOCK_PROPOSALS, type MockProposal } from '@/lib/mock/mockProposals';

interface Proposal {
  id: string;
  title: string;
  status: 'Active' | 'Passed' | 'Failed';
  tokenSymbol?: string;
  summary: string;
  twapGap?: number;
  timeAgo: string;
}

export default function ProposalsPage() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'active' | 'passed' | 'failed'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  const ITEMS_PER_PAGE = 12;

  // Use shared mock proposals data
  const mockProposals: Proposal[] = MOCK_PROPOSALS as Proposal[];

  // Parse time strings to milliseconds for sorting
  const parseTimeToMilliseconds = (timeString: string): number => {
    const trimmed = timeString.toLowerCase().trim();

    // Support HH:MM:SS format
    const hhmmssMatch = trimmed.match(/^(\d{1,3}):(\d{2}):(\d{2})/);
    if (hhmmssMatch) {
      const hours = parseInt(hhmmssMatch[1], 10);
      const minutes = parseInt(hhmmssMatch[2], 10);
      const seconds = parseInt(hhmmssMatch[3], 10);
      return ((hours * 60 + minutes) * 60 + seconds) * 1000;
    }

    const match = trimmed.match(/(\d+)\s*(hour|hours|day|days|minute|minutes|second|seconds)/);
    if (!match) return Number.MAX_SAFE_INTEGER;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    if (unit.includes('second')) return value * 1000;
    if (unit.includes('minute')) return value * 60 * 1000;
    if (unit.includes('hour')) return value * 60 * 60 * 1000;
    if (unit.includes('day')) return value * 24 * 60 * 60 * 1000;

    return Number.MAX_SAFE_INTEGER;
  };

  const formatActiveCountdown = (timeString: string): string => {
    const milliseconds = parseTimeToMilliseconds(timeString);
    if (!Number.isFinite(milliseconds) || milliseconds === Number.MAX_SAFE_INTEGER) {
      return '00:00:00 left';
    }
    let totalSeconds = Math.max(Math.floor(milliseconds / 1000), 0);

    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds -= hours * 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds - minutes * 60;

    const pad = (num: number) => num.toString().padStart(2, '0');

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)} left`;
  };

  // Filter proposals based on view mode and search query, then sort by newest first
  const filteredProposals = useMemo(() => {
    const filtered = mockProposals.filter((proposal) => {
      // Filter by status
      if (viewMode !== 'all' && proposal.status.toLowerCase() !== viewMode) {
        return false;
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          proposal.title.toLowerCase().includes(query) ||
          proposal.summary.toLowerCase().includes(query) ||
          proposal.id.toLowerCase().includes(query)
        );
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      const aIsActive = a.status === 'Active';
      const bIsActive = b.status === 'Active';

      if (aIsActive && !bIsActive) return -1;
      if (bIsActive && !aIsActive) return 1;

      const timeA = parseTimeToMilliseconds(a.timeAgo);
      const timeB = parseTimeToMilliseconds(b.timeAgo);

      return timeA - timeB;
    });
  }, [viewMode, searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredProposals.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProposals = filteredProposals.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, searchQuery]);

  // Calculate page numbers to display
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="flex flex-col gap-[28px] px-5 py-5 w-full">
      {/* Header with Title and Connect Wallet Button - handled by Header component */}
      
      {/* Search and Filters */}
      <div className="flex items-center justify-between w-full">
        {/* Search Bar and Proposal Guidelines Button */}
        <div className="flex gap-[20px] items-center flex-1">
          <div
            className="flex gap-[8px] items-center px-[9px] py-[6px] rounded-[8px] w-[387px]"
            style={{
              backgroundColor: theme === 'dark' ? '#222222' : '#f3f3f5',
            }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: theme === 'dark' ? '#6C6C74' : '#717182' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search proposals by title or ID..."
              className={`flex-1 bg-transparent text-[14px] leading-[20px] focus:outline-none ${
                theme === 'dark' ? 'text-[#ffffff] placeholder:text-[#6C6C74]' : 'text-[#0a0a0a] placeholder:text-[rgba(113,113,130,0.8)]'
              }`}
              style={{ fontFamily: 'SF Pro Text, sans-serif' }}
            />
          </div>
          <a
            href="https://github.com/zcombinatorio/zcombinator/blob/main/.github/PULL_REQUEST_TEMPLATE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[6px] px-[12px] py-[10px] flex items-center justify-center hover:opacity-90 transition-opacity h-[32px] cursor-pointer"
            style={{ 
              fontFamily: 'Inter, sans-serif',
              backgroundColor: theme === 'dark' ? '#5A5798' : '#403d6d',
            }}
          >
            <span className="font-semibold text-[12px] leading-[12px] tracking-[0.24px] capitalize text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
              Proposal guidelines
            </span>
          </a>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-[6px] items-center h-[32px]">
          <FilterButton
            label="All"
            isActive={viewMode === 'all'}
            onClick={() => setViewMode('all')}
          />
          <FilterButton
            label="Active"
            isActive={viewMode === 'active'}
            onClick={() => setViewMode('active')}
          />
          <FilterButton
            label="Passed"
            isActive={viewMode === 'passed'}
            onClick={() => setViewMode('passed')}
          />
          <FilterButton
            label="Failed"
            isActive={viewMode === 'failed'}
            onClick={() => setViewMode('failed')}
          />
        </div>
      </div>

      {/* Proposals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[20px] w-full">
        {filteredProposals.length === 0 ? (
          <div className="col-span-full">
            <p className="text-[14px] text-[#717182]" style={{ fontFamily: 'Inter, sans-serif' }}>
              No proposals found
            </p>
          </div>
        ) : (
          paginatedProposals.map((proposal) => {
            const timeDisplay = proposal.status === 'Active'
              ? formatActiveCountdown(proposal.timeAgo)
              : proposal.timeAgo;

            return (
              <ProposalCard
                key={proposal.id}
                id={proposal.id}
                title={proposal.title}
                status={proposal.status}
                tokenSymbol={proposal.tokenSymbol}
                summary={proposal.summary}
                twapGap={proposal.twapGap}
                timeAgo={timeDisplay}
                onClick={() => {
                  console.log('Proposal clicked:', proposal.id);
                }}
                onMoreInfo={() => {
                  console.log('More info clicked:', proposal.id);
                }}
                onTrade={() => {
                  console.log('Trade clicked:', proposal.id);
                }}
              />
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="text-[14px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ 
              fontFamily: 'Inter, sans-serif',
              color: theme === 'dark' ? '#717182' : '#717182',
            }}
            {...(currentPage !== 1 && {
              onMouseEnter: (e) => {
                e.currentTarget.style.color = theme === 'dark' ? '#ffffff' : '#0a0a0a';
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.color = '#717182';
              },
            })}
          >
            Previous
          </button>
          <div className="flex items-center gap-[6px]">
            {pageNumbers.map((page, index) => {
              if (page === '...') {
                return (
                  <span key={`ellipsis-${index}`} className="text-[14px] text-[#717182] px-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    ...
                  </span>
                );
              }
              const isActive = page === currentPage;
              const activeBg = theme === 'dark' ? '#5A5798' : '#403d6d';
              const inactiveBg = theme === 'dark' ? '#2a2a2a' : '#ffffff';
              const inactiveBorder = theme === 'dark' ? '#1C1C1C' : '#e5e5e5';
              const inactiveText = theme === 'dark' ? '#ffffff' : '#0a0a0a';
              const inactiveHover = theme === 'dark' ? '#2a2a2a' : '#f6f6f7';
              
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page as number)}
                  className="min-w-[36px] rounded-[8px] px-[12px] py-[6px] text-[14px] transition-colors"
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
                  {page}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="text-[14px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ 
              fontFamily: 'Inter, sans-serif',
              color: theme === 'dark' ? '#717182' : '#717182',
            }}
            {...(currentPage !== totalPages && {
              onMouseEnter: (e) => {
                e.currentTarget.style.color = theme === 'dark' ? '#ffffff' : '#0a0a0a';
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.color = '#717182';
              },
            })}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
