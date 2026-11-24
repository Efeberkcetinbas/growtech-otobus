import { Search, X } from 'lucide-react';
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white active:bg-brand-900 disabled:bg-slate-300',
  secondary: 'bg-white text-brand-900 border border-slate-300 active:bg-slate-100 disabled:text-slate-400',
  ghost: 'bg-transparent text-brand-900 active:bg-slate-200/60',
  danger: 'bg-white text-danger border border-danger/40 active:bg-danger-50',
  success: 'bg-brand-50 text-brand-900 border border-brand-600/40',
};

export function Button({
  variant = 'secondary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3 text-[15px] font-semibold select-none ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden />
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-13 w-full rounded-2xl border border-slate-300 bg-white pr-12 pl-11 text-[17px] shadow-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Aramayı temizle"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 active:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-3.5 text-sm font-semibold ${
        active ? 'border-brand-900 bg-brand-900 text-white' : 'border-slate-300 bg-white text-ink active:bg-slate-100'
      }`}
    >
      {children}
      {count !== undefined && <span className={`ml-1.5 ${active ? 'text-white/80' : 'text-slate-500'}`}>{count}</span>}
    </button>
  );
}

/** Alttan açılan panel (mobil) / ortalanmış pencere (geniş ekran). */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white outline-none sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 py-1 pr-1 pl-4">
          <h2 className="text-lg font-bold text-brand-900">{title}</h2>
          <button type="button" aria-label="Kapat" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl active:bg-slate-100">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
        {footer && <div className="pb-safe border-t border-slate-200 px-4 pt-3 pb-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      title={title}
      onClose={onCancel}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onCancel}>Vazgeç</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} className={danger ? '!bg-danger !text-white' : ''}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-[15px] leading-relaxed">{message}</div>
    </Sheet>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
      <div className="text-brand-600">{icon}</div>
      <p className="text-base font-bold">{title}</p>
      {children}
    </div>
  );
}
