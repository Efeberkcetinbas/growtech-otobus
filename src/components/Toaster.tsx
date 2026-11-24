import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { onToast, type Toast } from '../lib/notify';

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(
    () =>
      onToast((t) => {
        setItems((cur) => [...cur.slice(-2), t]);
        const ms = t.kind === 'error' ? 7000 : t.action ? 5000 : 2500;
        setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), ms);
      }),
    [],
  );
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-3" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl px-4 py-2.5 text-[15px] font-medium text-white shadow-lg ${
            t.kind === 'error' ? 'bg-danger' : t.kind === 'info' ? 'bg-slate-800' : 'bg-brand-900'
          }`}
        >
          {t.kind === 'error' ? <AlertTriangle className="h-5 w-5 shrink-0" /> : t.kind === 'info' ? <Info className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-xl px-3 font-bold text-warn underline-offset-2 active:bg-white/10"
              onClick={() => {
                t.action!.run();
                setItems((cur) => cur.filter((x) => x.id !== t.id));
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
