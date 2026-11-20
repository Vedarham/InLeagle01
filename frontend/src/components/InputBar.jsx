import { forwardRef, useState, useRef, useCallback } from 'react';
import { Send, ChevronDown } from 'lucide-react';

const MODES = [
  { id: 'auto',   label: 'Auto' },
  { id: 'layman', label: 'Simple' },
  { id: 'legal',  label: 'Legal' },
];

const InputBar = forwardRef(function InputBar({ onSubmit, disabled, mode, onModeChange }, ref) {
  const [value, setValue] = useState('');
  const [modeOpen, setModeOpen] = useState(false);
  const textareaRef = useRef(null);

  // Expose focus() via imperative handle
  // We use a callback ref pattern: assign the textarea node's focus to the parent ref
  const setRefs = useCallback((node) => {
    textareaRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  const autoResize = useCallback((el) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  const handleChange = (e) => {
    setValue(e.target.value);
    autoResize(e.target);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const submit = () => {
    const q = value.trim();
    if (!q || disabled) return;
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSubmit(q);
  };

  const currentMode = MODES.find(m => m.id === mode) ?? MODES[0];

  return (
    <div className="
      flex-shrink-0 px-5 lg:px-9 pt-5 pb-6
      border-t border-border dark:border-dark-border
      bg-paper dark:bg-dark-paper
      transition-colors duration-200
    ">
      <div className="max-w-[680px] mx-auto">
        {/* Input row */}
        <div className="flex gap-3 items-end">
          {/* Mode selector pill */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setModeOpen(o => !o)}
              className="
                flex items-center gap-1.5 h-[52px] px-3.5
                border border-border dark:border-dark-border
                rounded-xl bg-white dark:bg-dark-card
                text-[12px] font-medium text-muted dark:text-dark-muted
                hover:border-gold dark:hover:border-dark-gold
                shadow-card dark:shadow-dark-card
                transition-all duration-200
              "
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gold dark:bg-dark-gold" />
              {currentMode.label}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${modeOpen ? 'rotate-180' : ''}`} />
            </button>

            {modeOpen && (
              <div className="
                absolute bottom-full left-0 mb-2 z-50
                bg-white dark:bg-dark-card
                border border-border dark:border-dark-border
                rounded-xl shadow-card-hover dark:shadow-dark-card
                py-1.5 min-w-[140px]
                overflow-hidden
              ">
                {MODES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { onModeChange(m.id); setModeOpen(false); }}
                    className={`
                      w-full text-left px-4 py-2.5 text-[12.5px]
                      hover:bg-parchment dark:hover:bg-dark-parchment
                      transition-colors flex items-center gap-2
                      ${m.id === mode ? 'text-gold dark:text-dark-gold font-medium' : 'text-ink dark:text-[#f5f4f0]'}
                    `}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${m.id === mode ? 'bg-gold dark:bg-dark-gold' : 'bg-border dark:bg-dark-border'}`} />
                    {m.label === 'Auto' ? 'Auto Detect' : m.label === 'Simple' ? 'Simple English' : 'Legal / Formal'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={setRefs}
              rows={1}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKey}
              disabled={disabled}
              placeholder="Ask about SARFAESI, cheque bounce, IBC, RBI complaints, loan recovery..."
              className="
                w-full px-4 py-[15px] pr-4
                border border-border dark:border-dark-border
                rounded-xl bg-white dark:bg-dark-input
                text-ink dark:text-[#f5f4f0]
                placeholder:text-muted dark:placeholder:text-dark-muted placeholder:opacity-60
                font-sans text-[14px] leading-[1.5]
                resize-none outline-none
                min-h-[52px] max-h-[160px] overflow-y-auto
                shadow-card dark:shadow-dark-card
                focus:border-gold dark:focus:border-dark-gold
                focus:shadow-[0_0_0_3px_rgba(162,124,54,0.15)]
                disabled:opacity-50
                transition-all duration-200
              "
            />
          </div>

          {/* Send button */}
          <button
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="
              w-[52px] h-[52px] flex-shrink-0 flex items-center justify-center
              rounded-xl border-none
              bg-ink dark:bg-[#1e1e24]
              text-paper
              shadow-card dark:shadow-dark-card
              hover:bg-gold dark:hover:bg-dark-gold hover:text-white hover:-translate-y-px hover:shadow-card-hover
              active:scale-[0.97] active:translate-y-0
              disabled:opacity-35 disabled:cursor-not-allowed
              transition-all duration-200
            "
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Hint */}
        <p className="mt-2.5 text-[11px] text-muted dark:text-dark-muted opacity-55 text-center">
          Enter to send&nbsp;&nbsp;·&nbsp;&nbsp;Shift+Enter for new line
        </p>
      </div>
    </div>
  );
});

export default InputBar;
