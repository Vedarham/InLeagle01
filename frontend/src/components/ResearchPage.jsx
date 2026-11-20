import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookmarkX,
  FileText,
  MessageSquareText,
  PenLine,
  Sparkles,
  X,
} from 'lucide-react';
import AnswerText from './AnswerText';
import { MODE_LABELS } from '../data/workspace';

function relativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / minute)} min ago`;
  if (diff < day) return `${Math.floor(diff / hour)} h ago`;
  if (diff < 2 * day) return 'Yesterday';
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ResearchDetail({ item, onClose, onAsk, onDelete }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close research"
        onClick={onClose}
        className="absolute inset-0 bg-teal-deep/30 backdrop-blur-[2px]"
      />
      <aside className="relative flex h-full w-full max-w-[620px] animate-slide-in flex-col overflow-y-auto border-l border-line bg-surface shadow-pop">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-6 py-4 backdrop-blur">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">
            {item.status === 'draft' ? <PenLine className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {item.status === 'draft' ? 'Draft question' : 'Saved answer'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-amber-bg hover:text-amber-accent"
              aria-label="Delete from research"
            >
              <BookmarkX className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-line-soft hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-6">
          <h2 className="font-display text-[24px] font-semibold leading-[1.25] text-ink">{item.question}</h2>
          <p className="mt-2 text-[11px] text-muted-2">
            {MODE_LABELS[item.mode] ?? item.mode} · {relativeTime(item.updatedAt ?? item.createdAt)}
          </p>

          {item.status === 'draft' || !item.answer ? (
            <div className="mt-5 rounded-xl border border-line bg-rail px-4 py-4">
              <p className="text-[13px] leading-relaxed text-ink-soft">
                You set this question aside before running it. Send it to InLeagle to retrieve the statute,
                circular, and case law it turns on.
              </p>
              <button type="button" onClick={() => onAsk(item.question)} className="btn-primary mt-3.5">
                <MessageSquareText className="h-4 w-4" />
                Ask InLeagle
              </button>
            </div>
          ) : (
            <>
              <div className="mt-5">
                <AnswerText text={item.answer} />
              </div>

              {item.citations?.length > 0 && (
                <div className="mt-5 rounded-xl border border-line bg-rail px-4 py-3.5">
                  <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-teal-600">
                    <FileText className="h-3.5 w-3.5" />
                    Sources cited
                  </p>
                  <ol className="mt-2.5 space-y-2">
                    {item.citations.map((citation, index) => (
                      <li key={`${citation}-${index}`} className="flex gap-2.5 text-[12px] leading-snug text-ink-soft">
                        <span className="mt-px font-mono text-[10px] font-semibold text-sage">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        {citation}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <button
                type="button"
                onClick={() => onAsk(item.question)}
                className="btn-quiet mt-4 w-full"
              >
                <MessageSquareText className="h-4 w-4" />
                Ask a follow-up
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function ResearchPage({
  items,
  collections,
  activeCollection,
  focusId,
  onFocusHandled,
  onFilterCollection,
  onAsk,
  onDelete,
  onBrowseLibrary,
}) {
  const [openId, setOpenId] = useState(null);

  /* Deep-link from "Continue your research" into a specific saved item. */
  useEffect(() => {
    if (!focusId) return;
    setOpenId(focusId);
    onFocusHandled?.();
  }, [focusId, onFocusHandled]);

  const filters = useMemo(
    () => [{ id: 'all', name: 'All research' }, ...collections],
    [collections],
  );

  const visible = useMemo(() => {
    const sorted = [...items].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
    return activeCollection ? sorted.filter((item) => item.collectionId === activeCollection) : sorted;
  }, [items, activeCollection]);

  const collectionName = collections.find((c) => c.id === activeCollection)?.name;
  const openItem = items.find((item) => item.id === openId);

  return (
    <div className="mx-auto w-full max-w-[940px] px-6 pb-16 pt-12">
      <p className="eyebrow">Workspace</p>
      <div className="mt-2">
        <h1 className="font-display text-[38px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {collectionName ?? 'My Research'}
        </h1>
        <p className="mt-2 max-w-[540px] text-[13px] leading-relaxed text-muted">
          {collectionName
            ? `Questions and answers filed under ${collectionName}.`
            : 'Saved answers and questions you set aside, kept together for later.'}
        </p>
      </div>

      <div className="no-scrollbar mt-5 flex items-center gap-2 overflow-x-auto">
        {filters.map((filter) => {
          const isActive = filter.id === 'all' ? !activeCollection : activeCollection === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onFilterCollection(filter.id === 'all' ? null : filter.id)}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'border-teal bg-teal text-white'
                  : 'border-line bg-surface text-muted hover:border-sage hover:text-ink'
              }`}
            >
              {filter.name}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {visible.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <span className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-teal-soft">
              <FileText className="h-5 w-5 text-teal-600" strokeWidth={1.6} />
            </span>
            <p className="font-display text-[20px] font-semibold text-ink">No research filed here yet.</p>
            <p className="mx-auto mt-1.5 max-w-[360px] text-[12.5px] leading-relaxed text-muted">
              Answers you save from InLeagle land here. You can also start from a landmark judgment.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={() => onAsk('')} className="btn-primary">
                <MessageSquareText className="h-4 w-4" />
                Ask a question
              </button>
              <button type="button" onClick={onBrowseLibrary} className="btn-quiet">
                Browse the Case Library
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          visible.map((item) => (
            <div
              key={item.id}
              className="group rounded-2xl border border-line bg-surface px-5 py-4 shadow-card transition-all duration-200 ease-soft hover:-translate-y-px hover:border-sage hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-4">
                <button type="button" onClick={() => setOpenId(item.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] ${
                        item.status === 'draft'
                          ? 'bg-amber-bg text-amber-accent'
                          : 'bg-mint-bg text-mint-accent'
                      }`}
                    >
                      {item.status === 'draft' ? 'Draft' : 'Answered'}
                    </span>
                    <span className="text-[10.5px] text-muted-2">{relativeTime(item.updatedAt ?? item.createdAt)}</span>
                    {item.citations?.length > 0 && (
                      <span className="text-[10.5px] text-muted-2">· {item.citations.length} citations</span>
                    )}
                  </div>

                  <h3 className="font-display mt-1.5 text-[17.5px] font-semibold leading-snug text-ink transition-colors group-hover:text-teal-600">
                    {item.question}
                  </h3>

                  {item.answer ? (
                    <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{item.answer}</p>
                  ) : (
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                      Set aside without an answer. Continue this question to retrieve the sources.
                    </p>
                  )}
                </button>

                <div className="flex flex-shrink-0 items-center gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => onAsk(item.question)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-sage hover:text-teal-600"
                    aria-label="Continue this question"
                    title="Continue this question"
                  >
                    <MessageSquareText className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-2 transition-colors hover:bg-amber-bg hover:text-amber-accent"
                    aria-label="Delete from research"
                    title="Delete from research"
                  >
                    <BookmarkX className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {openItem && (
        <ResearchDetail
          item={openItem}
          onClose={() => setOpenId(null)}
          onAsk={(question) => {
            setOpenId(null);
            onAsk(question);
          }}
          onDelete={(id) => {
            setOpenId(null);
            onDelete(id);
          }}
        />
      )}
    </div>
  );
}
