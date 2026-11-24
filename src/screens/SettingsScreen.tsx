import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Database, Download, FileSpreadsheet, HardDrive, History, RotateCcw, ShieldCheck, Trash2, Upload, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button, ConfirmDialog } from '../components/ui';
import type { AppData } from '../hooks/useAppData';
import { db } from '../lib/db';
import { downloadJson } from '../lib/export';
import { toast } from '../lib/notify';
import { exportBackup, restoreBackup, restorePerson, validateBackup } from '../lib/repo';
import type { BackupData } from '../types';

const backupName = () => `growtech-yedek-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold text-brand-900">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function useStorageStatus() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const refresh = useCallback(async () => {
    try {
      if (navigator.storage?.persisted) setPersisted(await navigator.storage.persisted());
      if (navigator.storage?.estimate) {
        const e = await navigator.storage.estimate();
        setUsage({ usage: e.usage ?? 0, quota: e.quota ?? 0 });
      }
    } catch {
      setPersisted(null);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcı API'sinden ilk okuma
    void refresh();
  }, [refresh]);
  return { persisted, usage, refresh };
}

export function SettingsScreen({ data, onImport, offlineReady }: { data: AppData; onImport: () => void; offlineReady: boolean }) {
  const lastImport = useLiveQuery(async () => (await db.settings.get('lastImport'))?.value as { at: number; fileName: string; people: number } | undefined, []);
  const snapshots = useLiveQuery(() => db.snapshots.orderBy('createdAt').reverse().toArray(), []);
  const deleted = useLiveQuery(async () => (await db.persons.filter((p) => !!p.deletedAt).toArray()).sort((a, b) => b.deletedAt! - a.deletedAt!), []);
  const { persisted, usage, refresh } = useStorageStatus();
  const [pending, setPending] = useState<{ data: BackupData; label: string } | null>(null);
  const [error, setError] = useState('');

  async function backup() {
    try {
      downloadJson(await exportBackup(), backupName());
      toast('Yedek dosyası indirildi');
    } catch (e) {
      toast(`Yedek alınamadı: ${(e as Error).message}`, 'error');
    }
  }

  async function pickBackup(file: File | undefined) {
    if (!file) return;
    setError('');
    try {
      const parsed = validateBackup(JSON.parse(await file.text()));
      setPending({ data: parsed, label: file.name });
    } catch (e) {
      setError(e instanceof SyntaxError ? 'Dosya geçerli bir JSON değil.' : (e as Error).message);
    }
  }

  async function doRestore(d: BackupData) {
    try {
      // Güvenlik: mevcut verileri hem cihaz içine hem de dosya olarak sakla.
      downloadJson(await exportBackup(), `growtech-yedek-geri-yukleme-oncesi-${Date.now()}.json`);
      await restoreBackup(d);
      toast('Yedek geri yüklendi. Önceki veriler otomatik kopyalandı.');
    } catch {
      /* guarded bildirir */
    }
  }

  async function askPersist() {
    try {
      const ok = await navigator.storage?.persist?.();
      toast(ok ? 'Kalıcı depolama izni verildi' : 'Tarayıcı izni vermedi. Uygulamayı ana ekrana ekleyip tekrar deneyin.', ok ? 'success' : 'info');
      void refresh();
    } catch {
      toast('Bu tarayıcı kalıcı depolama iznini desteklemiyor.', 'info');
    }
  }

  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

  return (
    <div className="space-y-3">
      <Card icon={<FileSpreadsheet className="h-5 w-5" />} title="Excel içe aktarma">
        <p className="text-sm text-slate-600">
          {lastImport
            ? `Son yükleme: ${new Date(lastImport.at).toLocaleString('tr-TR')} · ${lastImport.fileName} · ${lastImport.people} kişi`
            : 'Henüz Excel yüklenmedi.'}
        </p>
        <p className="text-sm text-slate-600">Yeni dosya yüklemek otobüs listenizi, yoklamalarınızı ve düzeltmelerinizi silmez.</p>
        <Button variant="primary" className="w-full" onClick={onImport}>
          <FileSpreadsheet className="h-5 w-5" /> Excel yükle
        </Button>
      </Card>

      <Card icon={<Database className="h-5 w-5" />} title="Yedekleme ve geri yükleme">
        <p className="text-sm text-slate-600">
          {data.stats.total} katılımcı · {data.stats.onBus} otobüs yolcusu · {data.sessions.length} yoklama oturumu
        </p>
        <Button className="w-full" onClick={backup}>
          <Download className="h-5 w-5" /> JSON yedeği indir
        </Button>
        <label className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-[15px] font-semibold text-brand-900 active:bg-slate-100">
          <Upload className="h-5 w-5" /> Yedekten geri yükle
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            data-testid="restore-input"
            onChange={(e) => {
              void pickBackup(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </Card>

      {snapshots && snapshots.length > 0 && (
        <Card icon={<History className="h-5 w-5" />} title="Otomatik kopyalar">
          <p className="text-sm text-slate-600">Excel yükleme ve geri yükleme öncesinde cihazda otomatik alınır (son 5 kopya).</p>
          <ul className="space-y-2">
            {snapshots.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-xl bg-surface p-2.5">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{new Date(s.createdAt).toLocaleString('tr-TR')}</p>
                  <p className="break-words text-slate-600">
                    {s.reason} · {s.data.persons.filter((p) => !p.deletedAt).length} kişi · {s.data.bus.length} yolcu
                  </p>
                </div>
                <Button className="shrink-0 text-sm" onClick={() => setPending({ data: s.data, label: `Otomatik kopya (${new Date(s.createdAt).toLocaleString('tr-TR')})` })}>
                  Geri dön
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {deleted && deleted.length > 0 && (
        <Card icon={<Trash2 className="h-5 w-5" />} title={`Silinen katılımcılar (${deleted.length})`}>
          <p className="text-sm text-slate-600">
            Silinen kişiler listelerde görünmez ve yeni Excel yüklendiğinde geri eklenmez. Geri getirilen kişi katılımcı listesine döner; otobüse yeniden eklemeniz gerekir.
          </p>
          <details className="rounded-xl bg-surface">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold">Listeyi göster</summary>
            <ul className="space-y-2 px-2 pb-2">
              {deleted.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-xl bg-white p-2.5" data-testid="deleted-row">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold break-words">{p.fullName}</p>
                    <p className="break-words text-slate-600">
                      {[p.company, new Date(p.deletedAt!).toLocaleString('tr-TR')].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Button
                    className="shrink-0 text-sm"
                    onClick={() =>
                      void restorePerson(p.id)
                        .then(() => toast(`${p.fullName} katılımcı listesine geri getirildi`))
                        .catch(() => undefined)
                    }
                  >
                    <RotateCcw className="h-4 w-4" /> Geri getir
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}

      <Card icon={<HardDrive className="h-5 w-5" />} title="Cihazda saklama">
        <div className="flex gap-2 rounded-xl bg-warn-50 p-3 text-sm text-[#6b4510]">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            Tüm veriler <b>yalnızca bu telefonun tarayıcısında</b> (IndexedDB) saklanır; sunucuya gönderilmez. Tarayıcı verilerini/geçmişini temizlerseniz, uygulamayı
            silerseniz veya “gizli sekme” kullanırsanız kayıtlar <b>kaybolabilir</b>. Önemli anlarda JSON yedeği indirin.
          </p>
        </div>
        <p className="text-sm">
          Kalıcı depolama:{' '}
          <b data-testid="persist-status">{persisted === null ? 'bilinmiyor' : persisted ? 'Etkin (tarayıcı otomatik silmez)' : 'Etkin değil'}</b>
        </p>
        {usage && usage.quota > 0 && (
          <p className="text-sm text-slate-600">
            Kullanılan alan: {mb(usage.usage)} MB / {mb(usage.quota)} MB
          </p>
        )}
        {persisted === false && (
          <Button className="w-full" onClick={askPersist}>
            <ShieldCheck className="h-5 w-5" /> Kalıcı depolama izni iste
          </Button>
        )}
      </Card>

      <Card icon={<WifiOff className="h-5 w-5" />} title="Çevrimdışı kullanım">
        <p className="text-sm" data-testid="offline-status">
          {offlineReady ? '✅ Uygulama çevrimdışı kullanıma hazır.' : 'Uygulama ilk yüklemeden sonra çevrimdışı kullanıma hazırlanır…'}
        </p>
        <p className="text-sm text-slate-600">
          Ana ekrana eklemek için: iPhone’da Safari → Paylaş → “Ana Ekrana Ekle”. Android’de Chrome → ⋮ menü → “Ana ekrana ekle / Uygulamayı yükle”.
        </p>
      </Card>

      <p className="px-2 pb-2 text-center text-xs text-slate-500" data-testid="app-version">
        GROWTECH 2026 · Aydın Ticaret Borsası · Otobüs Yolcu ve Yoklama Sistemi · v{__APP_VERSION__}
      </p>

      {pending && (
        <ConfirmDialog
          title="Yedek geri yüklensin mi?"
          danger
          confirmLabel="Geri yükle"
          message={
            <>
              <p className="break-words">
                <b>{pending.label}</b>
              </p>
              <p className="mt-2">
                Yedekte: {pending.data.persons.filter((p) => !p.deletedAt).length} katılımcı, {pending.data.bus.length} otobüs yolcusu, {pending.data.sessions.length} yoklama oturumu,{' '}
                {pending.data.checks.length} yoklama işareti.
              </p>
              <p className="mt-2 text-slate-600">
                Mevcut verilerin yerini alacak. Önlem olarak mevcut verileriniz önce cihazda otomatik kopyaya alınır ve ayrıca JSON dosyası olarak indirilir.
              </p>
            </>
          }
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const d = pending.data;
            setPending(null);
            void doRestore(d);
          }}
        />
      )}
    </div>
  );
}
