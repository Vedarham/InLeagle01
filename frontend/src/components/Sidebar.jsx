import { useState } from 'react';
import {
  LayoutGrid,
  MessageSquareText,
  BookMarked,
  History,
  Folder,
  Plus,
  Sparkles,
  X,
  ArrowUpRight,
  Check,
} from 'lucide-react';
import Brand from './Brand';

const WORKSPACE_NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'ask', label: 'Ask InLeagle', icon: MessageSquareText, badge: 'AI' },
  { id: 'library', label: 'Case Library', icon: BookMarked },
  { id: 'research', label: 'My Research', icon: History },
];

function NavItem({ item, active, onClick, badge }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`relative flex w-full items-center gap-3.5 rounded-xl px-3.5 py-[11px] text-left transition-colors duration-200
        ${
          active
            ? "bg-teal-soft text-ink before:absolute before:inset-y-[7px] before:left-0 before:w-[3px] before:rounded-full before:bg-teal before:content-['']"
            : 'text-ink-soft/85 hover:bg-line-soft hover:text-ink'
        }`}
    >
      <Icon
        className={`h-[18px] w-[18px] flex-shrink-0 ${active ? 'text-teal' : 'text-muted'}`}
        strokeWidth={1.6}
      />
      <span className="truncate text-[14px] font-medium">{item.label}</span>
      {badge && (
        <span className="ml-auto rounded-md bg-mint-tile px-1.5 py-[3px] text-[9.5px] font-semibold leading-none tracking-wide text-mint-accent">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function Sidebar({
  open,
  onClose,
  page,
  onNavigate,
  collections,
  activeCollection,
  onOpenCollection,
  onCreateCollection,
  promoVisible,
  onDismissPromo,
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const submitCollection = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onCreateCollection(trimmed);
    setName('');
    setAdding(false);
  };

  const go = (nextPage) => {
    onNavigate(nextPage);
    onClose?.();
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-teal-deep/35 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[304px] flex-col border-r border-line bg-rail
          transition-transform duration-300 ease-soft lg:static lg:z-auto lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-start justify-between px-6 pt-7">
          <Brand onClick={() => go('overview')} />
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 mt-1 rounded-lg p-1.5 text-muted transition-colors hover:bg-line-soft hover:text-ink lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-9">
          <p className="eyebrow px-3 pb-2.5">Workspace</p>
          <nav className="flex flex-col gap-1">
            {WORKSPACE_NAV.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                badge={item.badge}
                active={page === item.id}
                onClick={() => go(item.id)}
              />
            ))}
          </nav>

          <p className="eyebrow px-3 pb-2.5 pt-9">Saved spaces</p>
          <div className="flex flex-col gap-1">
            {collections.map((collection) => (
              <NavItem
                key={collection.id}
                item={{ id: `collection:${collection.id}`, label: collection.name, icon: Folder }}
                active={page === 'research' && activeCollection === collection.id}
                onClick={() => {
                  onOpenCollection(collection.id);
                  onClose?.();
                }}
              />
            ))}

            {adding ? (
              <form onSubmit={submitCollection} className="flex items-center gap-2 px-1.5 py-1">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => {
                    if (!name.trim()) setAdding(false);
                  }}
                  placeholder="Collection name"
                  maxLength={40}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] outline-none focus:border-sage"
                />
                <button
                  type="submit"
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-teal text-white transition-colors hover:bg-teal-600"
                  aria-label="Create collection"
                >
                  <Check className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex items-center gap-3.5 rounded-xl px-3.5 py-[11px] text-left text-teal-600 transition-colors hover:bg-line-soft"
              >
                <Plus className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.8} />
                <span className="text-[13.5px] font-semibold">New collection</span>
              </button>
            )}
          </div>
        </div>

        {promoVisible && (
          <div className="px-4 pb-5">
            <div className="relative rounded-2xl border border-mint-line bg-mint-bg p-4">
              <button
                type="button"
                onClick={onDismissPromo}
                className="absolute right-2.5 top-2.5 rounded-md p-1 text-mint-accent/60 transition-colors hover:bg-white/60 hover:text-mint-accent"
                aria-label="Dismiss promotion"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <span className="mb-4 grid h-9 w-9 place-items-center rounded-[10px] bg-mint-tile">
                <Sparkles className="h-[17px] w-[17px] text-mint-accent" strokeWidth={1.7} />
              </span>

              <p className="text-[14px] font-semibold leading-tight text-ink">Unlock deeper research</p>
              <p className="mt-1.5 text-[12px] leading-[1.55] text-muted">
                Compare cases, save answers, and export citations.
              </p>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-mint-accent transition-opacity hover:opacity-70"
              >
                Explore Pro
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-line px-6 py-4">
          <p className="text-[10.5px] leading-relaxed text-muted-2">
            InLegal-Sbert · Qdrant · Llama 3.1
            <br />
            Legal information, not legal advice.
          </p>
        </div>
      </aside>
    </>
  );
}
