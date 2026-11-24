import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/lib/db';
import { computeStats, defaultSelection, parseRows } from '../../src/lib/excel/parse';
import { applyImport, defaultAssignments, NONE, planImport, SHARED, toIncoming, type Decisions, type RowVerification } from '../../src/lib/import/merge';
import {
  addToBus,
  clearBus,
  clearChecks,
  createPerson,
  createSession,
  deleteSession,
  ensureDefaults,
  exportBackup,
  findSimilar,
  removeFromBus,
  restoreBackup,
  toggleCheck,
  updatePerson,
  validateBackup,
} from '../../src/lib/repo';
import { syntheticRows } from '../fixtures/synthetic';

async function reset() {
  await Promise.all([db.persons.clear(), db.bus.clear(), db.sessions.clear(), db.checks.clear(), db.settings.clear(), db.snapshots.clear()]);
  await ensureDefaults();
}

async function importSynthetic(rows = syntheticRows(), verifications = new Map<number, RowVerification>(), extraSelect: number[] = []) {
  const res = parseRows(rows);
  const sel = defaultSelection(res);
  extraSelect.forEach((n) => sel.add(n));
  const plan = planImport(toIncoming(res, sel, verifications), await db.persons.toArray());
  return { res, plan, result: await applyImport(plan, new Map(), 'test.xlsx') };
}

const input = (fullName: string, phone = '') => ({ fullName, phone, company: 'DENEME A.Ş.', boardingPlace: 'MERKEZ', note: '' });

beforeEach(reset);

describe('varsayılanlar', () => {
  it('Gidiş ve Dönüş oturumlarını bir kez oluşturur', async () => {
    await ensureDefaults();
    expect((await db.sessions.orderBy('order').toArray()).map((s) => s.name)).toEqual(['Gidiş', 'Dönüş']);
  });
});

describe('kişi ekleme ve düzenleme', () => {
  it('yeni kişiyi kalıcı kaydeder ve doğrudan otobüse ekler', async () => {
    const p = await createPerson(input('ZEYNEP YENİ', '5000000099'), true);
    expect((await db.persons.get(p.id))!.phone).toBe('05000000099');
    expect(await db.bus.get(p.id)).toBeTruthy();
  });
  it('ad soyad zorunlu', async () => {
    await expect(createPerson(input('   '), false)).rejects.toThrow(/zorunlu/);
  });
  it('benzer isim / aynı telefon için uyarı üretir ama kaydı engellemez', async () => {
    await createPerson(input('ÇAĞRI DENEME', '05000000050'), false);
    expect((await findSimilar('cagri deneme', ''))[0].reason).toBe('name');
    expect((await findSimilar('BAŞKA BİRİ', '0500 000 00 50'))[0].reason).toBe('phone');
    await createPerson(input('BAŞKA BİRİ', '05000000050'), false); // ortak telefon serbest
    expect(await db.persons.count()).toBe(2);
  });
  it('düzenleme tek kayıt üzerinde yapılır; otobüs ve yoklama aynı kaydı görür', async () => {
    const p = await createPerson(input('ESKİ AD'), true);
    const [s] = await db.sessions.toArray();
    await toggleCheck(s.id, p.id);
    await updatePerson(p.id, { ...input('YENİ AD', '05000000077') });
    expect(await db.persons.count()).toBe(1);
    expect((await db.persons.get(p.id))!.fullName).toBe('YENİ AD');
    expect(await db.bus.get(p.id)).toBeTruthy();
    expect(await db.checks.get([s.id, p.id])).toBeTruthy();
  });
});

describe('otobüs listesi', () => {
  it('aynı kişi iki kez eklenemez', async () => {
    const p = await createPerson(input('TEK KİŞİ'), false);
    expect(await addToBus(p.id)).toBe(true);
    expect(await addToBus(p.id)).toBe(false);
    expect(await db.bus.count()).toBe(1);
  });
  it('çıkarma ve temizleme kişiyi ve yoklama geçmişini silmez', async () => {
    const a = await createPerson(input('A KİŞİ'), true);
    const b = await createPerson(input('B KİŞİ'), true);
    const [s] = await db.sessions.toArray();
    await toggleCheck(s.id, a.id);
    await removeFromBus(a.id);
    expect(await db.persons.get(a.id)).toBeTruthy();
    expect(await db.checks.count()).toBe(1);
    await clearBus();
    expect(await db.bus.count()).toBe(0);
    expect(await db.persons.count()).toBe(2);
    expect(await db.checks.count()).toBe(1);
    expect(b.id).toBeTruthy();
  });
});

describe('yoklama', () => {
  it('işaretleme / kaldırma ve oturumlar birbirinden bağımsız', async () => {
    const p = await createPerson(input('YOLCU'), true);
    const [gidis, donus] = await db.sessions.orderBy('order').toArray();
    expect(await toggleCheck(gidis.id, p.id)).toBe(true);
    expect(await db.checks.where('sessionId').equals(donus.id).count()).toBe(0);
    await toggleCheck(donus.id, p.id);
    await clearChecks(gidis.id); // yalnızca aktif oturum
    expect(await db.checks.get([gidis.id, p.id])).toBeUndefined();
    expect(await db.checks.get([donus.id, p.id])).toBeTruthy();
    expect(await db.bus.count()).toBe(1);
    expect(await toggleCheck(donus.id, p.id)).toBe(false);
  });
  it('yeni oturum oluşturur ve aktif yapar; silme yalnızca o oturumu etkiler', async () => {
    const p = await createPerson(input('YOLCU'), true);
    const mola = await createSession('Mola sonrası');
    expect((await db.settings.get('activeSessionId'))!.value).toBe(mola.id);
    const [gidis] = await db.sessions.orderBy('order').toArray();
    await toggleCheck(gidis.id, p.id);
    await toggleCheck(mola.id, p.id);
    await deleteSession(mola.id);
    expect(await db.sessions.count()).toBe(2);
    expect(await db.checks.count()).toBe(1);
  });
});

describe('Excel içe aktarma', () => {
  it('ilk yükleme: kişileri oluşturur, aynı firmadan kişilere ayrı ID verir', async () => {
    const { result } = await importSynthetic();
    expect(result.created).toBe(13);
    const persons = await db.persons.toArray();
    expect(new Set(persons.map((p) => p.id)).size).toBe(13);
    const firm = persons.filter((p) => p.companyKey === 's:9003');
    expect(firm).toHaveLength(2);
    expect(firm[0].id).not.toBe(firm[1].id);
    expect(persons.every((p) => typeof p.phone === 'string')).toBe(true);
  });

  it('yeniden yükleme mükerrer oluşturmaz; otobüs, yoklama ve manuel düzenleme korunur', async () => {
    await importSynthetic();
    const persons = await db.persons.toArray();
    const cagri = persons.find((p) => p.fullName === 'ÇAĞRI ÖRNEKOĞLU')!;
    const ayse = persons.find((p) => p.fullName === 'AYŞE TESTOĞLU')!;
    await addToBus(cagri.id);
    const [s] = await db.sessions.toArray();
    await toggleCheck(s.id, cagri.id);
    await updatePerson(ayse.id, { fullName: 'AYŞE TESTOĞLU', phone: '05000000222', company: ayse.company, boardingPlace: ayse.boardingPlace, note: 'elle düzeltildi' });
    const manual = await createPerson(input('ELLE EKLENEN'), true);

    const { result } = await importSynthetic();
    expect(result.created).toBe(0);
    expect(await db.persons.count()).toBe(14);
    expect(await db.bus.get(cagri.id)).toBeTruthy();
    expect(await db.bus.get(manual.id)).toBeTruthy();
    expect(await db.checks.get([s.id, cagri.id])).toBeTruthy();
    expect((await db.persons.get(ayse.id))!.phone).toBe('05000000222');
    expect((await db.persons.get(ayse.id))!.note).toBe('elle düzeltildi');
  });

  it('Excel değişti + kişi elle düzenlendiyse çakışma olarak sunar', async () => {
    await importSynthetic();
    const ayse = (await db.persons.toArray()).find((p) => p.fullName === 'AYŞE TESTOĞLU')!;
    await updatePerson(ayse.id, { fullName: 'AYŞE TESTOĞLU', phone: '05000000222', company: ayse.company, boardingPlace: ayse.boardingPlace, note: '' });
    const rows = syntheticRows();
    rows[3][15] = 'YENİ DURAK'; // 9002 satırının biniş yeri Excel'de değişti
    const res = parseRows(rows);
    const plan = planImport(toIncoming(res, defaultSelection(res), new Map()), await db.persons.toArray());
    const conflict = plan.items.find((i) => i.kind === 'conflict')!;
    expect(conflict).toBeTruthy();
    // Kullanıcı Excel'i seçerse güncellenir
    const r = await applyImport(plan, new Map([[conflict.incoming.person.sourceKey, 'excel' as const]]), 'x.xlsx');
    expect(r.conflictsReplaced).toBe(1);
    expect((await db.persons.get(ayse.id))!.boardingPlace).toBe('YENİ DURAK');
  });

  it('düzenlenmemiş kişide Excel değişikliğini günceller; Excel’den çıkan kişiyi silmez, işaretler', async () => {
    await importSynthetic();
    const rows = syntheticRows();
    rows[2][15] = 'DEĞİŞTİ';
    rows.splice(3, 1); // 9002 satırı kaldırıldı
    const { result } = await importSynthetic(rows);
    expect(result.updated).toBe(1);
    expect(result.markedMissing).toBe(1);
    const ayse = (await db.persons.toArray()).find((p) => p.fullName === 'AYŞE TESTOĞLU')!;
    expect(ayse.flags).toContain('missing-from-latest-import');
  });

  it('elle eklenen benzer kişi için mükerrer uyarısı ve bağlama seçeneği sunar', async () => {
    const manual = await createPerson(input('ÇAĞRI ÖRNEKOĞLU', '05000000001'), true);
    const res = parseRows(syntheticRows());
    const plan = planImport(toIncoming(res, defaultSelection(res), new Map()), await db.persons.toArray());
    const dup = plan.items.find((i) => i.kind === 'duplicate')!;
    expect(dup).toBeTruthy();
    const decisions: Decisions = new Map();
    decisions.set(dup.incoming.person.sourceKey, `link:${manual.id}`);
    await applyImport(plan, decisions, 'x.xlsx');
    expect((await db.persons.toArray()).filter((p) => p.fullName === 'ÇAĞRI ÖRNEKOĞLU')).toHaveLength(1);
    expect(await db.bus.get(manual.id)).toBeTruthy();
  });

  it('önizlemedeki eşleştirme doğrulaması kaydedilir', async () => {
    const res = parseRows(syntheticRows());
    const row = res.rows.find((r) => r.sicilNo === '9003')!;
    const v = new Map([[row.rowNumber, { verified: true, assignments: [row.people[1].phone, row.people[0].phone] }]]);
    await importSynthetic(syntheticRows(), v);
    const ismail = (await db.persons.toArray()).find((p) => p.fullName === 'İSMAİL DENEME')!;
    expect(ismail.phone).toBe('05000000004');
    expect(ismail.flags).not.toContain('pairing-unverified');
  });

  it('ortak numarayı kişiye atamadan bırakabilir', async () => {
    const res = parseRows(syntheticRows());
    const row = res.rows.find((r) => r.sicilNo === '9004')!;
    expect(defaultAssignments(row)).toEqual([SHARED, SHARED]);
    const v = new Map([[row.rowNumber, { verified: true, assignments: ['05000000005', NONE] }]]);
    await importSynthetic(syntheticRows(), v);
    const persons = await db.persons.toArray();
    expect(persons.find((p) => p.fullName === 'GÜLŞEN YAPAY')!.phone).toBe('05000000005');
    expect(persons.find((p) => p.fullName === 'ÖMER KURGU')!.flags).toContain('missing-phone');
  });

  it('istatistikler kullanıcı seçimine göre değişir', () => {
    const res = parseRows(syntheticRows());
    const sel = defaultSelection(res);
    const before = computeStats(res, sel).parsedPeople;
    sel.add(res.rows.find((r) => r.category === 'other-transport')!.rowNumber);
    expect(computeStats(res, sel).parsedPeople).toBe(before + 1);
  });
});

describe('JSON yedekleme', () => {
  it('yedek alır ve geri yüklemeden önce mevcut veriyi anlık kopyaya alır', async () => {
    const a = await createPerson(input('YEDEK KİŞİ', '05000000031'), true);
    const backup = JSON.parse(JSON.stringify(await exportBackup()));
    await createPerson(input('SONRADAN EKLENEN'), false);
    await removeFromBus(a.id);
    const snapId = await restoreBackup(validateBackup(backup));
    expect(await db.persons.count()).toBe(1);
    expect(await db.bus.get(a.id)).toBeTruthy();
    const snap = await db.snapshots.get(snapId);
    expect(snap!.data.persons).toHaveLength(2);
    // anlık kopyadan geri dönülebilir
    await restoreBackup(validateBackup(snap!.data));
    expect(await db.persons.count()).toBe(2);
  });
  it('yabancı dosyayı reddeder', () => {
    expect(() => validateBackup({ foo: 1 })).toThrow(/yedeği değil/);
  });
});
