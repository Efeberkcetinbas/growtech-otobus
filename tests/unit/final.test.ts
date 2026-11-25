import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/lib/db';
import { computeStats, defaultSelection, parseRows, type ParseResult } from '../../src/lib/excel/parse';
import { isYellowFill, readExcel } from '../../src/lib/excel/read';
import { applyImport, applyVerification, defaultRemovals, planImport, toIncoming, type RowVerification } from '../../src/lib/import/merge';
import { addToBus, deletePerson, ensureDefaults, toggleCheck } from '../../src/lib/repo';
import { filterPersons } from '../../src/lib/search';
import { FAKE_TC, FINAL_EXPECTED, buildFinalXlsx, finalRows, finalYellowIndexes } from '../fixtures/final';

const parseFinal = (rows = finalRows(), yellow = finalYellowIndexes()) => parseRows(rows, 'reportUyeListesi', { yellowRows: yellow, stylesRead: true });
const row = (res: ParseResult, sicil: string) => res.rows.find((r) => r.sicilNo === sicil)!;

describe('sarı dolgu algılama', () => {
  it('FFFF00 / FFFFFF00 / indeks 13 sarıdır; diğerleri değildir', () => {
    expect(isYellowFill({ patternType: 'solid', fgColor: { rgb: 'FFFF00' } })).toBe(true);
    expect(isYellowFill({ patternType: 'solid', fgColor: { rgb: 'ffffff00' } })).toBe(true);
    expect(isYellowFill({ patternType: 'solid', fgColor: { indexed: 13 } })).toBe(true);
    expect(isYellowFill({ patternType: 'none', fgColor: { rgb: 'FFFF00' } })).toBe(false);
    expect(isYellowFill({ patternType: 'solid', fgColor: { rgb: 'FFC000' } })).toBe(false);
    expect(isYellowFill(undefined)).toBe(false);
  });
});

describe('güncel Excel biçimi (yapay veri)', () => {
  it('kontrol değerleri: sarılar, OTOBÜS satırları, uygun satırlar, gerçek kişi sayısı', () => {
    const res = parseFinal();
    const s = computeStats(res, defaultSelection(res));
    expect(s.totalRows).toBe(FINAL_EXPECTED.totalRows);
    expect(s.yellowRows).toBe(FINAL_EXPECTED.yellowRows);
    expect(s.busRowsAll).toBe(FINAL_EXPECTED.busRowsAll);
    expect(s.busRowsYellow).toBe(FINAL_EXPECTED.busRowsYellow);
    expect(s.busRows).toBe(FINAL_EXPECTED.busRows);
    expect(s.parsedPeople).toBe(FINAL_EXPECTED.people);
    expect(s.multiPersonRows).toBe(FINAL_EXPECTED.multiPersonRows);
    expect(s.verificationRows).toBe(FINAL_EXPECTED.verificationRows);
    expect(s.missingPhone).toBe(FINAL_EXPECTED.missingPhone);
  });

  it('sarı OTOBÜS satırı alınmaz; KENDİ, SPRİNTER, ŞOFÖR, katılmayacak ve belirsiz alınmaz', () => {
    const res = parseFinal();
    expect(row(res, '8004')).toMatchObject({ yellow: true, category: 'excluded', excludeReason: 'Sarı işaretli satır', transport: 'bus' });
    expect(row(res, '8005').category).toBe('excluded');
    expect(row(res, '8006').category).toBe('excluded');
    expect(row(res, '8007').category).toBe('excluded');
    expect(row(res, '8012').excludeReason).toBe('Katılmayacak');
    expect(row(res, '8013').excludeReason).toMatch(/belirsiz/);
    const sel = defaultSelection(res);
    for (const r of res.rows) {
      if (sel.has(r.rowNumber)) expect(r.attendance === 'attending' && r.transport === 'bus' && !r.yellow).toBe(true);
    }
  });

  it('çoklu katılımcıları ayrı kişilere böler; boş slash parçasından kişi üretmez', () => {
    const res = parseFinal();
    expect(row(res, '8001').people.map((p) => p.fullName)).toEqual(['AHMET YAPAY', 'MEHMET DENEMEOĞLU']);
    const three = row(res, '8008').people;
    expect(three.map((p) => p.fullName)).toEqual(['BİR ÜÇLÜ', 'İKİ ÜÇLÜ', 'ÜÇ ÜÇLÜ']);
    expect(three.map((p) => p.phone)).toEqual(['05000001005', '05000001006', '05000001007']);
    expect(three.every((p) => p.flags.includes('pairing-unverified'))).toBe(true);
    expect(row(res, '8015').people.map((p) => p.fullName)).toEqual(['SATIR BİRİNCİ', 'SATIR İKİNCİ']);
    // Her kişinin ayrı kaynak anahtarı; firma ve sicil ortak
    const keys = res.rows.flatMap((r) => (r.category === 'excluded' ? [] : r.people.map((p) => p.sourceKey)));
    expect(new Set(keys).size).toBe(keys.length);
    expect(row(res, '8001').people.every((p) => p.sourceKey.startsWith('s:8001|'))).toBe(true);
  });

  it('telefon durumları: 2 kişi/1 numara ortak, 1 kişi/2 numara ek numara, eksik numara boş', () => {
    const res = parseFinal();
    const shared = row(res, '8003').people;
    expect(shared.map((p) => p.phone)).toEqual(['', '']);
    expect(shared.every((p) => p.sharedPhones[0] === '05000001004' && p.flags.includes('shared-phone'))).toBe(true);
    const multi = row(res, '8009').people[0];
    expect(multi.phone).toBe('05000001008');
    expect(multi.extraPhones).toEqual(['05000001009']);
    expect(multi.sharedPhones).toEqual([]);
    const none = row(res, '8010').people[0];
    expect(none.phone).toBe('');
    expect(none.flags).toContain('missing-phone');
    // Başındaki sıfır korunur (hücrede sayı olarak 5000001003 yazıyor)
    expect(row(res, '8002').people[0].phone).toBe('05000001003');
  });

  it('ad ve soyadı bölünmüş olabilecek kayıt doğrulamaya düşer ve birleştirilebilir', () => {
    const res = parseFinal();
    const r = row(res, '8011');
    expect(r.people.every((p) => p.flags.includes('ambiguous-separator'))).toBe(true);
    expect(r.needsVerification).toBe(true);
    const merged = applyVerification(r, { verified: true, assignments: [], merged: true });
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ fullName: 'ADEM KAYA', phone: '05000001010', sharedPhones: [] });
    expect(merged[0].sourceKey).toBe('s:8011|adem kaya');
  });

  it('gerçek .xlsx dosyasından hücre renklerini okur (başlık rengi ve tek hücre sarısı dahil)', async () => {
    const res = await readExcel(await buildFinalXlsx());
    expect(res.stylesRead).toBe(true);
    expect(res.header.headerIndex).toBe(1); // sarı başlık veri sayılmaz
    const s = computeStats(res, defaultSelection(res));
    expect(s.yellowRows).toBe(FINAL_EXPECTED.yellowRows);
    expect(s.busRows).toBe(FINAL_EXPECTED.busRows);
    expect(s.parsedPeople).toBe(FINAL_EXPECTED.people);
    expect(row(res, '8007').yellow).toBe(true); // yalnızca biniş hücresi sarı
  });

  it('TC NO sütunu hiçbir şekilde okunmaz', async () => {
    const res = await readExcel(await buildFinalXlsx());
    expect(Object.keys(res.header.columns)).not.toContain('tc');
    const json = JSON.stringify(res);
    for (const tc of FAKE_TC) expect(json).not.toContain(tc);
  });
});

describe('veritabanına aktarma (yapay veri)', () => {
  beforeEach(async () => {
    await Promise.all([db.persons.clear(), db.bus.clear(), db.sessions.clear(), db.checks.clear(), db.settings.clear(), db.snapshots.clear()]);
    await ensureDefaults();
  });

  async function importFinal(rows = finalRows(), yellow = finalYellowIndexes(), verifications = new Map<number, RowVerification>(), removals?: 'default') {
    const res = parseFinal(rows, yellow);
    const sel = defaultSelection(res);
    const bus = await db.bus.toArray();
    const plan = planImport(toIncoming(res, sel, verifications), await db.persons.toArray(), { result: res, selected: sel, busIds: new Set(bus.map((b) => b.personId)) });
    return { plan, result: await applyImport(plan, new Map(), 'final.xlsx', removals === 'default' ? defaultRemovals(plan) : new Set()) };
  }
  const active = async () => (await db.persons.toArray()).filter((p) => !p.deletedAt);
  const person = async (name: string) => (await db.persons.toArray()).find((p) => p.fullName === name)!;

  it('aynı firmadan kişiler bağımsızdır: ayrı ID, ayrı otobüs, ayrı yoklama, ayrı silme', async () => {
    await importFinal();
    expect(await active()).toHaveLength(FINAL_EXPECTED.people);
    const a = await person('AHMET YAPAY');
    const b = await person('MEHMET DENEMEOĞLU');
    expect(a.id).not.toBe(b.id);
    expect(a.companyKey).toBe(b.companyKey);
    await addToBus(a.id);
    expect(await db.bus.get(b.id)).toBeUndefined();
    await addToBus(b.id);
    expect(await db.bus.count()).toBe(2); // toplam yolcuya iki kişi olarak yansır
    const [gidis] = await db.sessions.orderBy('order').toArray();
    await toggleCheck(gidis.id, a.id);
    expect(await db.checks.get([gidis.id, b.id])).toBeUndefined();
    await deletePerson(a.id);
    expect((await db.persons.get(b.id))!.deletedAt).toBeUndefined();
    expect(await db.bus.get(b.id)).toBeTruthy();
  });

  it('kişiler ayrı ayrı aranabilir (Türkçe karakter toleranslı)', async () => {
    await importFinal();
    const list = await active();
    expect(filterPersons(list, 'ahmet yapay').map((p) => p.fullName)).toEqual(['AHMET YAPAY']);
    expect(filterPersons(list, 'mehmet denemeoglu').map((p) => p.fullName)).toEqual(['MEHMET DENEMEOĞLU']);
    expect(filterPersons(list, '0500 000 10 09').map((p) => p.fullName)).toEqual(['TEK KİŞİ İKİNUMARA']); // ek numara ile
  });

  it('aynı dosya yeniden yüklenince mükerrer oluşmaz', async () => {
    await importFinal();
    const { result } = await importFinal();
    expect(result.created).toBe(0);
    expect(await active()).toHaveLength(FINAL_EXPECTED.people);
  });

  it('artık sarı/otobüs dışı olan kişi önizlemede nedeniyle gösterilir; otobüstekiler açık onay ister', async () => {
    await importFinal();
    const cagri = await person('ÇAĞRI ÖĞÜTÇÜ');
    const irem = await person('İREM IŞIKLI');
    await addToBus(cagri.id);
    const [gidis] = await db.sessions.orderBy('order').toArray();
    await toggleCheck(gidis.id, cagri.id);
    // Yeni dosyada ÇAĞRI'nın satırı sarı, İREM/ŞULE satırı KENDİ oldu
    const rows = finalRows();
    rows[4][10] = 'KENDİ'; // 8003 satırı (indeks: 0 başlık üstü, 1 başlık, 2 → 8001)
    const yellow = new Set([...finalYellowIndexes(), 3]);
    const res = parseFinal(rows, yellow);
    const sel = defaultSelection(res);
    const plan = planImport(toIncoming(res, sel, new Map()), await db.persons.toArray(), { result: res, selected: sel, busIds: new Set([cagri.id]) });
    const m = new Map(plan.missing.map((x) => [x.person.fullName, x]));
    expect(m.get('ÇAĞRI ÖĞÜTÇÜ')).toMatchObject({ reason: 'Sarı işaretli satır', onBus: true });
    expect(m.get('İREM IŞIKLI')!.reason).toMatch(/KENDİ/);
    const removals = defaultRemovals(plan);
    expect(removals.has(cagri.id)).toBe(false); // otobüsteki kişi varsayılan olarak çıkarılmaz
    expect(removals.has(irem.id)).toBe(true);

    // Kullanıcı otobüstekini de çıkarmayı onaylıyor
    removals.add(cagri.id);
    const r = await applyImport(plan, new Map(), 'yeni.xlsx', removals);
    expect(r.removed).toBe(3);
    expect(await db.bus.get(cagri.id)).toBeUndefined();
    const c = (await db.persons.get(cagri.id))!;
    expect(c).toMatchObject({ removedBy: 'import', removedReason: 'Sarı işaretli satır' });
    expect(await db.checks.get([gidis.id, cagri.id])).toBeTruthy(); // geçmiş yoklama korunur

    // Sonraki Excel'de yine otobüsle geliyorsa geri alınır (kullanıcı silmesi değil)
    const back = await importFinal();
    expect(back.result.reactivated).toBe(3);
    expect(await active()).toHaveLength(FINAL_EXPECTED.people);
  });
});
