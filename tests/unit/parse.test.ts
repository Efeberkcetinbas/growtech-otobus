import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  classifyAttendance,
  classifyTransport,
  cleanBoarding,
  computeStats,
  defaultSelection,
  detectHeader,
  pairPeople,
  parseRows,
  splitNames,
} from '../../src/lib/excel/parse';
import { readExcel } from '../../src/lib/excel/read';
import { formatPhone, normalizePhone, splitPhones, telHref } from '../../src/lib/phone';
import { foldTr } from '../../src/lib/text';
import { SYNTHETIC_EXPECTED, syntheticRows } from '../fixtures/synthetic';

describe('Türkçe metin', () => {
  it('Türkçe karakterleri sadeleştirir', () => {
    expect(foldTr('ÇAĞRI ÖZTÜRK')).toBe('cagri ozturk');
    expect(foldTr('  İsmail   Işık ')).toBe('ismail isik');
    expect(foldTr('ŞÜKRÜ GÜLŞEN')).toBe('sukru gulsen');
  });
});

describe('katılım ve ulaşım sınıflandırma', () => {
  it('katılım yazım farklılıklarını tanır', () => {
    expect(classifyAttendance('KATILACAK')).toBe('attending');
    expect(classifyAttendance('KATILACAK ')).toBe('attending');
    expect(classifyAttendance('KATILACAK / MECLİS ÜYESİ')).toBe('attending');
    expect(classifyAttendance('katılacak')).toBe('attending');
    expect(classifyAttendance('KATILMAYACAK')).toBe('not-attending');
    expect(classifyAttendance('KATILMAYACAK ')).toBe('not-attending');
    expect(classifyAttendance('ULAŞILAMADI')).toBe('unreachable');
    expect(classifyAttendance('ULAŞILAMADI / AÇMIYOR')).toBe('unreachable');
    expect(classifyAttendance('')).toBe('unknown');
  });
  it('ulaşım türlerini ayırır, yazım hatasını otomatik kabul etmez', () => {
    expect(classifyTransport('OTOBÜS')).toBe('bus');
    expect(classifyTransport('OTOBÜS  ')).toBe('bus');
    expect(classifyTransport('otobüs')).toBe('bus');
    expect(classifyTransport('OTOBÜD')).toBe('bus-typo');
    expect(classifyTransport('OTOBS')).toBe('bus-typo');
    expect(classifyTransport('SPRİNTER')).toBe('other');
    expect(classifyTransport('KENDİ ARACI')).toBe('own-car');
    expect(classifyTransport('KENDİ')).toBe('own-car');
    expect(classifyTransport('KENDİ ARACI İLE ')).toBe('own-car');
    expect(classifyTransport('BELLİ DEĞİL ')).toBe('unknown');
    expect(classifyTransport('DÖNECEK')).toBe('unknown');
    expect(classifyTransport('')).toBe('unknown');
  });
  it('belirsiz biniş yerlerini boş kabul eder', () => {
    expect(cleanBoarding('??')).toEqual({ value: '', unknown: true });
    expect(cleanBoarding('-')).toEqual({ value: '', unknown: true });
    expect(cleanBoarding('  KÖŞK ')).toEqual({ value: 'KÖŞK', unknown: false });
  });
});

describe('telefon', () => {
  it('string olarak normalleştirir', () => {
    expect(normalizePhone('5000000001')).toEqual({ value: '05000000001', valid: true });
    expect(normalizePhone('0500 000 00 01')).toEqual({ value: '05000000001', valid: true });
    expect(normalizePhone('+90 500 000 00 01')).toEqual({ value: '05000000001', valid: true });
    expect(normalizePhone('123')).toEqual({ value: '123', valid: false });
    expect(normalizePhone('')).toBeNull();
  });
  it('ayırıcıları güvenle böler', () => {
    expect(splitPhones('05000000001 / 05000000002').map((p) => p.value)).toEqual(['05000000001', '05000000002']);
    expect(splitPhones('0500 000 00 01 ////  0500 000 00 02').map((p) => p.value)).toEqual(['05000000001', '05000000002']);
    expect(splitPhones('05000000001\n05000000002').map((p) => p.value)).toEqual(['05000000001', '05000000002']);
    expect(splitPhones('05000000001 / ').map((p) => p.value)).toEqual(['05000000001']);
    expect(splitPhones('0500000000105000000002').map((p) => p.value)).toEqual(['05000000001', '05000000002']);
    expect(splitPhones('05000000001 / 05000000001').map((p) => p.value)).toEqual(['05000000001']);
  });
  it('gösterim ve tel: bağlantısı', () => {
    expect(formatPhone('05000000001')).toBe('0500 000 00 01');
    expect(telHref('05000000001')).toBe('tel:05000000001');
  });
});

describe('çoklu katılımcı ayrıştırma ve eşleştirme', () => {
  it('isimleri ve parantez içi görevleri ayırır', () => {
    const r = splitNames('AHMET TEST (BAŞKAN) / MEHMET DENEME');
    expect(r.parts).toEqual([
      { fullName: 'AHMET TEST', role: 'BAŞKAN' },
      { fullName: 'MEHMET DENEME', role: '' },
    ]);
    expect(splitNames('A KİŞİ  //// B KİŞİ').parts.map((p) => p.fullName)).toEqual(['A KİŞİ', 'B KİŞİ']);
    expect(splitNames('A KİŞİ /B KİŞİ').parts).toHaveLength(2);
    expect(splitNames('A KİŞİ - B KİŞİ').ambiguous).toBe(true);
    expect(splitNames('A KİŞİ(YÖN. KUR. ÜYESİ)').parts[0]).toEqual({ fullName: 'A KİŞİ', role: 'YÖN. KUR. ÜYESİ' });
  });
  it('2 isim + 2 numara: sıralı önerir ama doğrulanmamış işaretler', () => {
    const p = pairPeople(splitNames('A / B').parts, splitPhones('05000000001 / 05000000002'));
    expect(p.map((x) => x.phone)).toEqual(['05000000001', '05000000002']);
    expect(p.every((x) => x.flags.includes('pairing-unverified'))).toBe(true);
  });
  it('2 isim + 1 numara: tahmin etmez, ortak irtibat yapar', () => {
    const p = pairPeople(splitNames('A / B').parts, splitPhones('05000000001'));
    expect(p.map((x) => x.phone)).toEqual(['', '']);
    expect(p.every((x) => x.sharedPhones[0] === '05000000001' && x.flags.includes('shared-phone'))).toBe(true);
  });
  it('3 isim + 2 numara: hiçbir numarayı kişiye atamaz', () => {
    const p = pairPeople(splitNames('A / B / C').parts, splitPhones('05000000001 / 05000000002'));
    expect(p.every((x) => x.phone === '' && x.sharedPhones.length === 2)).toBe(true);
  });
  it('numara yoksa sahte veri üretmez', () => {
    const p = pairPeople(splitNames('A / B').parts, []);
    expect(p.every((x) => x.phone === '' && x.sharedPhones.length === 0 && x.flags.includes('missing-phone'))).toBe(true);
  });
});

describe('Excel ayrıştırma (yapay veri)', () => {
  const rows = syntheticRows();

  it('başlık satırını dinamik bulur (sabit sütun numarası yok)', () => {
    const h = detectHeader(rows)!;
    expect(h.headerIndex).toBe(1);
    expect(h.columns.name).toBe(12);
    expect(h.columns.boarding).toBe(15);
    expect(h.columns.transport).toBe(14);
    // Sütunlar yer değiştirse de çalışır
    const shuffled = rows.map((r) => [...r].reverse());
    const h2 = detectHeader(shuffled)!;
    expect(h2.columns.name).toBe(rows[1].length - 1 - 12);
    expect(parseRows(shuffled).rows.filter((r) => r.category === 'included')).toHaveLength(SYNTHETIC_EXPECTED.busRows);
  });

  it('yalnızca Katılacak + Otobüs satırlarını varsayılan havuza alır', () => {
    const res = parseRows(rows);
    const stats = computeStats(res, defaultSelection(res));
    expect(stats.totalRows).toBe(SYNTHETIC_EXPECTED.totalRows);
    expect(stats.attendingRows).toBe(SYNTHETIC_EXPECTED.attendingRows);
    expect(stats.busRows).toBe(SYNTHETIC_EXPECTED.busRows);
    expect(stats.parsedPeople).toBe(SYNTHETIC_EXPECTED.busPeople);
    expect(stats.multiPersonRows).toBe(SYNTHETIC_EXPECTED.multiPersonRows);
    expect(stats.excludedRows).toBe(SYNTHETIC_EXPECTED.totalRows - SYNTHETIC_EXPECTED.busRows);
    const cat = (sicil: string) => res.rows.find((r) => r.sicilNo === sicil)!.category;
    expect(cat('9007')).toBe('typo');
    expect(cat('9008')).toBe('other-transport');
    expect(cat('9012')).toBe('unknown-transport');
    expect(cat('9009')).toBe('excluded');
    expect(cat('9013')).toBe('excluded'); // Katılmayacak ama OTOBÜS yazılmış
  });

  it('SPRİNTER / OTOBÜD yalnızca kullanıcı seçerse dahil olur', () => {
    const res = parseRows(rows);
    const sel = defaultSelection(res);
    const typo = res.rows.find((r) => r.category === 'typo')!;
    const other = res.rows.find((r) => r.category === 'other-transport')!;
    expect(sel.has(typo.rowNumber)).toBe(false);
    sel.add(typo.rowNumber);
    sel.add(other.rowNumber);
    expect(computeStats(res, sel).parsedPeople).toBe(SYNTHETIC_EXPECTED.busPeople + 2);
  });

  it('telefonları string saklar, firma telefonunu kişisel telefonla karıştırmaz', () => {
    const res = parseRows(rows);
    const ayse = res.rows.find((r) => r.sicilNo === '9002')!;
    expect(ayse.people[0].phone).toBe('05000000002');
    expect(typeof ayse.people[0].phone).toBe('string');
    const husey = res.rows.find((r) => r.sicilNo === '9005')!;
    expect(husey.people[0].phone).toBe('');
    expect(husey.people[0].flags).toContain('missing-phone');
    expect(husey.companyPhone).toBe('05000000905');
    expect(husey.people[0].role).toBe('BAŞKAN');
  });

  it('aynı firmadan kişilere ayrı benzersiz anahtar verir', () => {
    const res = parseRows(rows);
    const keys = res.rows.flatMap((r) => (r.category === 'excluded' ? [] : r.people.map((p) => p.sourceKey)));
    expect(new Set(keys).size).toBe(keys.length);
    const multi = res.rows.find((r) => r.sicilNo === '9003')!;
    expect(multi.people.map((p) => p.fullName)).toEqual(['İSMAİL DENEME', 'ŞULE ÖRNEK']);
    expect(multi.people[0].sourceKey.startsWith('s:9003|')).toBe(true);
  });

  it('aynı firma + aynı isim tekrarını mükerrer kayıt yapmaz', () => {
    const dup = [...rows, [99, '9001', 'DENEME TARIM LTD. ŞTİ.', '', '', '', '', '', '', '', '', 'KATILACAK', 'ÇAĞRI ÖRNEKOĞLU', '05000000001', 'OTOBÜS', 'MERKEZ DURAK', '', '']];
    const res = parseRows(dup);
    const last = res.rows[res.rows.length - 1];
    expect(last.category).toBe('excluded');
    expect(last.excludeReason).toMatch(/Mükerrer/);
  });

  it('gerçek .xlsx biçiminde (sayısal telefon hücresiyle) okur', async () => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'reportUyeListesi');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const res = await readExcel(buf);
    expect(res.sheetName).toBe('reportUyeListesi');
    expect(res.rows.find((r) => r.sicilNo === '9002')!.people[0].phone).toBe('05000000002');
  });

  it('gerekli sütun yoksa açık hata verir', () => {
    expect(() => parseRows([['A', 'B'], [1, 2]])).toThrow(/Başlık/);
  });
});
