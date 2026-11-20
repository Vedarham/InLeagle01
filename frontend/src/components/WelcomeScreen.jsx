const CARDS = [
  {
    title: 'SARFAESI Notice Remedies',
    text:  'What can a borrower do when served a 60-day notice under Section 13(2)?',
    query: 'My bank sent me a 60 day notice to take possession of my property. What can I do?',
  },
  {
    title: 'Cheque Bounce Defence',
    text:  'What happens next when a Section 138 criminal case is filed and how to settle?',
    query: 'Cheque bounce case filed against me. What happens next?',
  },
  {
    title: 'Loan App Harassment',
    text:  'Is contacting or threatening third-party contacts illegal and how to complain?',
    query: 'Loan app is calling my family. Is that legal?',
  },
  {
    title: 'Guarantor Insolvency',
    text:  'Are personal guarantors liable under Section 95 IBC if the company enters CIRP?',
    query: 'I am a personal guarantor. Company went bankrupt. Am I liable?',
  },
];

const STATS = [
  { value: '96.7%',  label: 'Faithfulness (MVP eval)' },
  { value: '<2 s',   label: 'Retrieval latency P90' },
  { value: '5+',     label: 'Core Acts indexed' },
  { value: 'Groq',   label: 'LLM inference engine' },
];

export default function WelcomeScreen({ onAskQuick }) {
  return (
    <div className="m-auto w-full max-w-[720px] px-2 py-10 flex flex-col items-center">
      {/* Hero */}
      <div className="
        w-[72px] h-[72px] rounded-full mb-6
        bg-parchment dark:bg-dark-parchment
        border border-border dark:border-dark-border
        shadow-card dark:shadow-dark-card
        flex items-center justify-center
        text-[32px]
        transition-all duration-300 hover:scale-105 hover:border-gold dark:hover:border-dark-gold
      ">
        {/* scale-of-justice SVG inline, no emoji */}
        <svg viewBox="0 0 32 32" className="w-8 h-8 text-gold dark:text-dark-gold" fill="none" stroke="currentColor" strokeWidth="1.6">
          <line x1="16" y1="4" x2="16" y2="28" />
          <line x1="8" y1="4" x2="24" y2="4" />
          <path d="M8 4 L4 14 Q4 18 8 18 Q12 18 12 14 Z" />
          <path d="M24 4 L28 14 Q28 18 24 18 Q20 18 20 14 Z" />
          <line x1="10" y1="28" x2="22" y2="28" />
        </svg>
      </div>

      <h1 className="font-serif text-[30px] sm:text-[36px] font-semibold text-ink dark:text-[#f5f4f0] mb-3 text-center tracking-tight">
        Indian Banking Legal AI
      </h1>
      <p className="text-muted dark:text-dark-muted text-[14.5px] leading-relaxed mb-8 text-center max-w-[500px]">
        Explain acts like SARFAESI, IBC, and NI Act, cite landmark cases, and answer in plain English or formal legal terms — grounded in verified sources.
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10 w-full">
        {STATS.map(s => (
          <div
            key={s.label}
            className="
              bg-white dark:bg-dark-card border border-border dark:border-dark-border
              rounded-xl px-4 py-3 text-center shadow-card dark:shadow-dark-card
              transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover
            "
          >
            <div className="font-serif text-[22px] font-semibold text-gold dark:text-dark-gold leading-none mb-1">
              {s.value}
            </div>
            <div className="text-[10.5px] text-muted dark:text-dark-muted leading-tight">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Question cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {CARDS.map(c => (
          <button
            key={c.title}
            onClick={() => onAskQuick(c.query)}
            className="
              group text-left bg-white dark:bg-dark-card
              border border-border dark:border-dark-border
              rounded-2xl px-6 py-5 shadow-card dark:shadow-dark-card
              hover:border-gold-lt dark:hover:border-dark-gold
              hover:-translate-y-[3px] hover:shadow-card-hover
              transition-all duration-200
              flex flex-col gap-2
            "
          >
            <span className="font-serif font-semibold text-[17px] text-gold dark:text-dark-gold group-hover:text-gold-lt dark:group-hover:text-dark-gold-lt transition-colors">
              {c.title}
            </span>
            <span className="text-[12.5px] text-muted dark:text-dark-muted leading-relaxed">
              {c.text}
            </span>
          </button>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="mt-8 text-[11px] text-muted dark:text-dark-muted opacity-60 text-center max-w-[420px] leading-relaxed">
        InLeagle provides legal information, not legal advice. Always consult a qualified advocate for your specific situation.
      </p>
    </div>
  );
}

