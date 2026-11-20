import { Check } from 'lucide-react';

export default function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 animate-toast-in items-center gap-2 rounded-xl bg-teal px-4 py-2.5 text-[12px] font-medium text-white shadow-pop"
    >
      <Check className="h-3.5 w-3.5 text-[#C9D8CF]" />
      {message}
    </div>
  );
}
