import { useState } from 'react';
import {
  Bell,
  ChevronDown,
  Menu,
  Search,
  Command,
  ArrowUpRight,
  CircleCheck,
  CircleAlert,
  Loader2,
  FlaskConical,
  Radio,
} from 'lucide-react';
import { LEGAL_UPDATE } from '../data/workspace';

function StatusPill({ status }) {
  const map = {
    checking: { icon: Loader2, label: 'Checking API', className: 'text-muted', spin: true },
    online: { icon: CircleCheck, label: 'API connected', className: 'text-mint-accent' },
    offline: { icon: CircleAlert, label: 'API offline', className: 'text-amber-accent' },
  };
  const { icon: Icon, label, className, spin } = map[status] ?? map.checking;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${className}`}>
      <Icon className={`h-3.5 w-3.5 ${spin ? 'animate-spin' : ''}`} strokeWidth={1.8} />
      {label}
    </span>
  );
}

export default function TopBar({
  onOpenSearch,
  onMenuOpen,
  apiStatus,
  testMode = false,
  onToggleTestMode,
  profile,
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <header className="relative z-20 flex h-20 flex-shrink-0 items-center border-b border-line bg-rail">
      <div className="mx-auto flex h-full w-full max-w-[940px] items-center gap-3 px-6">
        <button
          type="button"
          onClick={onMenuOpen}
          className="-ml-1 rounded-lg p-2 text-muted transition-colors hover:bg-line-soft hover:text-ink lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search is a button: it opens the command palette rather than an inline input */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="group flex h-11 w-full max-w-[460px] items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 text-left transition-colors duration-200 hover:border-sage"
        >
          <Search className="h-4 w-4 flex-shrink-0 text-muted-2" strokeWidth={1.8} />
          <span className="truncate text-[13px] text-muted-2">Search cases, laws, circulars…</span>
          <span className="ml-auto hidden items-center gap-1 rounded-md border border-line bg-rail px-1.5 py-1 text-[10px] font-medium text-muted-2 sm:inline-flex">
            <Command className="h-2.5 w-2.5" />K
          </span>
        </button>

        {/* Test UI Mode Switch Button */}
        <div className="hidden sm:flex items-center ml-2">
          <button
            type="button"
            onClick={onToggleTestMode}
            className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11.5px] font-medium transition-all duration-200 border ${
              testMode
                ? 'border-amber-line bg-amber-bg text-amber-accent shadow-sm'
                : 'border-line bg-surface text-muted hover:text-ink hover:border-sage'
            }`}
            title={
              testMode
                ? 'Test UI Mode is active (sample mock data & test scenario fallback). Click to switch to clean Live Mode.'
                : 'Live Mode is active (clean workspace with zero dummy data). Click to switch to Test UI Mode.'
            }
          >
            {testMode ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-accent"></span>
                </span>
                <span className="font-semibold">Test UI Mode</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-mint-accent"></span>
                <span>Live Mode</span>
              </>
            )}
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Status badge */}
          <div className="hidden md:block mr-1">
            <StatusPill status={apiStatus} />
          </div>

          <button
            type="button"
            onClick={() => setNotificationsOpen((v) => !v)}
            className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-line-soft"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell className="h-[19px] w-[19px]" strokeWidth={1.6} />
            {testMode && (
              <span className="absolute right-2 top-[7px] h-[6px] w-[6px] rounded-full bg-ember ring-2 ring-rail" />
            )}
          </button>

          <span className="hidden h-6 w-px bg-line sm:block" />

          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-1 text-left transition-colors sm:pr-2 hover:bg-line-soft"
            aria-label="Account"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-sage/45 text-[11px] font-semibold tracking-wide text-teal-600">
              {profile?.initials || 'LR'}
            </span>
            <span className="hidden min-w-0 leading-tight sm:block">
              <span className="block text-[13px] font-semibold text-ink">{profile?.name || 'Legal Researcher'}</span>
              <span className="block text-[11px] text-muted">{profile?.role || 'Banking Law Workspace'}</span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-muted-2 sm:block" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {notificationsOpen && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setNotificationsOpen(false)}
          />
          <div className="absolute right-5 top-[calc(100%+8px)] z-40 w-[340px] animate-fade-up overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
              <p className="text-[12px] font-semibold text-ink">Notifications & Status</p>
              <StatusPill status={apiStatus} />
            </div>

            {/* Mobile test mode toggle */}
            <div className="sm:hidden px-4 py-2.5 border-b border-line-soft bg-rail flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink">Workspace Mode:</span>
              <button
                type="button"
                onClick={onToggleTestMode}
                className="text-[11.5px] font-semibold text-teal-600 hover:underline"
              >
                {testMode ? 'Switch to Live Mode' : 'Switch to Test Mode'}
              </button>
            </div>

            <a
              href={LEGAL_UPDATE.href}
              target="_blank"
              rel="noreferrer"
              className="block px-4 py-3.5 transition-colors hover:bg-rail"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-accent">
                {LEGAL_UPDATE.label}
              </p>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-ink">{LEGAL_UPDATE.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{LEGAL_UPDATE.body}</p>
              <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600">
                {LEGAL_UPDATE.cta}
                <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
              </span>
            </a>
          </div>
        </>
      )}
    </header>
  );
}
