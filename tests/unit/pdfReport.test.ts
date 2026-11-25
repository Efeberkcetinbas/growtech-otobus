import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/lib/db';
import { defaultSelection, parseRows } from '../../src/lib/excel/parse';
import { applyImport, planImport, toIncoming } from '../../src/lib/import/merge';
import { buildPassengerPdf } from '../../src/lib/pdf';
import { collectPassengers, getBusInfo, saveBusInfo } from '../../src/lib/pdfReport';
import { addToBus, deletePerson, ensureDefaults, toggleCheck, updatePerson } from '../../src/lib/repo';
import { finalRows, finalYellowIndexes } from '../fixtures/final';

const fonts = {
  regular: readFileSync('src/assets/fonts/NotoSans-Regular.ttf').toString('base64'),
  bold: readFileSync('src/assets/fonts/NotoSans-Bold.ttf').toString('base64'),
};
const person = async (name: string) => (await db.persons.toArray()).find((p) => p.fullName === name)!;

beforeEach(async () => {
  await Promise.all([db.persons.clear(), db.bus.clear(), db.sessions.clear(), db.checks.clear(), db.settings.clear(), db.snapshots.clear()]);
  await ensureDefaults();
  const res = parseRows(finalRows(), 'reportUyeListesi', { yellowRows: finalYellowIndexes(), stylesRead: true });
  const sel = defaultSelection(res);
  await applyImport(planImport(toIncoming(res, sel, new Map()), []), new Map(), 'final.xlsx');
});

describe('PDF verisi (oluşturma anındaki IndexedDB)', () => {
  it('yalnızca otobüsteki kişiler, eklenme sırasıyla; çoklu katılımcılar ayrı satır', async () => {
    for (const n of ['AHMET YAPAY', 'MEHMET DENEMEOĞLU', 'TEK KİŞİ İKİNUMARA', 'TELEFONU YOK']) {
      await addToBus((await person(n)).id);
      await new Promise((r) => setTimeout(r, 3));
    }
    const rows = await collectPassengers();
    expect(rows.map((r) => r.fullName)).toEqual(['AHMET YAPAY', 'MEHMET DENEMEOĞLU', 'TEK KİŞİ İKİNUMARA', 'TELEFONU YOK']);
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3, 4]);
    expect(rows[0].contact).toBe('0500 000 10 01 (doğrulanmadı)');
    expect(rows[2].contact).toBe('0500 000 10 08 / 0500 000 10 09');
    expect(rows[3].contact).toBe('Belirtilmemiş');
    const pdf = buildPassengerPdf({ kind: 'standard', info: await getBusInfo(), passengers: rows, createdAt: new Date(), fonts });
    expect(pdf.rowCount).toBe(await db.bus.count());
  });

  it('sonradan yapılan düzenleme ve silme yeni PDF verisine yansır', async () => {
    const a = await person('AHMET YAPAY');
    const b = await person('MEHMET DENEMEOĞLU');
    await addToBus(a.id);
    await addToBus(b.id);
    expect(await collectPassengers()).toHaveLength(2);
    await updatePerson(a.id, { fullName: 'AHMET YAPAY KAYA', phone: '05000009999', company: a.company, boardingPlace: 'BORSA', note: '' });
    await deletePerson(b.id);
    const rows = await collectPassengers();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ fullName: 'AHMET YAPAY KAYA', contact: '0500 000 99 99', boarding: 'BORSA' });
  });

  it('yoklama durumlu veri seçili oturumdan alınır', async () => {
    const a = await person('AHMET YAPAY');
    const b = await person('MEHMET DENEMEOĞLU');
    await addToBus(a.id);
    await addToBus(b.id);
    const [gidis, donus] = await db.sessions.orderBy('order').toArray();
    await toggleCheck(gidis.id, a.id);
    expect((await collectPassengers(gidis.id)).map((r) => r.boarded)).toEqual([true, false]);
    expect((await collectPassengers(donus.id)).map((r) => r.boarded)).toEqual([false, false]);
  });

  it('otobüs bilgileri IndexedDB’de saklanır', async () => {
    await saveBusInfo({ number: '7', plate: '09 YAP 07', supervisor: 'DENEME SORUMLU' });
    expect(await getBusInfo()).toEqual({ number: '7', plate: '09 YAP 07', supervisor: 'DENEME SORUMLU' });
  });
});
