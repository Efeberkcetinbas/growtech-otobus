import { Bus, ClipboardCheck, RefreshCw, Settings, Users, WifiOff } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { PersonForm } from './components/PersonForm';
import { Toaster } from './components/Toaster';
import { Button } from './components/ui';
import { useAppData } from './hooks/useAppData';
import { db } from './lib/db';
import { isWriteActive, toast } from './lib/notify';
import { ensureDefaults } from './lib/repo';
import { compareTr } from './lib/text';
import { AttendanceScreen } from './screens/AttendanceScreen';
import { BusScreen } from './screens/BusScreen';
import { ImportFlow } from './screens/ImportFlow';
import { ParticipantsScreen } from './screens/ParticipantsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type Tab = 'participants' | 'bus' | 'attendance' | 'settings';
const UPDATE_CHECK_MS = 30 * 60 * 1000;
const UPDATED_FLAG = 'growtech-updated';
const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'participants', label: 'Katılımcılar', icon: Users },
  { id: 'bus', label: 'Otobüsüm', icon: Bus },
  { id: 'attendance', label: 'Yoklama', icon: ClipboardCheck },
  { id: 'settings', label: 'Ayarlar', icon: Settings },
];

function readTab(): Tab {
  try {
    const t = localStorage.getItem('growtech-tab') as Tab | null;
    return t && TABS.some((x) => x.id === t) ? t : 'participants';
  } catch {
    return 'participants';
  }
}

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export default function App() {
  const data = useAppData();
  const [tab, setTab] = useState<Tab>(readTab);
  const [form, setForm] = useState<null | { personId?: string }>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [dbError, setDbError] = useState('');
  const headerRef = useRef<HTMLElement>(null);
  const [headerH, setHeaderH] = useState(132);
  const online = useOnline();
  const [hasController] = useState(() => typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller);

  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onOfflineReady() {
      toast('Uygulama çevrimdışı kullanıma hazır', 'success');
    },
    // Yeni sürümü yalnızca tarayıcının zamanlamasına bırakma: açılışta, uygulama öne
    // geldiğinde ve 30 dakikada bir sunucuda yeni sürüm var mı diye kontrol et.
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        if (navigator.onLine) reg.update().catch(() => undefined);
      };
      check();
      setInterval(check, UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  // Yeni sürüm bulunduğunda açık form/pencere yoksa otomatik uygula.
  // Tüm kayıtlar IndexedDB'de olduğu için yeniden yükleme veri kaybettirmez.
  useEffect(() => {
    if (!needRefresh) return;
    const tryApply = () => {
      if (document.querySelector('[role="dialog"]') || isWriteActive()) return false;
      try {
        sessionStorage.setItem(UPDATED_FLAG, '1');
      } catch {
        /* yalnızca bildirim için */
      }
      void updateServiceWorker(true);
      return true;
    };
    if (tryApply()) return;
    const t = setInterval(() => tryApply() && clearInterval(t), 2000);
    return () => clearInterval(t);
  }, [needRefresh, updateServiceWorker]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(UPDATED_FLAG)) {
        sessionStorage.removeItem(UPDATED_FLAG);
        toast(`Uygulama güncellendi (v${__APP_VERSION__}). Kayıtlarınız korundu.`);
      }
    } catch {
      /* yalnızca bildirim için */
    }
  }, []);

  useEffect(() => {
    db.open()
      .then(() => ensureDefaults())
      .catch((e: Error) => setDbError(`Veri tabanı açılamadı: ${e.message}. Gizli sekmede olabilirsiniz veya tarayıcı depolamayı engelliyor.`));
    // Uygun tarayıcılarda kalıcı depolama izni iste (sessizce).
    navigator.storage?.persisted?.().then((p) => (p ? undefined : navigator.storage.persist?.())).catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('growtech-tab', tab);
    } catch {
      /* yalnızca kolaylık */
    }
    window.scrollTo({ top: 0 });
  }, [tab]);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeaderH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const editing = form?.personId ? data.personMap.get(form.personId) : undefined;
  const boardingOptions = [...new Set(data.persons.map((p) => p.boardingPlace).filter(Boolean))].sort(compareTr);
  const s = data.stats;

  return (
    <div className="mx-auto min-h-dvh max-w-2xl" style={{ ['--header-h' as string]: `${headerH}px` }}>
      <header ref={headerRef} className="pt-safe sticky top-0 z-30 bg-brand-900 px-3 pb-2.5 text-white shadow-md">
        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="min-w-0">
            <h1 className="text-lg leading-tight font-extrabold tracking-wide">GROWTECH 2026</h1>
            <p className="truncate text-xs text-white/75">Aydın Ticaret Borsası · Otobüs Yolcu ve Yoklama Sistemi</p>
          </div>
          {!online && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn px-2 py-1 text-xs font-bold text-ink">
              <WifiOff className="h-3.5 w-3.5" /> Çevrimdışı
            </span>
          )}
        </div>
        <dl className="mt-2 grid grid-cols-4 gap-1.5 text-center" aria-label="Özet">
          {[
            { label: 'Toplam katılımcı', short: 'Katılımcı', value: s.total, id: 'sum-total' },
            { label: 'Otobüsümdeki kişi', short: 'Otobüsüm', value: s.onBus, id: 'sum-bus' },
            { label: `Yoklamada bulunan (${data.activeSession?.name ?? ''})`, short: 'Bindi', value: s.boarded, id: 'sum-boarded' },
            { label: 'Beklenen kişi', short: 'Beklenen', value: s.waiting, id: 'sum-waiting' },
          ].map((x) => (
            <div key={x.id} className="rounded-xl bg-white/10 px-1 py-1.5" title={x.label}>
              <dd className="text-xl leading-none font-extrabold tabular-nums" data-testid={x.id}>
                {data.loading ? '–' : x.value}
              </dd>
              <dt className="mt-1 truncate text-[11px] leading-none text-white/80">
                <span className="sr-only">{x.label}</span>
                <span aria-hidden>{x.short}</span>
              </dt>
            </div>
          ))}
        </dl>
      </header>

      {needRefresh && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-2xl bg-brand-50 p-3 text-sm text-brand-900 ring-1 ring-brand-600/30">
          <RefreshCw className="h-5 w-5 shrink-0" />
          <p className="flex-1">Yeni sürüm hazır; açık pencere kapanınca otomatik yüklenecek. Kayıtlarınız korunur.</p>
          <Button variant="primary" className="text-sm" onClick={() => void updateServiceWorker(true)}>
            Güncelle
          </Button>
        </div>
      )}

      {dbError && (
        <div role="alert" className="mx-3 mt-3 rounded-2xl bg-danger-50 p-3 text-sm font-semibold text-danger">
          {dbError}
        </div>
      )}

      <main className="px-3 pt-3 pb-[calc(88px+env(safe-area-inset-bottom))]">
        {data.loading && !dbError ? (
          <p className="py-10 text-center text-slate-500">Yükleniyor…</p>
        ) : tab === 'participants' ? (
          <ParticipantsScreen data={data} onEdit={(p) => setForm({ personId: p.id })} onNew={() => setForm({})} onImport={() => setImportOpen(true)} />
        ) : tab === 'bus' ? (
          <BusScreen data={data} onEdit={(p) => setForm({ personId: p.id })} goParticipants={() => setTab('participants')} />
        ) : tab === 'attendance' ? (
          <AttendanceScreen data={data} goParticipants={() => setTab('participants')} />
        ) : (
          <SettingsScreen data={data} onImport={() => setImportOpen(true)} offlineReady={offlineReady || hasController} />
        )}
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white" aria-label="Ana menü">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            const badge = id === 'bus' ? s.onBus : id === 'attendance' && s.onBus ? s.waiting : 0;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold ${active ? 'text-brand-600' : 'text-slate-500'}`}
              >
                {active && <span className="absolute top-0 h-1 w-10 rounded-b bg-brand-600" aria-hidden />}
                <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
                <span className="max-w-full truncate px-0.5">{label}</span>
                {badge > 0 && (
                  <span className="absolute top-1.5 left-1/2 ml-2 min-w-5 rounded-full bg-brand-900 px-1 text-[11px] leading-5 text-white tabular-nums" aria-hidden>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <Toaster />

      {form && (form.personId ? editing : true) && (
        <PersonForm key={form.personId ?? 'new'} person={editing} boardingOptions={boardingOptions} onClose={() => setForm(null)} />
      )}
      {importOpen && (
        <ImportFlow
          onClose={() => setImportOpen(false)}
          onDone={() => {
            setImportOpen(false);
            setTab('participants');
          }}
        />
      )}
    </div>
  );
}
