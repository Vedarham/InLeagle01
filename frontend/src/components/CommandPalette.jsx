import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  CornerDownLeft,
  LayoutGrid,
  MessageSquareText,
  Search,
  Sparkles,
} from 'lucide-react';
import { searchCases } from '../data/library';
import { SUGGESTED_QUESTIONS } from '../data/workspace';

const PAGES = [
  { id: 'overview', label: 'Overview', hint: 'Workspace', icon: LayoutGrid },
  { id: 'ask', label: 'Ask InLeagle', hint: 'Workspace', icon: MessageSquareText },
  { id: 'library', label: 'Case Library', hint: 'Library', icon: Search },
  { id: 'research', label: 'My Research', hint: 'Workspace', icon: Sparkles },
];

export default function CommandPalette({ open, onClose, onAsk, onOpenCase, onNavigate }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    const caseMatches = trimmed ? searchCases(trimmed).slice(0, 4) : [];
    const pageMatches = PAGES.filter((page) =>
      trimmed ? page.label.toLowerCase().includes(trimmed.toLowerCase()) : true,
    );

    const items = [];

    if (trimmed) {
      items.push({
        id: 'ask',
        kind: 'ask',
        label: trimmed,
        hint: 'Ask InLeagle',
        run: () => onAsk(trimmed),
      });
    }

    for (const caseItem of caseMatches) {
      items.push({
        id: `case-${caseItem.id}`,
        kind: 'case',
        label: caseItem.title,
        hint: `${caseItem.year} · ${caseItem.court}`,
        run: () => onOpenCase(caseItem.id),
      });
    }

    for (const page of pageMatches) {
      items.push({
        id: `page-${page.id}`,
        kind: 'page',
        label: page.label,
        hint: page.hint,
        icon: page.icon,
        run: () => onNavigate(page.id),
      });
    }

    if (!trimmed) {
      for (const question of SUGGESTED_QUESTIONS.slice(0, 3)) {
        items.push({
          id: `suggest-${question}`,
          kind: 'ask',
          label: question,
          hint: 'Ask InLeagle',
          run: () => onAsk(question),
        });
      }
    }

    return items;
  }, [query, onAsk, onOpenCase, onNavigate]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % Math.max(results.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      results[activeIndex]?.run();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 bg-teal-deep/30 backdrop-blur-[2px]"
      />

      <div className="relative w-full max-w-[600px] animate-fade-up overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="h-4 w-4 flex-shrink-0 text-muted-2" strokeWidth={1.8} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search cases, laws, circulars — or ask a question…"
            aria-label="Search cases or ask a question"
            className="h-14 min-w-0 flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-muted-2 focus:outline-none"
          />
          <kbd className="rounded border border-line bg-rail px-1.5 py-1 text-[9.5px] font-medium text-muted-2">
            ESC
          </kbd>
        </div>

        <div className="max-h-[380px] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12.5px] text-muted">
              Nothing matched. Press Enter to ask InLeagle instead.
            </p>
          ) : (
            results.map((result, index) => (
              <button
                key={result.id}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  result.run();
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  index === activeIndex ? 'bg-teal-soft' : 'hover:bg-rail'
                }`}
              >
                <span
                  className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg ${
                    result.kind === 'ask' ? 'bg-teal text-white' : 'border border-line bg-surface text-muted'
                  }`}
                >
                  {result.kind === 'ask' ? (
                    <Sparkles className="h-4 w-4" strokeWidth={1.7} />
                  ) : result.kind === 'case' ? (
                    <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
                  ) : (
                    <result.icon className="h-4 w-4" strokeWidth={1.8} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-ink">{result.label}</span>
                  <span className="block truncate text-[10.5px] text-muted-2">{result.hint}</span>
                </span>
                {index === activeIndex && (
                  <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-muted-2" />
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-rail px-4 py-2.5 text-[10px] text-muted-2">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span className="ml-auto">InLeagle search</span>
        </div>
      </div>
    </div>
  );
}
