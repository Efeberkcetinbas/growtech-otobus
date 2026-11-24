import { Check, FileSpreadsheet, Pencil, Plus, UserPlus, Users } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { DeleteButton, DeletePersonDialog } from '../components/DeletePerson';
import { CallButton, FlagBadges, MetaLines, PhoneLine } from '../components/PersonBits';
import { needsCheck } from '../lib/person';
import { Button, Chip, EmptyState, SearchBox } from '../components/ui';
import type { AppData } from '../hooks/useAppData';
import { toast } from '../lib/notify';
import { addToBus } from '../lib/repo';
import { matches, searchIndex } from '../lib/search';
import { compareTr } from '../lib/text';
import type { Person } from '../types';

type Filter = 'all' | 'not-on-bus' | 'check';
const RENDER_STEP = 60;

export function ParticipantsScreen({ data, onEdit, onNew, onImport }: { data: AppData; onEdit: (p: Person) => void; onNew: () => void; onImport: () => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [boarding, setBoarding] = useState('');
  const [limit, setLimit] = useState(RENDER_STEP);
  const [toDelete, setToDelete] = useState<Person | null>(null);
  const deferred = useDeferredValue(query);

  const indexed = useMemo(
    () => [...data.persons].sort((a, b) => compareTr(a.fullName, b.fullName)).map((p) => ({ p, idx: searchIndex(p) })),
    [data.persons],
  );
  const boardingOptions = useMemo(() => [...new Set(data.persons.map((p) => p.boardingPlace).filter(Boolean))].sort(compareTr), [data.persons]);

  const list = useMemo(
    () =>
      indexed
        .filter(({ p, idx }) => {
          if (filter === 'not-on-bus' && data.busIds.has(p.id)) return false;
          if (filter === 'check' && !needsCheck(p)) return false;
          if (boarding === '__none' ? p.boardingPlace !== '' : boarding && p.boardingPlace !== boarding) return false;
          return matches(idx, deferred);
        })
        .map(({ p }) => p),
    [indexed, filter, boarding, deferred, data.busIds],
  );

  const notOnBus = data.persons.filter((p) => !data.busIds.has(p.id)).length;
  const checkCount = data.persons.filter(needsCheck).length;

  async function add(p: Person) {
    try {
      const added = await addToBus(p.id);
      toast(added ? `${p.fullName} otobüsünüze eklendi` : `${p.fullName} zaten otobüsünüzde`, added ? 'success' : 'info');
    } catch {
      /* guarded bildirir */
    }
  }

  if (!data.persons.length) {
    return (
      <div className="space-y-4">
        <EmptyState icon={<FileSpreadsheet className="h-12 w-12" />} title="Henüz katılımcı yok">
          <p className="text-[15px] text-slate-600">
            Üye listesi Excel dosyasını yükleyin. Dosya yalnızca bu cihazda okunur, hiçbir yere gönderilmez.
          </p>
          <Button variant="primary" className="w-full" onClick={onImport}>
            <FileSpreadsheet className="h-5 w-5" /> Excel yükle
          </Button>
          <Button className="w-full" onClick={onNew}>
            <UserPlus className="h-5 w-5" /> Elle katılımcı ekle
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-[var(--header-h)] z-20 -mx-3 bg-surface px-3 pt-1 pb-2">
        <SearchBox value={query} onChange={(v) => { setQuery(v); setLimit(RENDER_STEP); }} label="Katılımcı ara" placeholder="İsim, firma, telefon, biniş yeri" />
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')} count={data.persons.length}>
            Tümü
          </Chip>
          <Chip active={filter === 'not-on-bus'} onClick={() => setFilter('not-on-bus')} count={notOnBus}>
            Eklenmemiş
          </Chip>
          {checkCount > 0 && (
            <Chip active={filter === 'check'} onClick={() => setFilter('check')} count={checkCount}>
              Kontrol gerekli
            </Chip>
          )}
          <select
            aria-label="Biniş yerine göre filtrele"
            value={boarding}
            onChange={(e) => setBoarding(e.target.value)}
            className="h-11 max-w-full min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-3 text-sm font-semibold"
          >
            <option value="">Tüm biniş yerleri</option>
            {boardingOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
            <option value="__none">Belirtilmemiş</option>
          </select>
        </div>
      </div>

      <Button variant="primary" className="w-full" onClick={onNew}>
        <Plus className="h-5 w-5" /> Yeni Katılımcı
      </Button>

      <p className="px-1 text-sm text-slate-600" aria-live="polite">
        {list.length} kişi listeleniyor
      </p>

      {list.length === 0 && (
        <EmptyState icon={<Users className="h-10 w-10" />} title="Sonuç bulunamadı">
          <p className="text-sm text-slate-600">Aradığınız kişi listede yoksa yeni katılımcı olarak ekleyebilirsiniz.</p>
          <Button variant="primary" onClick={onNew}>
            <UserPlus className="h-5 w-5" /> Yeni Katılımcı
          </Button>
        </EmptyState>
      )}

      <ul className="space-y-2.5">
        {list.slice(0, limit).map((p) => {
          const onBus = data.busIds.has(p.id);
          return (
            <li key={p.id} className={`rounded-2xl border bg-white p-3 shadow-sm ${onBus ? 'border-brand-600/40' : 'border-slate-200'}`} data-testid="participant-card">
              <div className="flex flex-col gap-1">
                <p className="text-[17px] leading-tight font-bold break-words">{p.fullName}</p>
                <PhoneLine person={p} />
                <MetaLines person={p} />
                {p.note && <p className="text-sm break-words text-slate-500">{p.note}</p>}
                <FlagBadges flags={p.flags} />
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2 min-[360px]:grid-cols-[1fr_auto_auto_auto]">
                {onBus ? (
                  <Button
                    variant="success"
                    aria-disabled="true"
                    className="col-span-3 cursor-default min-[360px]:col-span-1"
                    onClick={() => toast(`${p.fullName} zaten otobüsünüzde`, 'info')}
                  >
                    <Check className="h-5 w-5" /> Otobüsümde
                  </Button>
                ) : (
                  <Button variant="primary" className="col-span-3 min-[360px]:col-span-1" onClick={() => add(p)}>
                    <Plus className="h-5 w-5" /> Otobüsüme ekle
                  </Button>
                )}
                <CallButton person={p} compact />
                <Button aria-label={`${p.fullName} bilgilerini düzelt`} onClick={() => onEdit(p)}>
                  <Pencil className="h-5 w-5" />
                  <span className="sr-only sm:not-sr-only">Düzelt</span>
                </Button>
                <DeleteButton person={p} onClick={() => setToDelete(p)} />
              </div>
            </li>
          );
        })}
      </ul>
      {list.length > limit && (
        <Button className="w-full" onClick={() => setLimit((l) => l + RENDER_STEP)}>
          Daha fazla göster ({list.length - limit})
        </Button>
      )}
      {toDelete && <DeletePersonDialog person={toDelete} onBus={data.busIds.has(toDelete.id)} onClose={() => setToDelete(null)} />}
    </div>
  );
}
