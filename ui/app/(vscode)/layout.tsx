'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { TabProvider } from '@/contexts/TabContext';
import { useTheme } from '@/contexts/ThemeContext';

function VscodeLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { theme } = useTheme();

  const isFaqPage = pathname === '/faq';
  const isSwapPage = pathname === '/swap';
  const isLaunchPage = pathname === '/launch';
  const isProjectsPage = pathname === '/projects' || pathname?.startsWith('/projects/');
  const isProposalsPage = pathname === '/decisions';
  const isStakePage = pathname === '/stake';
  const isPortfolioPage = pathname === '/portfolio';
  const isLightPage = isFaqPage || isSwapPage || isLaunchPage || isProjectsPage || isProposalsPage || isStakePage || isPortfolioPage;

  const backgroundColor = theme === 'dark' ? '#292929' : '#ffffff';

  return (
    <div 
      className="min-h-screen" 
      style={{ 
        backgroundColor,
        color: theme === 'dark' ? '#ffffff' : '#0a0a0a'
      }}
    >
      <Sidebar />

      {/* Main Content */}
      <main
        className="h-screen overflow-y-auto ml-[228px]"
        style={{
          backgroundColor
        }}
      >
        <Header />

        {/* Content Area */}
        <div className="flex">
          {/* Main Content Column */}
          <div 
            className="flex-1"
            style={{
              paddingLeft: '20px',
              paddingRight: '20px',
              paddingTop: '20px',
              paddingBottom: '20px'
            }}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function VscodeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TabProvider>
      <VscodeLayoutContent>{children}</VscodeLayoutContent>
    </TabProvider>
  );
}