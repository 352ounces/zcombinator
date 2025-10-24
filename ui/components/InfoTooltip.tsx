'use client';

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <div className="relative group inline-block">
      <svg
        className="w-4 h-4 text-gray-400 cursor-help"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
        <path strokeWidth="2" d="M12 16v-4m0-4h.01"/>
      </svg>
      <div className="absolute left-6 top-0 w-64 p-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-sm text-gray-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 pointer-events-none">
        {text}
      </div>
    </div>
  );
}
