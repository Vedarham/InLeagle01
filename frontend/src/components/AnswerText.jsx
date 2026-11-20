/**
 * Lightweight markdown renderer for model output.
 * Handles headings, bold/italic, inline code, ordered and unordered lists,
 * blockquotes, and paragraph breaks — deliberately not a full parser.
 */

function inlineFormat(text, keyPrefix = 'i') {
  const nodes = [];
  let key = 0;
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let match = pattern.exec(text);

  while (match !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];

    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-${key++}`}>{token.slice(2, -2)}</strong>,
      );
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={`${keyPrefix}-${key++}`}
          className="rounded bg-line-soft px-1.5 py-0.5 font-mono text-[0.9em] text-teal-700"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<em key={`${keyPrefix}-${key++}`}>{token.slice(1, -1)}</em>);
    }

    last = match.index + token.length;
    match = pattern.exec(text);
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length === 1 && typeof nodes[0] === 'string' ? nodes[0] : nodes;
}

export default function AnswerText({ text }) {
  const lines = String(text ?? '').split('\n');
  const nodes = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^#{2,3}\s+/.test(line)) {
      nodes.push(<h3 key={i}>{inlineFormat(line.replace(/^#{2,3}\s+/, ''), `h${i}`)}</h3>);
      i += 1;
      continue;
    }

    if (/^####\s+/.test(line)) {
      nodes.push(<h4 key={i}>{inlineFormat(line.replace(/^####\s+/, ''), `h4${i}`)}</h4>);
      i += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(<li key={i}>{inlineFormat(lines[i].replace(/^\d+\.\s+/, ''), `ol${i}`)}</li>);
        i += 1;
      }
      nodes.push(<ol key={`ol-${i}`}>{items}</ol>);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(<li key={i}>{inlineFormat(lines[i].replace(/^[-*]\s+/, ''), `ul${i}`)}</li>);
        i += 1;
      }
      nodes.push(<ul key={`ul-${i}`}>{items}</ul>);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      nodes.push(
        <blockquote
          key={`q-${i}`}
          className="my-3 border-l-2 border-sage pl-3 text-[13.5px] italic text-muted"
        >
          {inlineFormat(quote.join(' '), `q${i}`)}
        </blockquote>,
      );
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    nodes.push(<p key={i}>{inlineFormat(line, `p${i}`)}</p>);
    i += 1;
  }

  return <div className="answer-body">{nodes}</div>;
}
