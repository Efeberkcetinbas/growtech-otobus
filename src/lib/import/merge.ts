import type { Flag, ImportSnapshot, Person } from '../../types';
import { db } from '../db';
import type { ParsedPerson, ParsedRow, ParseResult } from '../excel/parse';
import { guarded } from '../notify';
import { saveSnapshot, uid } from '../repo';
import { digitsOnly, foldTr } from '../text';

export const SHARED = '__shared';
export const NONE = '__none';

/** Önizlemede kullanıcının bir satır için yaptığı doğrulama. */
export interface RowVerification {
  verified: boolean;
  /** Her kişi için: numara | SHARED | NONE */
  assignments: string[];
}

export function defaultAssignments(row: ParsedRow): string[] {
  return row.people.map((p) => p.phone || (p.sharedPhones.length ? SHARED : NONE));
}

/** Kullanıcının eşleştirme seçimlerini kişilere uygular. */
export function applyVerification(row: ParsedRow, v: RowVerification | undefined): ParsedPerson[] {
  if (!v) return row.people.map((p) => ({ ...p, flags: [...p.flags] }));
  const assigned = new Set(v.assignments.filter((a) => a !== SHARED && a !== NONE));
  const leftover = (row.people[0]?.phoneOptions ?? []).filter((ph) => !assigned.has(ph));
  return row.people.map((p, i) => {
    const a = v.assignments[i] ?? NONE;
    const phone = a === SHARED || a === NONE ? '' : a;
    const sharedPhones = a === SHARED ? leftover : [];
    let flags: Flag[] = p.flags.filter((f) => !['missing-phone', 'shared-phone', 'extra-phone'].includes(f));
    if (v.verified) flags = flags.filter((f) => f !== 'pairing-unverified' && f !== 'ambiguous-separator');
    if (sharedPhones.length) flags.push('shared-phone');
    if (!phone && !sharedPhones.length) flags.push('missing-phone');
    return { ...p, phone, sharedPhones, flags };
  });
}

export interface IncomingPerson {
  row: ParsedRow;
  person: ParsedPerson;
  snapshot: ImportSnapshot;
  note: string;
}

export type PlanItem =
  | { kind: 'new'; incoming: IncomingPerson }
  | { kind: 'unchanged'; incoming: IncomingPerson; existing: Person }
  | { kind: 'update'; incoming: IncomingPerson; existing: Person; changes: (keyof ImportSnapshot)[] }
  | { kind: 'conflict'; incoming: IncomingPerson; existing: Person; changes: (keyof ImportSnapshot)[] }
  | { kind: 'duplicate'; incoming: IncomingPerson; candidates: Person[] };

export interface ImportPlan {
  items: PlanItem[];
  /** Daha önce Excel'den gelen ama yeni dosyada olmayan kişiler (silinmez, işaretlenir). */
  missing: Person[];
}

export const FIELD_LABELS: Record<keyof ImportSnapshot, string> = {
  fullName: 'Ad soyad',
  phone: 'Telefon',
  sharedPhones: 'Ortak irtibat',
  company: 'Firma',
  boardingPlace: 'Biniş yeri',
};

function buildNote(row: ParsedRow, person: ParsedPerson): string {
  const parts: string[] = [];
  if (person.role) parts.push(`Görev/yakınlık: ${person.role}`);
  if (row.extraNote) parts.push(`Excel notu: ${row.extraNote}`);
  return parts.join(' · ');
}

export function toIncoming(result: ParseResult, selected: Set<number>, verifications: Map<number, RowVerification>): IncomingPerson[] {
  const out: IncomingPerson[] = [];
  for (const row of result.rows) {
    if (row.category === 'excluded' || !selected.has(row.rowNumber)) continue;
    for (const person of applyVerification(row, verifications.get(row.rowNumber))) {
      out.push({
        row,
        person,
        note: buildNote(row, person),
        snapshot: {
          fullName: person.fullName,
          phone: person.phone,
          sharedPhones: person.sharedPhones,
          company: row.company,
          boardingPlace: row.boarding,
        },
      });
    }
  }
  return out;
}

function diff(a: ImportSnapshot, b: ImportSnapshot): (keyof ImportSnapshot)[] {
  const keys: (keyof ImportSnapshot)[] = ['fullName', 'phone', 'sharedPhones', 'company', 'boardingPlace'];
  return keys.filter((k) => (k === 'sharedPhones' ? a[k].join('|') !== b[k].join('|') : a[k] !== b[k]));
}

function current(p: Person): ImportSnapshot {
  return { fullName: p.fullName, phone: p.phone, sharedPhones: p.sharedPhones, company: p.company, boardingPlace: p.boardingPlace };
}

/** Yeni Excel verisini mevcut kayıtlarla karşılaştırır; hiçbir şeyi değiştirmez. */
export function planImport(incoming: IncomingPerson[], existing: Person[]): ImportPlan {
  const bySource = new Map(existing.filter((p) => p.sourceKey).map((p) => [p.sourceKey!, p]));
  const manual = existing.filter((p) => !p.sourceKey);
  const seen = new Set<string>();
  const items: PlanItem[] = [];
  for (const inc of incoming) {
    const key = inc.person.sourceKey;
    seen.add(key);
    const ex = bySource.get(key);
    if (!ex) {
      const name = foldTr(inc.person.fullName);
      const phones = [inc.person.phone, ...inc.person.sharedPhones].map(digitsOnly).filter(Boolean);
      const candidates = manual.filter(
        (m) => foldTr(m.fullName) === name || (m.phone && phones.includes(digitsOnly(m.phone)) && foldTr(m.fullName).split(' ')[0] === name.split(' ')[0]),
      );
      items.push(candidates.length ? { kind: 'duplicate', incoming: inc, candidates } : { kind: 'new', incoming: inc });
      continue;
    }
    const excelChanges = ex.importSnapshot ? diff(ex.importSnapshot, inc.snapshot) : diff(current(ex), inc.snapshot);
    const vsCurrent = diff(current(ex), inc.snapshot);
    if (excelChanges.length === 0 || vsCurrent.length === 0) items.push({ kind: 'unchanged', incoming: inc, existing: ex });
    else if (ex.edited) items.push({ kind: 'conflict', incoming: inc, existing: ex, changes: vsCurrent });
    else items.push({ kind: 'update', incoming: inc, existing: ex, changes: vsCurrent });
  }
  const missing = existing.filter((p) => p.source === 'excel' && p.sourceKey && !seen.has(p.sourceKey));
  return { items, missing };
}

/** Çakışma/mükerrer kararları: kayıt anahtarı → seçim. */
export type Decisions = Map<string, 'keep' | 'excel' | 'new' | `link:${string}`>;

export interface ApplyResult {
  created: number;
  updated: number;
  unchanged: number;
  conflictsKept: number;
  conflictsReplaced: number;
  linked: number;
  markedMissing: number;
  snapshotId: number;
}

const IMPORT_FLAGS: Flag[] = [
  'pairing-unverified', 'shared-phone', 'missing-phone', 'invalid-phone', 'extra-phone',
  'ambiguous-separator', 'boarding-unknown', 'transport-typo', 'transport-other', 'transport-unknown',
];

/**
 * Planı uygular. Otobüs listesi, yoklamalar ve manuel kişiler asla silinmez.
 * İşlemden önce mevcut verilerin anlık kopyası alınır.
 */
export async function applyImport(plan: ImportPlan, decisions: Decisions, fileName: string): Promise<ApplyResult> {
  const snapshotId = await guarded('Excel öncesi kopya', () => saveSnapshot(`Excel yükleme öncesi otomatik kopya (${fileName})`));
  const res: ApplyResult = { created: 0, updated: 0, unchanged: 0, conflictsKept: 0, conflictsReplaced: 0, linked: 0, markedMissing: 0, snapshotId };
  const now = Date.now();
  await guarded('Excel içe aktarma', () =>
    db.transaction('rw', db.persons, db.settings, async () => {
      const fromExcel = (inc: IncomingPerson, existing?: Person): Person => ({
        id: existing?.id ?? uid(),
        fullName: inc.snapshot.fullName,
        phone: inc.snapshot.phone,
        sharedPhones: inc.snapshot.sharedPhones,
        company: inc.snapshot.company,
        companyKey: inc.row.companyKey,
        sicilNo: inc.row.sicilNo,
        companyPhone: inc.row.companyPhone,
        boardingPlace: inc.snapshot.boardingPlace,
        note: existing?.edited ? existing.note : inc.note,
        source: 'excel',
        sourceKey: inc.person.sourceKey,
        importSnapshot: inc.snapshot,
        edited: false,
        flags: inc.person.flags,
        sourceRow: inc.row.rowNumber,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      for (const item of plan.items) {
        const key = item.incoming.person.sourceKey;
        if (item.kind === 'new') {
          await db.persons.add(fromExcel(item.incoming));
          res.created++;
        } else if (item.kind === 'update') {
          await db.persons.put(fromExcel(item.incoming, item.existing));
          res.updated++;
        } else if (item.kind === 'unchanged') {
          const keepFlags = item.existing.flags.filter((f) => f !== 'missing-from-latest-import');
          await db.persons.update(item.existing.id, {
            importSnapshot: item.incoming.snapshot,
            flags: item.existing.edited ? keepFlags : dedupe([...keepFlags.filter((f) => !IMPORT_FLAGS.includes(f)), ...item.incoming.person.flags]),
            sourceRow: item.incoming.row.rowNumber,
            companyPhone: item.incoming.row.companyPhone,
          });
          res.unchanged++;
        } else if (item.kind === 'conflict') {
          if (decisions.get(key) === 'excel') {
            await db.persons.put(fromExcel(item.incoming, { ...item.existing, edited: false }));
            res.conflictsReplaced++;
          } else {
            await db.persons.update(item.existing.id, {
              importSnapshot: item.incoming.snapshot,
              flags: item.existing.flags.filter((f) => f !== 'missing-from-latest-import'),
            });
            res.conflictsKept++;
          }
        } else {
          const d = decisions.get(key) ?? 'new';
          if (d.startsWith('link:')) {
            const target = item.candidates.find((c) => c.id === d.slice(5));
            if (target) {
              await db.persons.update(target.id, {
                sourceKey: key,
                importSnapshot: item.incoming.snapshot,
                sicilNo: item.incoming.row.sicilNo,
                companyKey: item.incoming.row.companyKey,
                companyPhone: item.incoming.row.companyPhone,
                edited: true,
                updatedAt: now,
              });
              res.linked++;
              continue;
            }
          }
          await db.persons.add(fromExcel(item.incoming));
          res.created++;
        }
      }
      for (const p of plan.missing) {
        if (!p.flags.includes('missing-from-latest-import')) {
          await db.persons.update(p.id, { flags: [...p.flags, 'missing-from-latest-import'] });
        }
        res.markedMissing++;
      }
      await db.settings.put({
        key: 'lastImport',
        value: { at: now, fileName, people: plan.items.length },
      });
    }),
  );
  return res;
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
