'use client';

import { ActivityBar } from './ActivityBar';
import { FileExplorer } from './FileExplorer';

export function Sidebar() {
  return (
    <aside
      className="fixed left-0 top-0 h-screen overflow-hidden flex"
      style={{
        width: '300px',
        borderRight: '1px solid #2B2B2B'
      }}
    >
      <ActivityBar />
      <FileExplorer />
    </aside>
  );
}
