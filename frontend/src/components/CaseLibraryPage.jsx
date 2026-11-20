import { useMemo, useState } from 'react';
import { ArrowUpRight, BookMarked, Search, SlidersHorizontal } from 'lucide-react';
import { CASES, CASE_CATEGORIES, searchCases } from '../data/library';

function CaseRow({ item, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="group w-full rounded-2xl border border-line bg-surface px-5 py-4 text-left shadow-card transition-all duration-200 ease-soft hover:-translate-y-px hover:border-sage hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-2">
              {item.citation}
            </span>
            <span className="h-1 w-1 rounded-full bg-line" />
            <span className="text-[10.5px] text-muted">{item.category}</span>
          </div>

          <h3 className="font-display mt-1.5 text-[18px] font-semibold leading-snug text-ink transition-colors group-hover:text-teal-600">
            {item.title}
          </h3>
          <p className="mt-1 text-[11.5px] text-muted">
            {item.court} · {item.year}
          </p>
          <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-ink-soft/80">{item.summary}</p>
        </div>

        <span className="mt-1 grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg border border-line text-muted-2 transition-colors group-hover:border-sage group-hover:text-teal-600">
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>
    </button>
  );
}

export default function CaseLibraryPage({ onOpenCase }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const results = useMemo(() => {
    const matched = searchCases(query);
    return category === 'All' ? matched : matched.filter((c) => c.category === category);
  }, [query, category]);

  return (
    <div className="mx-auto w-full max-w-[940px] px-6 pb-16 pt-12">
      <p className="eyebrow">Library</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[38px] font-semibold leading-tight tracking-[-0.02em] text-ink">
            Case Library
          </h1>
          <p className="mt-2 max-w-[520px] text-[13px] leading-relaxed text-muted">
            Landmark banking, recovery, and insolvency decisions, each with the provision it turns on.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] text-muted">
          <BookMarked className="h-3.5 w-3.5" />
          {CASES.length} judgments indexed
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex h-11 items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 focus-within:border-sage">
          <Search className="h-4 w-4 flex-shrink-0 text-muted-2" strokeWidth={1.8} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by case name, court, citation, or issue…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-muted-2 focus:outline-none"
            aria-label="Search the case library"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-[11px] text-muted transition-colors hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>

        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
          <SlidersHorizontal className="mr-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-2" />
          {CASE_CATEGORIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCategory(option)}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                category === option
                  ? 'border-teal bg-teal text-white'
                  : 'border-line bg-surface text-muted hover:border-sage hover:text-ink'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {results.length === 0 ? (
          <div className="card px-6 py-10 text-center">
            <p className="font-display text-[19px] font-semibold text-ink">No judgments match that search.</p>
            <p className="mt-1.5 text-[12.5px] text-muted">
              Try a broader term, or ask InLeagle the question directly.
            </p>
          </div>
        ) : (
          results.map((item) => <CaseRow key={item.id} item={item} onOpen={onOpenCase} />)
        )}
      </div>
    </div>
  );
}
