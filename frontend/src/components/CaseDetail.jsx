import { useEffect } from 'react';
import { ArrowUpRight, BookmarkPlus, Landmark, ScrollText, X } from 'lucide-react';

export default function CaseDetail({ caseItem, onClose, onAskAboutCase, onSaveCase, saved }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!caseItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close case"
        onClick={onClose}
        className="absolute inset-0 bg-teal-deep/30 backdrop-blur-[2px]"
      />

      <aside className="relative flex h-full w-full max-w-[560px] animate-slide-in flex-col overflow-y-auto border-l border-line bg-surface shadow-pop">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-6 py-4 backdrop-blur">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-2">
            {caseItem.category}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSaveCase(caseItem)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                saved
                  ? 'border-mint-line bg-mint-bg text-mint-accent'
                  : 'border-line text-muted hover:border-sage hover:text-ink'
              }`}
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              {saved ? 'Saved' : 'Save'}
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
          <h2 className="font-display text-[26px] font-semibold leading-[1.2] tracking-[-0.015em] text-ink">
            {caseItem.title}
          </h2>
          <p className="mt-2 text-[12px] text-muted">
            {caseItem.court} · {caseItem.year} · {caseItem.citation}
          </p>

          <div className="mt-5 rounded-xl bg-rail px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">Question it answers</p>
            <p className="mt-1 text-[13px] font-medium leading-snug text-ink">{caseItem.issue}</p>
          </div>

          <section className="mt-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">In short</h3>
            <p className="mt-2 text-[13.5px] leading-[1.7] text-ink-soft">{caseItem.summary}</p>
          </section>

          <section className="mt-6">
            <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">
              <ScrollText className="h-3.5 w-3.5" strokeWidth={1.8} />
              What it decides
            </h3>
            <ul className="mt-2.5 space-y-2.5">
              {caseItem.holdings.map((holding) => (
                <li key={holding} className="flex gap-2.5 text-[13px] leading-[1.6] text-ink-soft">
                  <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sage" />
                  {holding}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">Provisions</h3>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {caseItem.provisions.map((provision) => (
                <span
                  key={provision}
                  className="rounded-lg border border-line bg-rail px-2.5 py-1.5 text-[11px] text-ink-soft"
                >
                  {provision}
                </span>
              ))}
            </div>
          </section>

          <div className="mt-7 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onAskAboutCase(caseItem)}
              className="btn-primary w-full"
            >
              Ask InLeagle about this case
            </button>
            <a href={caseItem.source} target="_blank" rel="noreferrer" className="btn-quiet w-full">
              <Landmark className="h-4 w-4" />
              Open the official source
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <p className="mt-5 text-[10.5px] leading-relaxed text-muted-2">
            Summary prepared from the reported judgment. Verify the current text before relying on it in a filing.
          </p>
        </div>
      </aside>
    </div>
  );
}
