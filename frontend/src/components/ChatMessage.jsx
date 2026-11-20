import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, AlertTriangle } from 'lucide-react';

/* ── Minimal markdown renderer ─────────────────────────────────
   Handles: **bold**, *italic*, numbered lists, bullets, headings,
   blank-line paragraphs. Avoids the broken greedy regex in the
   original index.html.
   ──────────────────────────────────────────────────────────── */
function renderMarkdown(raw) {
  const lines = raw.split('\n');
  const nodes = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    /* Heading h3 */
    if (line.startsWith('### ')) {
      nodes.push(<h3 key={i} className="font-serif text-[18px] font-semibold text-gold dark:text-dark-gold mt-4 mb-2 first:mt-0">{inlineFormat(line.slice(4))}</h3>);
      i++; continue;
    }
    /* Heading h4 */
    if (line.startsWith('#### ')) {
      nodes.push(<h4 key={i} className="font-semibold text-[15px] text-ink dark:text-[#f5f4f0] mt-3 mb-1">{inlineFormat(line.slice(5))}</h4>);
      i++; continue;
    }

    /* Ordered list — collect consecutive numbered items */
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(<li key={i} className="mb-1.5">{inlineFormat(lines[i].replace(/^\d+\. /, ''))}</li>);
        i++;
      }
      nodes.push(<ol key={`ol-${i}`} className="list-decimal pl-5 mb-3 space-y-0.5">{items}</ol>);
      continue;
    }

    /* Unordered list */
    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(<li key={i} className="mb-1.5">{inlineFormat(lines[i].slice(2))}</li>);
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} className="list-disc pl-5 mb-3 space-y-0.5">{items}</ul>);
      continue;
    }

    /* Blank line = paragraph break */
    if (line.trim() === '') { i++; continue; }

    /* Regular paragraph */
    nodes.push(<p key={i} className="mb-3 last:mb-0 leading-[1.75]">{inlineFormat(line)}</p>);
    i++;
  }

  return nodes;
}

/* Inline: **bold**, *italic* */
function inlineFormat(text) {
  const parts = [];
  // Split on **…** or *…*
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, match;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const inner = match[0];
    if (inner.startsWith('**')) {
      parts.push(<strong key={key++} className="font-semibold text-gold dark:text-dark-gold">{inner.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={key++} className="italic text-muted dark:text-dark-muted">{inner.slice(1, -1)}</em>);
    }
    last = match.index + inner.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

/* ── Citation drawer ────────────────────────────────────────── */
function CitationDrawer({ citations, expanded, onToggle }) {
  if (!citations || citations.length === 0) return null;
  return (
    <div className="mt-4">
      <button
        onClick={onToggle}
        className="
          flex items-center gap-2
          text-[10.5px] uppercase tracking-widest font-semibold
          text-gold dark:text-dark-gold
          hover:opacity-80 transition-opacity
        "
      >
        <BookOpen className="w-3.5 h-3.5" />
        Sources cited ({citations.length})
        {expanded
          ? <ChevronUp  className="w-3 h-3" />
          : <ChevronDown className="w-3 h-3" />
        }
      </button>

      {expanded && (
        <div className="
          mt-3 rounded-[4px_12px_12px_12px]
          bg-parchment dark:bg-dark-parchment
          border border-border dark:border-dark-border
          citation-bar
          px-4 py-3
          space-y-2
        ">
          {citations.map((c, i) => (
            <div key={i} className="flex gap-2.5 items-start text-[11.5px] font-mono text-ink dark:text-[#f5f4f0] opacity-80 leading-tight">
              <span className="text-gold dark:text-dark-gold font-bold flex-shrink-0 mt-0.5">§</span>
              <span>{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── ChatMessage ────────────────────────────────────────────── */
export default function ChatMessage({ msg, expandedCitation, onToggleCitation }) {
  const isUser  = msg.role === 'user';
  const isError = msg.error;
  const citKey  = `cite-${msg.id}`;
  const citOpen = expandedCitation === citKey;

  return (
    <div className={`msg-reveal flex flex-col gap-1 max-w-[680px] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}>
      {/* Label */}
      <span className="text-[10.5px] uppercase tracking-widest text-muted dark:text-dark-muted font-medium">
        {isUser ? 'You' : 'InLeagle'}
      </span>

      {/* Bubble */}
      <div className={`
        px-5 py-4 text-[14.5px] leading-[1.7] transition-colors duration-200
        ${isUser
          ? 'bg-ink dark:bg-[#1e1e24] text-paper rounded-[16px_16px_4px_16px] shadow-card dark:shadow-dark-card'
          : isError
            ? 'bg-rust/[0.06] border border-rust/20 rounded-md flex items-start gap-2 text-rust'
            : 'bg-white dark:bg-dark-card border border-border dark:border-dark-border rounded-[4px_16px_16px_16px] shadow-card dark:shadow-dark-card'
        }
      `}>
        {isError && <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}

        {isUser
          ? <p>{msg.text}</p>
          : (
            <div className="answer-text text-ink dark:text-[#f5f4f0]">
              {renderMarkdown(msg.text)}
              {msg.streaming && (
                <span className="inline-block w-[2px] h-[1.1em] bg-gold dark:bg-dark-gold opacity-70 ml-0.5 align-middle animate-[cursorBlink_0.8s_infinite]" />
              )}
              {!msg.streaming && (
                <CitationDrawer
                  citations={msg.citations}
                  expanded={citOpen}
                  onToggle={() => onToggleCitation(citOpen ? null : citKey)}
                />
              )}
            </div>
          )
        }
      </div>

      {/* Mode tag */}
      {!isUser && msg.mode && !msg.streaming && (
        <span className="text-[10px] text-muted dark:text-dark-muted opacity-60 mt-0.5">
          {msg.mode} mode
        </span>
      )}
    </div>
  );
}

