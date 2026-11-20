import { useEffect, useRef, useState } from 'react';
import { FileText, Info, UploadCloud, X, CircleAlert } from 'lucide-react';

const ACCEPT = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp';
const MAX_BYTES = 50 * 1024 * 1024;

function prettySize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadDialog({ open, onClose }) {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setError('');
      setDragging(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const addFiles = (incoming) => {
    setError('');
    const next = [];
    for (const file of incoming) {
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is larger than 50 MB.`);
        continue;
      }
      next.push({ name: file.name, size: file.size, type: file.type });
    }
    if (next.length) setFiles((prev) => [...prev, ...next].slice(0, 5));
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files ?? []));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close upload dialog"
        onClick={onClose}
        className="absolute inset-0 bg-teal-deep/35 backdrop-blur-[2px]"
      />

      <div className="relative w-full max-w-[520px] animate-fade-up rounded-2xl border border-line bg-surface p-6 shadow-pop">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-[22px] font-semibold leading-tight text-ink">Upload a document</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              Loan agreements, notices, and bank correspondence.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-line-soft hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`mt-5 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 transition-colors ${
            dragging ? 'border-teal bg-teal-soft' : 'border-sage/60 bg-rail hover:border-sage hover:bg-line-soft/60'
          }`}
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-soft">
            <UploadCloud className="h-5 w-5 text-teal-600" strokeWidth={1.6} />
          </span>
          <span className="text-[13px] font-medium text-ink">Drop a file here or browse</span>
          <span className="text-[11px] text-muted-2">PDF, DOCX, TXT, or an image · up to 50 MB</span>
        </button>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />

        {files.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.map((file) => (
              <li
                key={`${file.name}-${file.size}`}
                className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2.5"
              >
                <FileText className="h-4 w-4 flex-shrink-0 text-muted" strokeWidth={1.7} />
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink-soft">{file.name}</span>
                <span className="flex-shrink-0 text-[10.5px] text-muted-2">{prettySize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((f) => f !== file))}
                  className="flex-shrink-0 rounded p-0.5 text-muted-2 transition-colors hover:text-ink"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-amber-accent">
            <CircleAlert className="h-3.5 w-3.5" />
            {error}
          </p>
        )}

        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-line bg-amber-bg px-3.5 py-3">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-accent" strokeWidth={1.8} />
          <p className="text-[11.5px] leading-relaxed text-amber-ink">
            Document analysis is not connected in this build. Files are previewed locally and are never uploaded
            or stored — the ingestion endpoint is still to be wired up.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-quiet">
            Cancel
          </button>
          <button type="button" onClick={onClose} disabled className="btn-primary" title="Available once the ingestion API is connected">
            Analyse document
          </button>
        </div>
      </div>
    </div>
  );
}
