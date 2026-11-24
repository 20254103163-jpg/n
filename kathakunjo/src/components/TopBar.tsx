import type { ActiveTab } from '../types/story';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onStartNewStory: () => void;
}

const NAV_ITEMS: { id: ActiveTab; label: string }[] = [
  { id: 'topics', label: 'টপিক ল্যাব' },
  { id: 'engine', label: 'গল্প ইঞ্জিন' },
  { id: 'dna', label: 'ডিএনএ বিশ্লেষক' },
  { id: 'library', label: 'সংরক্ষিত' },
];

export function TopBar({ activeTab, onSelectTab, onStartNewStory }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-stone-50/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('topics')}
          className="font-serif text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 rounded"
        >
          কথাকুঞ্জ
        </button>

        {/* Zone 2: 4 clean single-line navigation links */}
        <nav
          aria-label="প্রধান নেভিগেশন"
          className="flex items-center gap-4 sm:gap-7 overflow-visible"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 rounded ${
                  isActive
                    ? 'text-zinc-950 dark:text-zinc-50'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 right-0 -bottom-[17px] h-[2px] bg-rose-700 dark:bg-rose-500"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Pipeline links + primary action */}
        <div className="shrink-0 flex items-center gap-2">
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noreferrer"
            className="hidden md:inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-rose-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors whitespace-nowrap"
          >
            ভয়েস লাইব্রেরি
          </a>
          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noreferrer"
            className="hidden md:inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-rose-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors whitespace-nowrap"
          >
            ২ডি অ্যানিমেশন
          </a>
          <button
            type="button"
            onClick={onStartNewStory}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-600"
          >
            নতুন গল্প
          </button>
        </div>
      </div>
    </header>
  );
}
