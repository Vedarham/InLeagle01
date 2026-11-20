import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Copy,
  Check,
  FileText,
  Loader2,
  MessagesSquare,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import AnswerText from './AnswerText';
import { MODES, MODE_LABELS, SUGGESTED_QUESTIONS } from '../data/workspace';

const MODE_TONE = {
  auto: 'bg-teal-soft text-teal-600',
  layman: 'bg-mint-bg text-mint-accent',
  legal: 'bg-amber-bg text-amber-accent',
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — leave the label unchanged */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted transition-colors hover:text-ink"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Sources({ citations, sources }) {
  const [open, setOpen] = useState(false);
  const count = citations.length;

  if (!count && !sources.length) return null;

  return (
    <div className="mt-4 rounded-xl border border-line bg-rail">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <FileText className="h-[15px] w-[15px] text-teal-600" strokeWidth={1.8} />
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-teal-600">
          Sources cited ({count || sources.length})
        </span>
        {open ? (
          <ChevronUp className="ml-auto h-3.5 w-3.5 text-muted" />
        ) : (
          <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted" />
        )}
      </button>

      {open && (
        <div className="border-t border-line-soft px-4 py-3.5">
          {count > 0 && (
            <ol className="space-y-2">
              {citations.map((citation, index) => (
                <li key={`${citation}-${index}`} className="flex gap-2.5 text-[12px] leading-snug text-ink-soft">
                  <span className="mt-px font-mono text-[10px] font-semibold text-sage">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{citation}</span>
                </li>
              ))}
            </ol>
          )}

          {sources.length > 0 && (
            <div className={count ? 'mt-3.5 border-t border-line-soft pt-3' : ''}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">
                Retrieved from the corpus
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sources.map((source) => (
                  <span
                    key={`${source.document_name}-${source.year}`}
                    className="rounded-md border border-line bg-surface px-2 py-1 text-[10.5px] text-muted"
                    title={`${source.source_type || 'Document'} · relevance ${Number(source.score ?? 0).toFixed(2)}`}
                  >
                    {source.document_name}
                    {source.year ? ` · ${source.year}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Message({ message, onSave, saved }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[16px_16px_4px_16px] bg-teal px-4 py-3 text-[13.5px] leading-relaxed text-white shadow-card">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-[9px] bg-teal-soft">
        <Sparkles className="h-3.5 w-3.5 text-teal-600" strokeWidth={1.8} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wide text-ink">InLeagle</span>
          {message.mode && (
            <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-medium ${MODE_TONE[message.mode] ?? MODE_TONE.auto}`}>
              {MODE_LABELS[message.mode] ?? message.mode}
            </span>
          )}
        </div>

        {message.error ? (
          <div className="rounded-xl border border-amber-line bg-amber-bg px-4 py-3.5">
            <div className="flex items-start gap-2 text-[13px] leading-relaxed text-amber-ink">
              <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-accent" />
              <span>{message.text}</span>
            </div>
          </div>
        ) : (
          <>
            {message.pending ? (
              <div className="flex items-center gap-1 pt-1">
                <span className="h-1.5 w-1.5 animate-typing rounded-full bg-sage" />
                <span className="h-1.5 w-1.5 animate-typing rounded-full bg-sage [animation-delay:0.15s]" />
                <span className="h-1.5 w-1.5 animate-typing rounded-full bg-sage [animation-delay:0.3s]" />
                <span className="ml-2 text-[11px] text-muted-2">Searching the corpus…</span>
              </div>
            ) : (
              <AnswerText text={message.text} />
            )}
          </>
        )}

        {!message.pending && !message.error && message.text && (
          <>
            <Sources citations={message.citations ?? []} sources={message.sources ?? []} />
            <div className="mt-3 flex items-center gap-4">
              <button
                type="button"
                onClick={() => onSave(message)}
                disabled={saved}
                className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium transition-colors ${
                  saved ? 'text-mint-accent' : 'text-muted hover:text-ink'
                }`}
              >
                {saved ? (
                  <BookmarkCheck className="h-3.5 w-3.5" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5" />
                )}
                {saved ? 'Saved to research' : 'Save to research'}
              </button>
              <CopyButton text={message.text} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Composer({ mode, onModeChange, onAsk, disabled }) {
  const [value, setValue] = useState('');
  const [modeOpen, setModeOpen] = useState(false);
  const textareaRef = useRef(null);

  const submit = () => {
    const question = value.trim();
    if (!question || disabled) return;
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onAsk(question);
  };

  const handleChange = (event) => {
    setValue(event.target.value);
    const el = event.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-line bg-rail px-5 pb-5 pt-4 lg:px-6">
      <div className="mx-auto max-w-[880px]">
        <div className="rounded-2xl border border-line bg-surface px-3.5 py-3 shadow-card focus-within:border-sage">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Ask about SARFAESI, cheque dishonour, IBC, loan recovery…"
            aria-label="Ask InLeagle a question"
            className="max-h-[180px] w-full resize-none bg-transparent px-1 py-1 text-[13.5px] leading-relaxed text-ink placeholder:text-muted-2 focus:outline-none disabled:opacity-50"
          />

          <div className="mt-1 flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setModeOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-muted transition-colors hover:border-sage hover:text-ink"
                aria-expanded={modeOpen}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                {MODE_LABELS[mode]}
                <ChevronDown className={`h-3 w-3 transition-transform ${modeOpen ? 'rotate-180' : ''}`} />
              </button>

              {modeOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close menu"
                    className="fixed inset-0 z-30 cursor-default"
                    onClick={() => setModeOpen(false)}
                  />
                  <div className="absolute bottom-full left-0 z-40 mb-2 w-[210px] animate-fade-up overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop">
                    {MODES.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          onModeChange(option.id);
                          setModeOpen(false);
                        }}
                        className={`flex w-full flex-col px-3.5 py-2 text-left transition-colors hover:bg-rail ${
                          option.id === mode ? 'bg-teal-soft/60' : ''
                        }`}
                      >
                        <span className="text-[12.5px] font-medium text-ink">{option.label}</span>
                        <span className="text-[10.5px] text-muted">{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <span className="ml-auto hidden text-[10.5px] text-muted-2 sm:block">
              Enter to send · Shift+Enter for a new line
            </span>

            <button
              type="button"
              onClick={submit}
              disabled={disabled || !value.trim()}
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-teal-600 text-white transition-all duration-200 hover:bg-teal disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Send question"
            >
              {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AskPage({
  messages,
  loading,
  mode,
  onModeChange,
  onAsk,
  onSave,
  onReset,
  savedIds,
}) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: messages.length > 2 ? 'smooth' : 'auto' });
  }, [messages]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[880px] px-6 pb-6 pt-10">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Workspace</p>
              <h1 className="font-display mt-2 flex items-center gap-2 text-[30px] font-semibold leading-tight text-ink">
                Ask InLeagle
                <span className="rounded-md bg-mint-bg px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-mint-accent">
                  Beta
                </span>
              </h1>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="btn-quiet mt-1 h-9 px-3 py-0 text-[12px]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New question
              </button>
            )}
          </div>

          {messages.length === 0 ? (
            <div className="mt-8">
              <div className="card p-7">
                <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-teal-soft">
                  <MessagesSquare className="h-5 w-5 text-teal-600" strokeWidth={1.6} />
                </span>
                <h2 className="font-display text-[24px] font-semibold leading-snug text-ink">
                  Start with the remedy you need.
                </h2>
                <p className="mt-2 max-w-[520px] text-[13px] leading-relaxed text-muted">
                  Every answer is grounded in retrieved statutes, RBI directions, and judgments — with citations
                  you can check. InLeagle will say so when the corpus does not support an answer.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => onAsk(question)}
                      className="rounded-full border border-line bg-rail px-3.5 py-2 text-[11.5px] text-ink-soft transition-colors hover:border-sage hover:bg-surface"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-7">
              {messages.map((message) => (
                <Message
                  key={message.id}
                  message={message}
                  onSave={onSave}
                  saved={savedSet.has(message.id)}
                />
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <Composer mode={mode} onModeChange={onModeChange} onAsk={onAsk} disabled={loading} />
    </div>
  );
}
