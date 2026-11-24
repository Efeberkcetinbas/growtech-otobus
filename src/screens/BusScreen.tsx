import { Bus, Copy, Download, Pencil, Share2, Trash2, UserMinus } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { DeleteButton, DeletePersonDialog } from '../components/DeletePerson';
import { CallButton, FlagBadges, MetaLines, PhoneLine } from '../components/PersonBits';
import { Button, ConfirmDialog, EmptyState, SearchBox } from '../components/ui';
import type { AppData, BusEntry } from '../hooks/useAppData';
import { db } from '../lib/db';
import { copyText, downloadBusExcel, listToText } from '../lib/export';
import { toast } from '../lib/notify';
import { addToBus, clearBus, removeFromBus } from '../lib/repo';
import { filterPersons } from '../lib/search';
import { compareTr } from '../lib/text';
import type { Person } from '../types';

type Sort = 'added' | 'name' | 'boarding';

function sortEntries(entries: BusEntry[], sort: Sort): BusEntry[] {
  const list = [...entries];
  if (sort === 'name') list.sort((a, b) => compareTr(a.person.fullName, b.person.fullName));
  if (sort === 'boarding')
    list.sort((a, b) => compareTr(a.person.boardingPlace || '\uffff', b.person.boardingPlace || '\uffff') || compareTr(a.person.fullName, b.person.fullName));
  return list;
}

export function BusScreen({ data, onEdit, goParticipants }: { data: AppData; onEdit: (p: Person) => void; goParticipants: () => void }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('added');
  const [confirmClear, setConfirmClear] = useState(false);
  const [toDelete, setToDelete] = useState<Person | null>(null);
  const deferred = useDeferredValue(query);

  const sorted = useMemo(() => sortEntries(data.busEntries, sort), [data.busEntries, sort]);
  const visible = useMemo(() => {
    const ids = new Set(filterPersons(sorted.map((e) => e.person), deferred).map((p) => p.id));
    return sorted.filter((e) => ids.has(e.person.id));
  }, [sorted, deferred]);

  async function remove(p: Person) {
    try {
      await removeFromBus(p.id);
      toast(`${p.fullName} otobüsten çıkarıldı (katılımcı listesinde duruyor)`, 'info', { label: 'Geri al', run: () => void addToBus(p.id) });
    } catch {
      /* guarded bildirir */
    }
  }

  async function copy() {
    toast((await copyText(listToText(sorted))) ? 'Liste panoya kopyalandı' : 'Kopyalanamadı', 'info');
  }

  async function share() {
    const text = listToText(sorted);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'GROWTECH 2026 – Otobüs listem', text });
      } catch (e) {
        if ((e as Error).name !== 'AbortError') toast('Paylaşılamadı', 'error');
      }
    } else {
      toast((await copyText(text)) ? 'Paylaşım desteklenmiyor; liste panoya kopyalandı' : 'Paylaşılamadı', 'info');
    }
  }

  async function exportExcel() {
    try {
      const checks = await db.checks.toArray();
      await downloadBusExcel(sorted, data.sessions, checks);
      toast('Excel dosyası indirildi');
    } catch (e) {
      toast(`Excel oluşturulamadı: ${(e as Error).message}`, 'error');
    }
  }

  if (!data.busEntries.length) {
    return (
      <EmptyState icon={<Bus className="h-12 w-12" />} title="Otobüs listeniz boş">
        <p className="text-[15px] text-slate-600">Katılımcılar ekranında kişiyi arayıp “Otobüsüme ekle” düğmesine dokunun.</p>
        <Button variant="primary" className="w-full" onClick={goParticipants}>
          Katılımcılara git
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl bg-brand-900 px-4 py-3 text-white">
        <span className="text-[15px] font-semibold">Toplam yolcu</span>
        <span className="text-3xl font-extrabold tabular-nums" data-testid="bus-total">
          {data.busEntries.length}
        </span>
      </div>

      <div className="sticky top-[var(--header-h)] z-20 -mx-3 bg-surface px-3 pt-1 pb-2">
        <SearchBox value={query} onChange={setQuery} label="Otobüs listesinde ara" placeholder="Listede ara" />
      </div>
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          Sırala
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-11 min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-3">
            <option value="added">Eklenme sırası</option>
            <option value="name">İsim (A–Z)</option>
            <option value="boarding">Biniş yeri</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button onClick={copy} className="flex-col !gap-0.5 py-1 text-xs">
          <Copy className="h-5 w-5" /> Kopyala
        </Button>
        <Button onClick={share} className="flex-col !gap-0.5 py-1 text-xs">
          <Share2 className="h-5 w-5" /> Paylaş
        </Button>
        <Button onClick={exportExcel} className="flex-col !gap-0.5 py-1 text-xs">
          <Download className="h-5 w-5" /> Excel indir
        </Button>
      </div>

      {visible.length === 0 && <p className="px-1 py-4 text-center text-slate-600">Aramaya uyan yolcu yok.</p>}

      <ol className="space-y-2.5">
        {visible.map(({ person: p, seq }, i) => (
          <li key={p.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" data-testid="bus-row">
            <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-brand-50 px-1 text-[15px] font-bold text-brand-900 tabular-nums" title={`Eklenme sırası ${seq}`}>
              {sort === 'added' ? seq : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-1">
                <p className="text-[17px] leading-tight font-bold break-words">{p.fullName}</p>
                <PhoneLine person={p} />
                <MetaLines person={p} />
                <FlagBadges flags={p.flags} />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <CallButton person={p} labelClassName="sr-only min-[360px]:not-sr-only" />
                <Button aria-label={`${p.fullName} bilgilerini düzelt`} onClick={() => onEdit(p)}>
                  <Pencil className="h-5 w-5" />
                  <span className="sr-only min-[360px]:not-sr-only">Düzelt</span>
                </Button>
                <DeleteButton person={p} onClick={() => setToDelete(p)} />
                {/* Yalnızca otobüsten çıkarır; katılımcı kaydı silinmez */}
                <Button aria-label={`${p.fullName} listeden çıkar`} onClick={() => remove(p)}>
                  <UserMinus className="h-5 w-5" />
                  <span className="sr-only min-[360px]:not-sr-only">Çıkar</span>
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <Button variant="danger" className="mt-4 w-full" onClick={() => setConfirmClear(true)}>
        <Trash2 className="h-5 w-5" /> Tüm otobüs listesini temizle
      </Button>

      {toDelete && <DeletePersonDialog person={toDelete} onBus onClose={() => setToDelete(null)} />}

      {confirmClear && (
        <ConfirmDialog
          title="Otobüs listesi temizlensin mi?"
          danger
          confirmLabel="Listeyi temizle"
          message={
            <>
              <p>
                Otobüsünüzdeki <b>{data.busEntries.length} kişi</b> listeden çıkarılacak.
              </p>
              <p className="mt-2 text-slate-600">Kişiler katılımcı havuzunda kalır. Yoklama geçmişi silinmez.</p>
            </>
          }
          onCancel={() => setConfirmClear(false)}
          onConfirm={async () => {
            setConfirmClear(false);
            try {
              await clearBus();
              toast('Otobüs listesi temizlendi', 'info');
            } catch {
              /* guarded bildirir */
            }
          }}
        />
      )}
    </div>
  );
}
