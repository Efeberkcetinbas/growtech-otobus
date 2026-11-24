import { Check, ClipboardCheck, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { CallButton, PhoneLine } from '../components/PersonBits';
import { Button, Chip, ConfirmDialog, EmptyState, SearchBox, Sheet } from '../components/ui';
import type { AppData } from '../hooks/useAppData';
import { toast } from '../lib/notify';
import { clearChecks, createSession, deleteSession, setSetting, toggleCheck } from '../lib/repo';
import { filterPersons } from '../lib/search';

type Filter = 'all' | 'boarded' | 'waiting';

export function AttendanceScreen({ data, goParticipants }: { data: AppData; goParticipants: () => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<null | 'reset' | 'delete'>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const deferred = useDeferredValue(query);
  const session = data.activeSession;
  const { total, boarded, waiting } = { total: data.stats.onBus, boarded: data.stats.boarded, waiting: data.stats.waiting };

  const visible = useMemo(() => {
    const byFilter = data.busEntries.filter((e) => (filter === 'all' ? true : filter === 'boarded' ? data.checkedIds.has(e.person.id) : !data.checkedIds.has(e.person.id)));
    const ids = new Set(filterPersons(byFilter.map((e) => e.person), deferred).map((p) => p.id));
    return byFilter.filter((e) => ids.has(e.person.id));
  }, [data.busEntries, data.checkedIds, filter, deferred]);

  async function toggle(personId: string) {
    if (!session) return;
    try {
      await toggleCheck(session.id, personId);
    } catch {
      /* guarded bildirir */
    }
  }

  async function addSession() {
    try {
      const s = await createSession(newName);
      setNewOpen(false);
      setNewName('');
      toast(`“${s.name}” yoklaması oluşturuldu`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const pct = total ? Math.round((boarded / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 px-1 text-sm font-semibold text-slate-600">Yoklama oturumu</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Yoklama oturumu">
          {data.sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={s.id === session?.id}
              onClick={() => void setSetting('activeSessionId', s.id)}
              className={`min-h-11 rounded-xl border px-3.5 text-[15px] font-bold ${
                s.id === session?.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-ink active:bg-slate-100'
              }`}
            >
              {s.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-dashed border-brand-600 px-3 text-[15px] font-semibold text-brand-600 active:bg-brand-50"
          >
            <Plus className="h-5 w-5" /> Yeni yoklama
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-3 text-center">
          <div>
            <p className="text-2xl font-extrabold tabular-nums">{total}</p>
            <p className="text-xs font-semibold text-slate-600">Toplam yolcu</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-brand-600 tabular-nums" data-testid="att-boarded">
              {boarded}
            </p>
            <p className="text-xs font-semibold text-slate-600">Binen</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#a8670f] tabular-nums" data-testid="att-waiting">
              {waiting}
            </p>
            <p className="text-xs font-semibold text-slate-600">Beklenen</p>
          </div>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Yoklama ilerlemesi">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-right text-xs font-semibold text-slate-600">%{pct}</p>
      </div>

      {total === 0 ? (
        <EmptyState icon={<ClipboardCheck className="h-12 w-12" />} title="Yoklama için yolcu yok">
          <p className="text-[15px] text-slate-600">Yoklamada yalnızca otobüs listenizdeki kişiler görünür.</p>
          <Button variant="primary" className="w-full" onClick={goParticipants}>
            Katılımcılara git
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Chip active={filter === 'all'} onClick={() => setFilter('all')} count={total}>
                Tümü
              </Chip>
              <Chip active={filter === 'boarded'} onClick={() => setFilter('boarded')} count={boarded}>
                Binenler
              </Chip>
              <Chip active={filter === 'waiting'} onClick={() => setFilter('waiting')} count={waiting}>
                Beklenenler
              </Chip>
            </div>
            {total > 8 && <SearchBox value={query} onChange={setQuery} label="Yoklamada ara" placeholder="Yoklamada ara" />}
          </div>

          {visible.length === 0 && (
            <p className="px-1 py-4 text-center text-slate-600">{filter === 'waiting' ? 'Herkes bindi. 🎉' : 'Bu filtrede kişi yok.'}</p>
          )}

          <ul className="space-y-2">
            {visible.map(({ person: p, seq }) => {
              const on = data.checkedIds.has(p.id);
              return (
                <li
                  key={p.id}
                  data-testid="att-row"
                  data-checked={on}
                  className={`flex items-stretch gap-1 rounded-2xl border p-1.5 shadow-sm ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white'}`}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`${p.fullName} – ${on ? 'bindi, işareti kaldır' : 'bindi olarak işaretle'}`}
                    onClick={() => toggle(p.id)}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 text-left"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 ${on ? 'border-white bg-white text-brand-600' : 'border-slate-400 bg-white'}`}
                      aria-hidden
                    >
                      {on && <Check className="h-7 w-7" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] leading-tight font-bold break-words">
                        <span className={`mr-1 text-sm tabular-nums ${on ? 'text-white/80' : 'text-slate-500'}`}>{seq}.</span>
                        {p.fullName}
                      </span>
                      <span className={`mt-0.5 block text-sm ${on ? 'text-white/90' : 'text-slate-600'}`}>
                        {on ? <b>Bindi</b> : <span>Bekleniyor</span>}
                        {p.boardingPlace && ` · ${p.boardingPlace}`}
                      </span>
                      {!on && (
                        <span className="mt-0.5 block text-sm">
                          <PhoneLine person={p} />
                        </span>
                      )}
                    </span>
                  </button>
                  {!on && (
                    <div className="flex items-center pr-1">
                      <CallButton person={p} compact />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="grid gap-2 pt-3">
            <Button variant="danger" onClick={() => setConfirm('reset')} disabled={boarded === 0}>
              <RotateCcw className="h-5 w-5" /> “{session?.name}” tiklerini temizle
            </Button>
          </div>
        </>
      )}

      {data.sessions.length > 1 && (
        <Button variant="ghost" className="w-full text-sm text-slate-600" onClick={() => setConfirm('delete')}>
          <Trash2 className="h-4 w-4" /> “{session?.name}” oturumunu sil
        </Button>
      )}

      {newOpen && (
        <Sheet
          title="Yeni yoklama oturumu"
          onClose={() => setNewOpen(false)}
          footer={
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setNewOpen(false)}>Vazgeç</Button>
              <Button variant="primary" type="submit" form="session-form" disabled={!newName.trim()}>
                Oluştur
              </Button>
            </div>
          }
        >
          <form
            id="session-form"
            onSubmit={(e) => {
              e.preventDefault();
              void addSession();
            }}
            className="space-y-3"
          >
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Oturum adı</span>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
                placeholder="ör. Mola sonrası"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {['Mola sonrası', 'Fuar çıkışı', 'Öğle arası'].map((n) => (
                <Chip key={n} active={newName === n} onClick={() => setNewName(n)}>
                  {n}
                </Chip>
              ))}
            </div>
            <p className="text-sm text-slate-600">Yeni oturum boş başlar. Diğer yoklamalar ve yolcu listesi değişmez.</p>
          </form>
        </Sheet>
      )}

      {confirm === 'reset' && session && (
        <ConfirmDialog
          title="Tikler temizlensin mi?"
          danger
          confirmLabel="Tikleri temizle"
          message={
            <>
              <p>
                Yalnızca <b>“{session.name}”</b> yoklamasındaki <b>{boarded}</b> işaret kaldırılacak.
              </p>
              <p className="mt-2 text-slate-600">Yolcu listesi ve diğer yoklama oturumları etkilenmez.</p>
            </>
          }
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setConfirm(null);
            try {
              await clearChecks(session.id);
              toast(`“${session.name}” yoklaması sıfırlandı`, 'info');
            } catch {
              /* guarded bildirir */
            }
          }}
        />
      )}

      {confirm === 'delete' && session && (
        <ConfirmDialog
          title="Oturum silinsin mi?"
          danger
          confirmLabel="Oturumu sil"
          message={
            <>
              <p>
                <b>“{session.name}”</b> oturumu ve bu oturumdaki yoklama işaretleri silinecek.
              </p>
              <p className="mt-2 text-slate-600">Yolcu listesi ve diğer oturumlar etkilenmez.</p>
            </>
          }
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setConfirm(null);
            try {
              await deleteSession(session.id);
              toast('Oturum silindi', 'info');
            } catch {
              /* guarded bildirir */
            }
          }}
        />
      )}
    </div>
  );
}
