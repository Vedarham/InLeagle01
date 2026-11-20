import logoUrl from '../assets/logo.svg';

/**
 * InLeagle wordmark. The mark is the supplied feather, vectorised from the
 * brand artwork so it stays crisp at 46px (and only weighs ~1 KB).
 */
export default function Brand({ size = 'md', onClick }) {
  const tile = size === 'sm' ? 'h-9 w-9 rounded-[11px]' : 'h-[46px] w-[46px] rounded-[13px]';
  const word = size === 'sm' ? 'text-[21px]' : 'text-[27px]';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 text-left"
      aria-label="InLeagle home"
    >
      <img
        src={logoUrl}
        alt=""
        draggable="false"
        className={`${tile} flex-shrink-0 shadow-[0_12px_22px_-14px_rgba(6,48,51,0.95)] transition-transform duration-300 ease-soft group-hover:-rotate-3`}
      />
      <span className="min-w-0">
        <span className={`font-display block ${word} leading-none font-semibold tracking-[-0.02em] text-ink`}>
          InLeagle
        </span>
        <span className="mt-[7px] block text-[9px] font-medium uppercase leading-none tracking-[0.235em] text-muted-2">
          Legal intelligence
        </span>
      </span>
    </button>
  );
}
