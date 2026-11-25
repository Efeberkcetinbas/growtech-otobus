import type { AttendanceSession, BackupData, Flag, Person, Snapshot } from '../types';
import { VERIFY_FLAGS } from '../types';
import { db } from './db';
import { guarded } from './notify';
import { normalizePhone, splitPhones } from './phone';
import { cleanSpaces, digitsOnly, foldTr, levenshtein } from './text';

export const SCHEMA_VERSION = 1;

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------- ayarlar

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export function setSetting(key: string, value: unknown) {
  return guarded('Ayar', () => db.settings.put({ key, value }));
}

// ---------------------------------------------------------------- başlangıç

export const DEFAULT_SESSIONS = ['Gidiş', 'Dönüş'];

/** İlk açılışta Gidiş ve Dönüş yoklama oturumlarını oluşturur. */
export async function ensureDefaults() {
  await db.transaction('rw', db.sessions, db.settings, async () => {
    if ((await db.sessions.count()) === 0) {
      const now = Date.now();
      const sessions = DEFAULT_SESSIONS.map((name, i) => ({ id: uid(), name, order: i, createdAt: now + i }));
      await db.sessions.bulkAdd(sessions);
      await db.settings.put({ key: 'activeSessionId', value: sessions[0].id });
    }
  });
}

// ---------------------------------------------------------------- kişiler

export interface PersonInput {
  fullName: string;
  phone: string;
  company: string;
  boardingPlace: string;
  note: string;
  /** Ek numaralar (serbest metin; "/", virgül veya satır sonu ile ayrılabilir). */
  extraPhones?: string;
}

/** Ek numara metnini string numaralara ayırır (ana numarayla aynı olanlar atılır). */
export function parseExtraPhones(raw: string | undefined, main: string): { values: string[]; valid: boolean } {
  const parts = splitPhones(raw ?? '').filter((p) => p.value !== main);
  return { values: parts.map((p) => p.value), valid: parts.every((p) => p.valid) };
}

/** Telefonu string olarak normalleştirir; tanınmayan biçimi olduğu gibi saklar. */
export function cleanPhoneInput(raw: string): { value: string; valid: boolean } {
  const p = normalizePhone(raw);
  return p ?? { value: '', valid: true };
}

function recomputeFlags(base: Flag[], p: Pick<Person, 'phone' | 'sharedPhones' | 'boardingPlace' | 'extraPhones'>, phoneValid: boolean): Flag[] {
  const set = new Set(base);
  const extras = p.extraPhones ?? [];
  set.delete('missing-phone');
  set.delete('boarding-unknown');
  set.delete('invalid-phone');
  set.delete('extra-phone');
  if (!p.phone && !extras.length && p.sharedPhones.length === 0) set.add('missing-phone');
  if (extras.length) set.add('extra-phone');
  if (!p.boardingPlace) set.add('boarding-unknown');
  if (!phoneValid) set.add('invalid-phone');
  if (!p.sharedPhones.length) set.delete('shared-phone');
  return [...set];
}

export async function createPerson(input: PersonInput, addToBus: boolean): Promise<Person> {
  const now = Date.now();
  const phone = cleanPhoneInput(input.phone);
  const fullName = cleanSpaces(input.fullName).replace(/\n/g, ' ');
  if (!fullName) throw new Error('Ad soyad zorunludur.');
  const extra = parseExtraPhones(input.extraPhones, phone.value);
  const base = {
    phone: phone.value,
    extraPhones: extra.values,
    sharedPhones: [] as string[],
    boardingPlace: cleanSpaces(input.boardingPlace),
  };
  const person: Person = {
    id: uid(),
    fullName,
    ...base,
    company: cleanSpaces(input.company),
    companyKey: 'manual',
    sicilNo: '',
    companyPhone: '',
    note: cleanSpaces(input.note),
    source: 'manual',
    edited: false,
    flags: recomputeFlags([], base, phone.valid && extra.valid),
    createdAt: now,
    updatedAt: now,
  };
  await guarded('Yeni katılımcı', () =>
    db.transaction('rw', db.persons, db.bus, async () => {
      await db.persons.add(person);
      if (addToBus) await db.bus.put({ personId: person.id, addedAt: now });
    }),
  );
  return person;
}

/**
 * Tek bir kişi kaydını günceller. Tüm ekranlar aynı kaydı okuduğundan
 * Otobüsüm ve Yoklama ekranları da anında güncellenir.
 */
export async function updatePerson(id: string, input: PersonInput & { verified?: boolean; keepSharedPhones?: boolean }) {
  await guarded('Düzenleme', () =>
    db.transaction('rw', db.persons, async () => {
      const cur = await db.persons.get(id);
      if (!cur) throw new Error('Kayıt bulunamadı.');
      const phone = cleanPhoneInput(input.phone);
      const fullName = cleanSpaces(input.fullName).replace(/\n/g, ' ');
      if (!fullName) throw new Error('Ad soyad zorunludur.');
      const extra =
        input.extraPhones === undefined ? { values: cur.extraPhones ?? [], valid: true } : parseExtraPhones(input.extraPhones, phone.value);
      const next = {
        fullName,
        phone: phone.value,
        extraPhones: extra.values,
        sharedPhones: input.keepSharedPhones === false ? [] : cur.sharedPhones,
        company: cleanSpaces(input.company),
        boardingPlace: cleanSpaces(input.boardingPlace),
        note: cleanSpaces(input.note),
      };
      let flags = cur.flags;
      if (input.verified) flags = flags.filter((f) => !VERIFY_FLAGS.includes(f) || f === 'shared-phone');
      if (next.phone && next.phone !== cur.phone) flags = flags.filter((f) => f !== 'pairing-unverified' && f !== 'extra-phone');
      const changed =
        next.fullName !== cur.fullName ||
        next.phone !== cur.phone ||
        next.company !== cur.company ||
        next.boardingPlace !== cur.boardingPlace ||
        next.note !== cur.note ||
        next.extraPhones.join('|') !== (cur.extraPhones ?? []).join('|') ||
        next.sharedPhones.length !== cur.sharedPhones.length;
      await db.persons.update(id, {
        ...next,
        flags: recomputeFlags(flags, next, phone.valid && extra.valid),
        edited: cur.edited || (cur.source === 'excel' && changed),
        updatedAt: Date.now(),
      });
    }),
  );
}

export interface SimilarMatch {
  person: Person;
  reason: 'name' | 'phone';
}

/** Benzer isim (Türkçe karakter toleranslı) veya aynı telefon numarası olan kayıtlar. */
export async function findSimilar(fullName: string, phone: string, excludeId?: string): Promise<SimilarMatch[]> {
  const name = foldTr(fullName);
  const phoneDigits = digitsOnly(cleanPhoneInput(phone).value);
  const all = await db.persons.toArray();
  const out: SimilarMatch[] = [];
  for (const p of all) {
    if (p.id === excludeId || p.deletedAt) continue;
    const other = foldTr(p.fullName);
    const nameHit = name.length >= 3 && (other === name || (name.length >= 6 && levenshtein(other, name) <= 2));
    const phones = [p.phone, ...(p.extraPhones ?? []), ...p.sharedPhones].map(digitsOnly).filter(Boolean);
    const phoneHit = phoneDigits.length >= 10 && phones.includes(phoneDigits);
    if (nameHit) out.push({ person: p, reason: 'name' });
    else if (phoneHit) out.push({ person: p, reason: 'phone' });
  }
  return out;
}

// ---------------------------------------------------------------- silme

export interface DeleteResult {
  /** Kişi otobüsteyse eklenme zamanı (geri alırken aynı sıraya döner), değilse null. */
  busAddedAt: number | null;
}

/**
 * Katılımcıyı siler: ana listeden ve otobüs listesinden kaldırır.
 * Kayıt silinme işaretiyle saklanır; geçmiş yoklama kayıtları korunur,
 * aynı firmadaki diğer kişiler etkilenmez, yeni Excel yüklemesinde geri eklenmez.
 */
export async function deletePerson(id: string): Promise<DeleteResult> {
  return guarded('Silme', () =>
    db.transaction('rw', db.persons, db.bus, async () => {
      const person = await db.persons.get(id);
      if (!person || person.deletedAt) throw new Error('Kişi bulunamadı.');
      const bus = await db.bus.get(id);
      await db.bus.delete(id);
      await db.persons.update(id, { deletedAt: Date.now(), removedBy: 'user' });
      return { busAddedAt: bus?.addedAt ?? null };
    }),
  );
}

/** Silinen kişiyi geri getirir; busAddedAt verilirse otobüsteki eski sırasına da döner. */
export async function restorePerson(id: string, busAddedAt: number | null = null) {
  return guarded('Geri alma', () =>
    db.transaction('rw', db.persons, db.bus, async () => {
      const n = await db.persons
        .where(':id')
        .equals(id)
        .modify((p) => {
          delete p.deletedAt;
          delete p.removedBy;
          delete p.removedReason;
          p.updatedAt = Date.now();
        });
      if (!n) throw new Error('Kişi bulunamadı.');
      if (busAddedAt !== null && !(await db.bus.get(id))) await db.bus.add({ personId: id, addedAt: busAddedAt });
    }),
  );
}

// ---------------------------------------------------------------- otobüs

/** Kişiyi otobüse ekler. Zaten ekliyse false döner; aynı kişi iki kez eklenemez. */
export async function addToBus(personId: string): Promise<boolean> {
  return guarded('Otobüse ekleme', () =>
    db.transaction('rw', db.bus, db.persons, async () => {
      const person = await db.persons.get(personId);
      if (!person || person.deletedAt) throw new Error('Kişi bulunamadı.');
      if (await db.bus.get(personId)) return false;
      await db.bus.add({ personId, addedAt: Date.now() });
      return true;
    }),
  );
}

/** Kişiyi otobüsten çıkarır. Kişi havuzdan ve yoklama geçmişinden silinmez. */
export function removeFromBus(personId: string) {
  return guarded('Listeden çıkarma', () => db.bus.delete(personId));
}

/** Otobüs listesini boşaltır. Katılımcılar ve yoklama kayıtları korunur. */
export function clearBus() {
  return guarded('Liste temizleme', () => db.bus.clear());
}

// ---------------------------------------------------------------- yoklama

export async function toggleCheck(sessionId: string, personId: string): Promise<boolean> {
  return guarded('Yoklama', () =>
    db.transaction('rw', db.checks, async () => {
      const key: [string, string] = [sessionId, personId];
      if (await db.checks.get(key)) {
        await db.checks.delete(key);
        return false;
      }
      await db.checks.put({ sessionId, personId, checkedAt: Date.now() });
      return true;
    }),
  );
}

/** Yalnızca verilen oturumun tiklerini temizler. */
export function clearChecks(sessionId: string) {
  return guarded('Yoklama sıfırlama', () => db.checks.where('sessionId').equals(sessionId).delete());
}

export async function createSession(name: string): Promise<AttendanceSession> {
  const clean = cleanSpaces(name);
  if (!clean) throw new Error('Oturum adı gerekli.');
  return guarded('Yoklama oturumu', () =>
    db.transaction('rw', db.sessions, db.settings, async () => {
      const last = await db.sessions.orderBy('order').last();
      const s: AttendanceSession = { id: uid(), name: clean, order: (last?.order ?? -1) + 1, createdAt: Date.now() };
      await db.sessions.add(s);
      await db.settings.put({ key: 'activeSessionId', value: s.id });
      return s;
    }),
  );
}

/** Bir oturumu ve yalnızca o oturuma ait tikleri siler. En az bir oturum kalır. */
export async function deleteSession(id: string) {
  return guarded('Oturum silme', () =>
    db.transaction('rw', db.sessions, db.checks, db.settings, async () => {
      if ((await db.sessions.count()) <= 1) throw new Error('En az bir yoklama oturumu kalmalı.');
      await db.checks.where('sessionId').equals(id).delete();
      await db.sessions.delete(id);
      const active = await db.settings.get('activeSessionId');
      if (active?.value === id) {
        const first = await db.sessions.orderBy('order').first();
        await db.settings.put({ key: 'activeSessionId', value: first?.id });
      }
    }),
  );
}

// ---------------------------------------------------------------- yedekleme

export async function exportBackup(): Promise<BackupData> {
  return db.transaction('r', [db.persons, db.bus, db.sessions, db.checks, db.settings], async () => ({
    app: 'growtech-otobus' as const,
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    persons: await db.persons.toArray(),
    bus: await db.bus.toArray(),
    sessions: await db.sessions.toArray(),
    checks: await db.checks.toArray(),
    settings: await db.settings.toArray(),
  }));
}

export class BackupFormatError extends Error {}

/** Yedek dosyasını doğrular. Hatalı/başka uygulamaya ait dosyayı reddeder. */
export function validateBackup(data: unknown): BackupData {
  const d = data as Partial<BackupData> | null;
  if (!d || typeof d !== 'object' || d.app !== 'growtech-otobus') {
    throw new BackupFormatError('Bu dosya bir Growtech Otobüs yedeği değil.');
  }
  if (typeof d.schema !== 'number' || d.schema > SCHEMA_VERSION) {
    throw new BackupFormatError('Yedek daha yeni bir uygulama sürümüne ait.');
  }
  for (const k of ['persons', 'bus', 'sessions', 'checks', 'settings'] as const) {
    if (!Array.isArray(d[k])) throw new BackupFormatError(`Yedekte "${k}" bölümü eksik.`);
  }
  const ids = new Set(d.persons!.map((p) => p.id));
  for (const p of d.persons!) {
    if (!p || typeof p.id !== 'string' || typeof p.fullName !== 'string') {
      throw new BackupFormatError('Yedekte hatalı kişi kaydı var.');
    }
    p.phone = typeof p.phone === 'string' ? p.phone : String(p.phone ?? '');
    p.sharedPhones = Array.isArray(p.sharedPhones) ? p.sharedPhones.map(String) : [];
    p.flags = Array.isArray(p.flags) ? p.flags : [];
  }
  d.bus = d.bus!.filter((b) => ids.has(b.personId));
  return d as BackupData;
}

const MAX_SNAPSHOTS = 5;

/** Mevcut verilerin tam kopyasını cihaz içinde saklar (geri yükleme / Excel öncesi). */
export async function saveSnapshot(reason: string): Promise<number> {
  const data = await exportBackup();
  const id = await db.snapshots.add({ createdAt: Date.now(), reason, data } as Snapshot);
  const all = await db.snapshots.orderBy('createdAt').primaryKeys();
  if (all.length > MAX_SNAPSHOTS) await db.snapshots.bulkDelete(all.slice(0, all.length - MAX_SNAPSHOTS));
  return id;
}

/**
 * Yedeği geri yükler. Önce mevcut veriler otomatik bir anlık kopyaya alınır,
 * böylece yanlış dosya yüklenirse geri dönülebilir.
 */
export async function restoreBackup(data: BackupData): Promise<number> {
  const snapshotId = await guarded('Geri yükleme öncesi kopya', () => saveSnapshot('Geri yükleme öncesi otomatik kopya'));
  await guarded('Geri yükleme', () =>
    db.transaction('rw', [db.persons, db.bus, db.sessions, db.checks, db.settings], async () => {
      await Promise.all([db.persons.clear(), db.bus.clear(), db.sessions.clear(), db.checks.clear(), db.settings.clear()]);
      await db.persons.bulkPut(data.persons);
      await db.bus.bulkPut(data.bus);
      await db.sessions.bulkPut(data.sessions);
      await db.checks.bulkPut(data.checks);
      await db.settings.bulkPut(data.settings);
    }),
  );
  await ensureDefaults();
  return snapshotId;
}
