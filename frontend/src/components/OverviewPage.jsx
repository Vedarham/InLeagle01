import { useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CircleHelp,
  FileText,
  MoreHorizontal,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
  BookMarked,
  FolderOpen,
} from 'lucide-react';
import { SUGGESTED_QUESTIONS, HERO_EXAMPLE, LEGAL_UPDATE, RESEARCH_TIP } from '../data/workspace';
import { CASES } from '../data/library';

const ACTIVITY_ICONS = {
  search: { Icon: Search, tile: 'bg-mint-bg', color: 'text-mint-accent' },
  saved: { Icon: Star, tile: 'bg-amber-tile', color: 'text-amber-accent' },
  opened: { Icon: BookOpen, tile: 'bg-lilac', color: 'text-[#6B5E9E]' },
  upload: { Icon: FileText, tile: 'bg-lilac', color: 'text-[#6B5E9E]' },
};

function greetingFor(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel() {
  return new Date()
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .toUpperCase();
}

function SectionHeading({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-[26px] font-semibold leading-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-[12.5px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function ActivityRow({ item, onOpenCase }) {
  const { Icon, tile, color } = ACTIVITY_ICONS[item.kind] ?? ACTIVITY_ICONS.search;
  const clickable = Boolean(item.caseId && onOpenCase);
  const Wrapper = clickable ? 'button' : 'div';

  return (
    <Wrapper
      {...(clickable
        ? { type: 'button', onClick: () => onOpenCase(item.caseId), className: 'group flex w-full items-start gap-3.5 rounded-xl text-left transition-colors hover:bg-rail' }
        : { className: 'flex w-full items-start gap-3.5' })}
    >
      <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-[11px] ${tile}`}>
        <Icon className={`h-[17px] w-[17px] ${color}`} strokeWidth={1.7} />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="block truncate text-[13.5px] text-ink-soft">
          {item.text}{' '}
          <span className="font-semibold text-ink">{item.emphasis}</span>
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-2">{item.time}</span>
      </span>
      {clickable && (
        <ArrowUpRight className="ml-auto mt-2 h-3.5 w-3.5 flex-shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </Wrapper>
  );
}

function RecentCard({ item, onOpen }) {
  const Icon = item.kind === 'case' ? BookMarked : FolderOpen;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:border-sage hover:shadow-lift"
    >
      <span className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
        {item.label}
      </span>
      <span className="font-display line-clamp-3 text-[17px] font-semibold leading-snug text-ink transition-colors group-hover:text-teal-600">
        {item.title}
      </span>
      <span className="mt-auto flex items-center gap-1.5 pt-3 text-[11px] text-muted">
        <span className="truncate">{item.meta}</span>
        <ArrowUpRight className="ml-auto h-3.5 w-3.5 flex-shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />
      </span>
    </button>
  );
}

export default function OverviewPage({
  profile,
  activity,
  recent,
  onAsk,
  onUpload,
  onOpenCase,
  onOpenResearch,
  onViewHistory,
  onClearActivity,
}) {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef(null);

  const dateLabel = useMemo(todayLabel, []);
  const greeting = useMemo(() => greetingFor(new Date().getHours()), []);

  const recentItems = recent.length
    ? recent
    : CASES.slice(0, 3).map((c) => ({
        id: c.id,
        kind: 'case',
        label: c.category,
        title: c.title,
        meta: `${c.year} · ${c.citation}`,
        caseId: c.id,
      }));

  const submit = (event) => {
    event?.preventDefault();
    const value = query.trim();
    if (!value) return;
    setQuery('');
    onAsk(value);
  };

  return (
    <div className="mx-auto w-full max-w-[940px] px-6 pb-16 pt-12">
      {/* Greeting */}
      <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow">{dateLabel}</p>
          <h1 className="font-display mt-3 text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] text-ink sm:text-[46px]">
            {greeting}, {profile.firstName}.
          </h1>
          <p className="mt-2.5 max-w-[520px] text-[13.5px] leading-relaxed text-muted">
            Make sense of the law, faster. Pick up where you left off or ask InLeagle a question.
          </p>
        </div>

        <button type="button" onClick={onUpload} className="btn-primary mt-1">
          <Upload className="h-4 w-4" strokeWidth={1.9} />
          Upload a document
        </button>
      </div>

      {/* Ask hero */}
      <section className="hero-rings relative overflow-hidden rounded-[22px] bg-teal px-7 pb-7 pt-8 shadow-hero sm:px-10 sm:pb-9 sm:pt-10">
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-[15px] w-[15px] text-gold" strokeWidth={1.6} />
            <span className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-[#C9D8CF]">
              Ask InLeagle
            </span>
            <span className="rounded-md bg-white/10 px-2 py-[3px] text-[9px] font-semibold uppercase tracking-[0.12em] text-[#DDE8E1]">
              Beta
            </span>
          </div>

          <h2 className="font-display mt-4 max-w-[560px] text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] text-white sm:text-[34px]">
            What would you like to understand?
          </h2>
          <p className="mt-2.5 max-w-[520px] text-[13px] leading-relaxed text-[#A9C1BA]">
            Ask a question about Indian law. InLeagle will search verified sources and show you the reasoning.
          </p>

          <form onSubmit={submit} className="mt-6">
            <div className="flex items-center gap-2 rounded-[16px] border border-white/15 bg-white/[0.055] p-2 pl-4 transition-colors focus-within:border-white/30">
              <Search className="h-[18px] w-[18px] flex-shrink-0 text-[#9FB8B1]" strokeWidth={1.7} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={HERO_EXAMPLE}
                aria-label="Ask InLeagle a legal question"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[13.5px] text-white placeholder:text-[#93ADA6] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="flex-shrink-0 rounded-[11px] bg-[#E3E9DC] px-4 py-2.5 text-[12.5px] font-semibold text-[#1B3F3C] transition-all duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                Ask InLeagle
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onAsk(question)}
                className="rounded-full border border-white/20 px-3.5 py-[7px] text-[11.5px] text-[#C6D6D0] transition-colors duration-200 hover:border-white/40 hover:bg-white/10 hover:text-white"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Continue your research */}
      <section className="mt-10">
        <SectionHeading title="Continue your research" subtitle="Your most recent cases and references" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {recentItems.map((item) => (
            <RecentCard
              key={item.id}
              item={item}
              onOpen={() =>
                item.kind === 'case' ? onOpenCase(item.caseId) : onOpenResearch(item.id)
              }
            />
          ))}
        </div>
      </section>

      {/* Activity */}
      <section className="mt-6">
        <div className="card relative p-6 sm:p-7">
          <div className="flex items-start justify-between">
            <h2 className="font-display text-[25px] font-semibold leading-none text-ink">Your activity</h2>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="-mr-1 -mt-1 rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-line-soft hover:text-ink"
                aria-label="Activity options"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close menu"
                    className="fixed inset-0 z-30 cursor-default"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-8 z-40 w-[168px] animate-fade-up overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onClearActivity();
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[12.5px] text-ink-soft transition-colors hover:bg-rail"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted" />
                      Clear activity
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-1">
            {activity.length === 0 ? (
              <p className="py-6 text-[13px] text-muted">
                Nothing here yet. Your searches, saved cases, and research will appear here.
              </p>
            ) : (
              activity.slice(0, 4).map((item) => (
                <ActivityRow key={item.id} item={item} onOpenCase={onOpenCase} />
              ))
            )}
          </div>

          <button
            type="button"
            onClick={onViewHistory}
            className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-teal-600 transition-opacity hover:opacity-70"
          >
            View full history
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </section>

      {/* Legal update */}
      <section className="mt-4">
        <div className="rounded-2xl border border-amber-line bg-amber-bg p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[11px] bg-amber-tile">
              <Bell className="h-[17px] w-[17px] text-amber-accent" strokeWidth={1.7} />
            </span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-amber-accent">
              {LEGAL_UPDATE.label}
            </span>
          </div>
          <h3 className="mt-4 text-[15px] font-semibold leading-snug text-amber-ink">{LEGAL_UPDATE.title}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-amber-text">{LEGAL_UPDATE.body}</p>
          <a
            href={LEGAL_UPDATE.href}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-accent transition-opacity hover:opacity-70"
          >
            {LEGAL_UPDATE.cta}
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        </div>
      </section>

      {/* Research tip */}
      <section className="mt-4">
        <div className="rounded-2xl border border-mint-line bg-mint-bg p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-[18px] w-[18px] text-mint-accent" strokeWidth={1.7} />
              <span className="text-[13px] font-semibold text-mint-accent">{RESEARCH_TIP.title}</span>
            </div>
            <span title="A short habit that improves legal research" className="text-mint-accent/50">
              <CircleHelp className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </span>
          </div>
          <p className="font-display mt-4 text-[21px] font-medium leading-snug text-mint-ink">
            {RESEARCH_TIP.quote}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">{RESEARCH_TIP.body}</p>
        </div>
      </section>

      <p className="mt-8 text-center text-[10.5px] text-muted-2">
        InLeagle provides legal information, not legal advice.
      </p>
    </div>
  );
}
