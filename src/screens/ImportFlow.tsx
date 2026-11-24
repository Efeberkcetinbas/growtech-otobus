import { AlertTriangle, CheckCircle2, ChevronDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Button, Sheet } from '../components/ui';
import { db } from '../lib/db';
import { CATEGORY_REASON, computeStats, defaultSelection, type ParsedRow, type ParseResult } from '../lib/excel/parse';
import { readExcel } from '../lib/excel/read';
import {
  applyImport,
  applyVerification,
  defaultAssignments,
  FIELD_LABELS,
  NONE,
  planImport,
  SHARED,
  toIncoming,
  type Decisions,
  type ImportPlan,
  type RowVerification,
} from '../lib/import/merge';
import { toast } from '../lib/notify';
import { formatPhone } from '../lib/phone';
import { FLAG_LABELS, type ImportSnapshot } from '../types';

type Stage = 'pick' | 'parsing' | 'review' | 'plan' | 'applying';

export function ImportFlow({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [stage, setStage] = useState<Stage>('pick');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [verifications, setVerifications] = useState<Map<number, RowVerification>>(new Map());
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [decisions, setDecisions] = useState<Decisions>(new Map());

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setStage('parsing');
    setFileName(file.name);
    try {
      const res = await readExcel(await file.arrayBuffer());
      setResult(res);
      setSelected(defaultSelection(res));
      setVerifications(new Map());
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dosya okunamadı.');
      setStage('pick');
    }
  }

  async function buildPlan() {
    if (!result) return;
    try {
      const existing = await db.persons.toArray();
      const p = planImport(toIncoming(result, selected, verifications), existing);
      setPlan(p);
      setDecisions(new Map());
      setStage('plan');
    } catch (e) {
      toast(`Karşılaştırma yapılamadı: ${(e as Error).message}`, 'error');
    }
  }

  async function apply() {
    if (!plan) return;
    setStage('applying');
    try {
      const r = await applyImport(plan, decisions, fileName);
      toast(`İçe aktarıldı: ${r.created} yeni, ${r.updated + r.conflictsReplaced} güncellendi, ${r.unchanged + r.conflictsKept} korundu`);
      onDone();
    } catch {
      setStage('plan');
    }
  }

  const title = stage === 'plan' || stage === 'applying' ? 'Onay ve karşılaştırma' : 'Excel yükle';

  let footer: ReactNode = null;
  if (stage === 'review' && result) {
    footer = (
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setStage('pick')}>Başka dosya</Button>
        <Button variant="primary" onClick={buildPlan} disabled={selected.size === 0}>
          Devam
        </Button>
      </div>
    );
  } else if (stage === 'plan' || stage === 'applying') {
    footer = (
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setStage('review')} disabled={stage === 'applying'}>
          Geri
        </Button>
        <Button variant="primary" onClick={apply} disabled={stage === 'applying'} data-testid="import-confirm">
          {stage === 'applying' ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} İçe aktar
        </Button>
      </div>
    );
  }

  return (
    <Sheet title={title} onClose={stage === 'applying' ? () => undefined : onClose} footer={footer}>
      {(stage === 'pick' || stage === 'parsing') && (
        <div className="space-y-4 py-2">
          <p className="text-[15px] text-slate-700">
            Growtech üye listesi Excel dosyasını seçin (.xlsx). Dosya <b>yalnızca bu cihazda</b> okunur; internet üzerinden hiçbir yere gönderilmez.
          </p>
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-600/60 bg-brand-50 p-4 text-center font-semibold text-brand-900 active:bg-brand-50/60">
            {stage === 'parsing' ? <Loader2 className="h-10 w-10 animate-spin" /> : <FileSpreadsheet className="h-10 w-10" />}
            {stage === 'parsing' ? 'Dosya okunuyor…' : 'Excel dosyası seç'}
            <input
              type="file"
              accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="sr-only"
              data-testid="excel-input"
              disabled={stage === 'parsing'}
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Başlık satırı otomatik bulunur; sütun sırası önemli değildir.</li>
            <li>Yalnızca “Katılacak” ve “Otobüs” olan kayıtlar varsayılan olarak alınır.</li>
            <li>Yeni dosya yüklemek otobüs listenizi, yoklamalarınızı ve elle yaptığınız düzeltmeleri silmez.</li>
          </ul>
          {error && (
            <p role="alert" className="flex gap-2 rounded-xl bg-danger-50 p-3 text-sm font-semibold text-danger">
              <AlertTriangle className="h-5 w-5 shrink-0" /> {error}
            </p>
          )}
        </div>
      )}

      {stage === 'review' && result && (
        <Review
          result={result}
          fileName={fileName}
          selected={selected}
          setSelected={setSelected}
          verifications={verifications}
          setVerifications={setVerifications}
        />
      )}

      {(stage === 'plan' || stage === 'applying') && plan && <PlanView plan={plan} decisions={decisions} setDecisions={setDecisions} />}
    </Sheet>
  );
}

function Stat({ label, value, tone, testId }: { label: string; value: number; tone?: 'warn' | 'muted'; testId?: string }) {
  return (
    <div className={`rounded-xl p-2.5 ${tone === 'warn' && value > 0 ? 'bg-warn-50' : 'bg-surface'}`}>
      <p className={`text-xl font-extrabold tabular-nums ${tone === 'warn' && value > 0 ? 'text-[#8a5a12]' : ''}`} data-testid={testId}>
        {value}
      </p>
      <p className="text-xs leading-tight font-semibold text-slate-600">{label}</p>
    </div>
  );
}

function Section({ title, count, children, defaultOpen = false, tone }: { title: string; count: number; children: ReactNode; defaultOpen?: boolean; tone?: 'warn' }) {
  return (
    <details open={defaultOpen} className={`group rounded-2xl border ${tone === 'warn' ? 'border-warn/60' : 'border-slate-200'} bg-white`}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-3 font-bold">
        <span>
          {title} <span className="text-slate-500 tabular-nums">({count})</span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t border-slate-100 p-3">{children}</div>
    </details>
  );
}

function rowTitle(r: ParsedRow) {
  return (
    <p className="text-xs font-semibold text-slate-500">
      Satır {r.rowNumber}
      {r.sicilNo && ` · Sicil ${r.sicilNo}`}
      {r.transportRaw && ` · Ulaşım: “${r.transportRaw}”`}
    </p>
  );
}

function Review({
  result,
  fileName,
  selected,
  setSelected,
  verifications,
  setVerifications,
}: {
  result: ParseResult;
  fileName: string;
  selected: Set<number>;
  setSelected: (s: Set<number>) => void;
  verifications: Map<number, RowVerification>;
  setVerifications: (m: Map<number, RowVerification>) => void;
}) {
  const stats = useMemo(() => computeStats(result, selected), [result, selected]);
  const toggle = (n: number, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(n);
    else next.delete(n);
    setSelected(next);
  };
  const setMany = (rows: ParsedRow[], on: boolean) => {
    const next = new Set(selected);
    rows.forEach((r) => (on ? next.add(r.rowNumber) : next.delete(r.rowNumber)));
    setSelected(next);
  };
  const byCat = (c: ParsedRow['category']) => result.rows.filter((r) => r.category === c);
  const typo = byCat('typo');
  const other = byCat('other-transport');
  const unknown = byCat('unknown-transport');
  const verifyRows = result.rows.filter((r) => r.category !== 'excluded' && selected.has(r.rowNumber) && r.needsVerification);
  const missingPhone = result.rows
    .filter((r) => r.category !== 'excluded' && selected.has(r.rowNumber))
    .flatMap((r) => applyVerification(r, verifications.get(r.rowNumber)).filter((p) => !p.phone && !p.sharedPhones.length).map((p) => ({ r, p })));
  const excluded = result.rows.filter((r) => r.category === 'excluded');
  const reasons = [...new Set(excluded.map((r) => r.excludeReason))];

  return (
    <div className="space-y-3">
      <p className="text-sm break-all text-slate-600">
        <b>{fileName}</b> · Sayfa: {result.sheetName} · Başlık satırı: {result.header.headerIndex + 1}
      </p>
      {result.header.missingOptional.length > 0 && (
        <p className="rounded-xl bg-warn-50 p-2.5 text-sm text-[#6b4510]">Bulunamayan isteğe bağlı sütunlar: {result.header.missingOptional.join(', ')}</p>
      )}
      <div className="grid grid-cols-2 gap-2" data-testid="import-stats">
        <Stat label="Toplam satır" value={stats.totalRows} testId="stat-total" />
        <Stat label="Katılacak üye" value={stats.attendingRows} testId="stat-attending" />
        <Stat label="Otobüs kullanacak üye" value={stats.busRows} testId="stat-bus" />
        <Stat label="Ayrıştırılmış kişi (seçili)" value={stats.parsedPeople} testId="stat-people" />
        <Stat label="Telefonu eksik kişi" value={stats.missingPhone} tone="warn" />
        <Stat label="Doğrulama gereken kayıt" value={stats.verificationRows} tone="warn" testId="stat-verify" />
        <Stat label="Birden fazla katılımcılı kayıt" value={stats.multiPersonRows} />
        <Stat label="Dışarıda bırakılan kayıt" value={stats.excludedRows} tone="muted" testId="stat-excluded" />
      </div>
      {stats.sharedPhonePeople > 0 && (
        <p className="text-sm text-slate-600">{stats.sharedPhonePeople} kişide yalnızca ortak irtibat numarası var (kime ait olduğu belli değil).</p>
      )}

      {verifyRows.length > 0 && (
        <Section title="Doğrulama gerekli" count={verifyRows.length} defaultOpen tone="warn">
          <p className="text-sm text-slate-600">
            Aynı hücrede birden fazla isim/telefon var. Sıralı eşleştirme yalnızca öneridir. Her kişinin numarasını seçin ve “Eşleştirme doğru” kutusunu işaretleyin.
            İşaretlemezseniz kayıtlar “doğrulanmadı” uyarısıyla aktarılır.
          </p>
          {verifyRows.map((r) => (
            <VerifyRow key={r.rowNumber} row={r} value={verifications.get(r.rowNumber)} onChange={(v) => setVerifications(new Map(verifications).set(r.rowNumber, v))} />
          ))}
        </Section>
      )}

      {typo.length > 0 && (
        <Section title="Yazım hatası şüphesi (ör. OTOBÜD)" count={typo.length} defaultOpen tone="warn">
          <p className="text-sm text-slate-600">Ulaşım türü “Otobüs”e benziyor ama farklı yazılmış. Otobüs olarak kabul etmek için işaretleyin.</p>
          {typo.map((r) => (
            <RowToggle key={r.rowNumber} row={r} on={selected.has(r.rowNumber)} onChange={(on) => toggle(r.rowNumber, on)} label="Otobüs olarak kabul et" />
          ))}
        </Section>
      )}

      {other.length > 0 && (
        <Section title="Farklı ulaşım türü (ör. SPRİNTER)" count={other.length} defaultOpen>
          <p className="text-sm text-slate-600">Bu kayıtlar otomatik dahil edilmez. Otobüsünüze binebilecekse işaretleyin.</p>
          <GroupToggle rows={other} selected={selected} setMany={setMany} />
          {other.map((r) => (
            <RowToggle key={r.rowNumber} row={r} on={selected.has(r.rowNumber)} onChange={(on) => toggle(r.rowNumber, on)} label="Dahil et" />
          ))}
        </Section>
      )}

      {unknown.length > 0 && (
        <Section title="Katılacak, ulaşımı belirsiz" count={unknown.length}>
          <p className="text-sm text-slate-600">Ulaşım boş, “BELLİ DEĞİL” veya “DÖNECEK” yazılmış. Otomatik dahil edilmez.</p>
          <GroupToggle rows={unknown} selected={selected} setMany={setMany} />
          {unknown.map((r) => (
            <RowToggle key={r.rowNumber} row={r} on={selected.has(r.rowNumber)} onChange={(on) => toggle(r.rowNumber, on)} label="Dahil et" />
          ))}
        </Section>
      )}

      {missingPhone.length > 0 && (
        <Section title="Telefonu olmayan kişiler" count={missingPhone.length}>
          <p className="text-sm text-slate-600">Numara uydurulmaz. Aktarımdan sonra “Düzelt” ile ekleyebilirsiniz.</p>
          {missingPhone.map(({ r, p }) => (
            <div key={p.sourceKey} className="rounded-xl bg-surface p-2.5">
              <p className="font-bold">{p.fullName}</p>
              <p className="text-sm text-slate-600">{r.company}</p>
            </div>
          ))}
        </Section>
      )}

      <Section title="Dışarıda bırakılanlar" count={excluded.length}>
        {reasons.map((reason) => {
          const rows = excluded.filter((r) => r.excludeReason === reason);
          return (
            <details key={reason} className="rounded-xl bg-surface">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between px-3 text-sm font-semibold">
                {reason} <span className="tabular-nums">{rows.length}</span>
              </summary>
              <ul className="space-y-1 px-3 pb-2 text-sm">
                {rows.map((r) => (
                  <li key={r.rowNumber} className="break-words">
                    <span className="text-slate-500">#{r.rowNumber}</span> {r.company}
                    {r.people.length > 0 && <span className="text-slate-600"> — {r.people.map((p) => p.fullName).join(', ')}</span>}
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
        {Object.entries(stats.excludedByReason)
          .filter(([reason]) => Object.values(CATEGORY_REASON).includes(reason))
          .map(([reason, n]) => (
            <p key={reason} className="px-1 text-sm text-slate-600">
              Seçilmeyen: {reason} — {n}
            </p>
          ))}
      </Section>
    </div>
  );
}

function GroupToggle({ rows, selected, setMany }: { rows: ParsedRow[]; selected: Set<number>; setMany: (rows: ParsedRow[], on: boolean) => void }) {
  const all = rows.every((r) => selected.has(r.rowNumber));
  return (
    <Button className="w-full text-sm" onClick={() => setMany(rows, !all)}>
      {all ? 'Hiçbirini dahil etme' : `Tümünü dahil et (${rows.length})`}
    </Button>
  );
}

function RowToggle({ row, on, onChange, label }: { row: ParsedRow; on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <label className={`flex min-h-11 items-start gap-3 rounded-xl border p-2.5 ${on ? 'border-brand-600 bg-brand-50' : 'border-slate-200'}`}>
      <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-brand-600" checked={on} onChange={(e) => onChange(e.target.checked)} aria-label={`${label}: ${row.people.map((p) => p.fullName).join(', ')}`} />
      <span className="min-w-0 flex-1">
        {rowTitle(row)}
        <span className="block font-bold break-words">{row.people.map((p) => p.fullName).join(' / ') || '—'}</span>
        <span className="block text-sm break-words text-slate-600">
          {row.company}
          {row.boarding && ` · ${row.boarding}`}
        </span>
      </span>
    </label>
  );
}

function VerifyRow({ row, value, onChange }: { row: ParsedRow; value?: RowVerification; onChange: (v: RowVerification) => void }) {
  const v = value ?? { verified: false, assignments: defaultAssignments(row) };
  const options = row.people[0]?.phoneOptions ?? [];
  return (
    <div className={`space-y-2 rounded-xl border p-2.5 ${v.verified ? 'border-brand-600 bg-brand-50' : 'border-warn/60 bg-warn-50/50'}`} data-testid="verify-row">
      {rowTitle(row)}
      <p className="text-sm font-semibold break-words">{row.company}</p>
      {row.people.map((p, i) => (
        <label key={p.sourceKey} className="block">
          <span className="block font-bold break-words">
            {p.fullName}
            {p.role && <span className="font-normal text-slate-600"> ({p.role})</span>}
          </span>
          <select
            value={v.assignments[i]}
            onChange={(e) => {
              const assignments = [...v.assignments];
              assignments[i] = e.target.value;
              onChange({ verified: true, assignments });
            }}
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-2 tabular-nums"
            aria-label={`${p.fullName} telefon numarası`}
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {formatPhone(o)}
              </option>
            ))}
            {options.length > 0 && <option value={SHARED}>Ortak irtibat (kişiye atanmamış)</option>}
            <option value={NONE}>Telefon yok</option>
          </select>
          <span className="mt-0.5 block text-xs text-[#8a5a12]">{p.flags.filter((f) => f !== 'boarding-unknown').map((f) => FLAG_LABELS[f]).join(' · ')}</span>
        </label>
      ))}
      <label className="flex min-h-11 items-center gap-2 font-semibold">
        <input type="checkbox" className="h-6 w-6 accent-brand-600" checked={v.verified} onChange={(e) => onChange({ ...v, verified: e.target.checked })} />
        Eşleştirme doğru
      </label>
    </div>
  );
}

function fmt(field: keyof ImportSnapshot, s: ImportSnapshot) {
  if (field === 'sharedPhones') return s.sharedPhones.map(formatPhone).join(' / ') || '—';
  if (field === 'phone') return s.phone ? formatPhone(s.phone) : '—';
  return s[field] || '—';
}

function PlanView({ plan, decisions, setDecisions }: { plan: ImportPlan; decisions: Decisions; setDecisions: (d: Decisions) => void }) {
  const count = (k: string) => plan.items.filter((i) => i.kind === k).length;
  const conflicts = plan.items.filter((i) => i.kind === 'conflict');
  const dups = plan.items.filter((i) => i.kind === 'duplicate');
  const set = (key: string, val: Decisions extends Map<string, infer V> ? V : never) => setDecisions(new Map(decisions).set(key, val));
  return (
    <div className="space-y-3">
      <div className="flex gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <p>Otobüs listeniz, yoklamalarınız ve elle eklediğiniz kişiler korunur. İşlemden önce mevcut verilerin otomatik kopyası alınır.</p>
      </div>
      <div className="grid grid-cols-2 gap-2" data-testid="plan-stats">
        <Stat label="Yeni eklenecek" value={count('new')} testId="plan-new" />
        <Stat label="Güncellenecek" value={count('update')} />
        <Stat label="Değişmeyen" value={count('unchanged')} testId="plan-unchanged" />
        <Stat label="Çakışma (onayınız gerekli)" value={conflicts.length} tone="warn" />
        <Stat label="Olası mükerrer" value={dups.length} tone="warn" />
        <Stat label="Yeni Excel’de olmayan (silinmez)" value={plan.missing.length} />
      </div>

      {conflicts.length > 0 && (
        <Section title="Çakışmalar" count={conflicts.length} defaultOpen tone="warn">
          <p className="text-sm text-slate-600">Bu kişileri elle düzenlemiştiniz ve Excel’de de değişmiş. Hangisi kalsın?</p>
          {conflicts.map((c) => {
            if (c.kind !== 'conflict') return null;
            const key = c.incoming.person.sourceKey;
            const choice = decisions.get(key) ?? 'keep';
            const cur = { fullName: c.existing.fullName, phone: c.existing.phone, sharedPhones: c.existing.sharedPhones, company: c.existing.company, boardingPlace: c.existing.boardingPlace };
            return (
              <div key={key} className="space-y-1.5 rounded-xl border border-slate-200 p-2.5">
                <p className="font-bold">{c.existing.fullName}</p>
                {c.changes.map((f) => (
                  <p key={f} className="text-sm">
                    <b>{FIELD_LABELS[f]}:</b> sizdeki “{fmt(f, cur)}” · Excel “{fmt(f, c.incoming.snapshot)}”
                  </p>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={choice === 'keep' ? 'primary' : 'secondary'} aria-pressed={choice === 'keep'} onClick={() => set(key, 'keep')} className="text-sm">
                    Benimki kalsın
                  </Button>
                  <Button variant={choice === 'excel' ? 'primary' : 'secondary'} aria-pressed={choice === 'excel'} onClick={() => set(key, 'excel')} className="text-sm">
                    Excel’i kullan
                  </Button>
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {dups.length > 0 && (
        <Section title="Olası mükerrer kayıtlar" count={dups.length} defaultOpen tone="warn">
          <p className="text-sm text-slate-600">Excel’deki kişi, elle eklediğiniz bir kişiye benziyor. Aynı kişiyse birleştirin (sizin bilgileriniz korunur).</p>
          {dups.map((d) => {
            if (d.kind !== 'duplicate') return null;
            const key = d.incoming.person.sourceKey;
            const choice = decisions.get(key) ?? 'new';
            return (
              <div key={key} className="space-y-1.5 rounded-xl border border-slate-200 p-2.5">
                <p className="font-bold">Excel: {d.incoming.person.fullName}</p>
                <p className="text-sm text-slate-600">{d.incoming.row.company}</p>
                {d.candidates.map((cand) => (
                  <Button
                    key={cand.id}
                    className="w-full text-sm"
                    variant={choice === `link:${cand.id}` ? 'primary' : 'secondary'}
                    aria-pressed={choice === `link:${cand.id}`}
                    onClick={() => set(key, `link:${cand.id}`)}
                  >
                    Aynı kişi: {cand.fullName}
                    {cand.phone && ` (${formatPhone(cand.phone)})`}
                  </Button>
                ))}
                <Button className="w-full text-sm" variant={choice === 'new' ? 'primary' : 'secondary'} aria-pressed={choice === 'new'} onClick={() => set(key, 'new')}>
                  Farklı kişi, ayrı ekle
                </Button>
              </div>
            );
          })}
        </Section>
      )}

      {plan.missing.length > 0 && (
        <Section title="Yeni Excel’de bulunmayanlar" count={plan.missing.length}>
          <p className="text-sm text-slate-600">Bu kişiler silinmez; “Son Excel’de yok” etiketiyle işaretlenir.</p>
          {plan.missing.map((p) => (
            <p key={p.id} className="text-sm">
              {p.fullName} <span className="text-slate-500">· {p.company}</span>
            </p>
          ))}
        </Section>
      )}
    </div>
  );
}
