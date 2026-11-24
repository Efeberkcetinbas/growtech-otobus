import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/lib/db';
import { defaultSelection, parseRows } from '../../src/lib/excel/parse';
import { applyImport, planImport, toIncoming } from '../../src/lib/import/merge';
import {
  addToBus,
  createPerson,
  deletePerson,
  ensureDefaults,
  exportBackup,
  findSimilar,
  removeFromBus,
  restorePerson,
  toggleCheck,
} from '../../src/lib/repo';
import { syntheticRows } from '../fixtures/synthetic';

async function reset() {
  await Promise.all([db.persons.clear(), db.bus.clear(), db.sessions.clear(), db.checks.clear(), db.settings.clear(), db.snapshots.clear()]);
  await ensureDefaults();
}

async function importSynthetic() {
  const res = parseRows(syntheticRows());
  const plan = planImport(toIncoming(res, defaultSelection(res), new Map()), await db.persons.toArray());
  return { plan, result: await applyImport(plan, new Map(), 'test.xlsx') };
}

const active = async () => (await db.persons.toArray()).filter((p) => !p.deletedAt);
const byName = async (name: string) => (await db.persons.toArray()).find((p) => p.fullName === name)!;

beforeEach(reset);

describe('katılımcı silme', () => {
  it('kişiyi ana listeden ve otobüsten kaldırır, geçmiş yoklamayı korur', async () => {
    await importSynthetic();
    const ismail = await byName('İSMAİL DENEME');
    await addToBus(ismail.id);
    const [gidis] = await db.sessions.orderBy('order').toArray();
    await toggleCheck(gidis.id, ismail.id);

    const r = await deletePerson(ismail.id);
    expect(r.busAddedAt).toBeTypeOf('number');
    expect(await db.bus.get(ismail.id)).toBeUndefined();
    expect((await active()).some((p) => p.id === ismail.id)).toBe(false);
    expect((await active()).length).toBe(12);
    // Geçmiş yoklama kaydı ve kişi kaydı (silinme işaretiyle) duruyor
    expect(await db.checks.get([gidis.id, ismail.id])).toBeTruthy();
    expect((await db.persons.get(ismail.id))!.deletedAt).toBeTypeOf('number');
  });

  it('aynı firmadaki diğer kişileri silmez', async () => {
    await importSynthetic();
    const ismail = await byName('İSMAİL DENEME');
    const sule = await byName('ŞULE ÖRNEK');
    expect(ismail.companyKey).toBe(sule.companyKey);
    await deletePerson(ismail.id);
    expect((await db.persons.get(sule.id))!.deletedAt).toBeUndefined();
  });

  it('manuel eklenen kişi de silinebilir', async () => {
    const p = await createPerson({ fullName: 'ELLE EKLENEN', phone: '', company: '', boardingPlace: '', note: '' }, true);
    await deletePerson(p.id);
    expect(await active()).toHaveLength(0);
    expect(await db.bus.count()).toBe(0);
  });

  it('geri alma kişiyi ve otobüsteki eski sırasını geri getirir', async () => {
    const a = await createPerson({ fullName: 'BİRİNCİ YOLCU', phone: '', company: '', boardingPlace: '', note: '' }, true);
    await new Promise((r) => setTimeout(r, 5)); // farklı eklenme zamanı
    const b = await createPerson({ fullName: 'İKİNCİ YOLCU', phone: '', company: '', boardingPlace: '', note: '' }, true);
    const before = (await db.bus.get(a.id))!.addedAt;
    const { busAddedAt } = await deletePerson(a.id);
    await restorePerson(a.id, busAddedAt);
    expect((await db.persons.get(a.id))!.deletedAt).toBeUndefined();
    expect((await db.bus.get(a.id))!.addedAt).toBe(before);
    const order = (await db.bus.orderBy('addedAt').toArray()).map((x) => x.personId);
    expect(order).toEqual([a.id, b.id]);
  });

  it('silinen kişi otobüse eklenemez ve mükerrer uyarısında çıkmaz', async () => {
    const p = await createPerson({ fullName: 'SİLİNECEK KİŞİ', phone: '05000000071', company: '', boardingPlace: '', note: '' }, false);
    await deletePerson(p.id);
    await expect(addToBus(p.id)).rejects.toThrow();
    expect(await findSimilar('SİLİNECEK KİŞİ', '05000000071')).toHaveLength(0);
    await expect(deletePerson(p.id)).rejects.toThrow();
  });

  it('yeni Excel yüklemesinde silinen kişi geri eklenmez', async () => {
    await importSynthetic();
    const cagri = await byName('ÇAĞRI ÖRNEKOĞLU');
    await deletePerson(cagri.id);
    const { plan, result } = await importSynthetic();
    expect(plan.items.filter((i) => i.kind === 'deleted')).toHaveLength(1);
    expect(result.created).toBe(0);
    expect(result.skippedDeleted).toBe(1);
    expect(await active()).toHaveLength(12);
    expect((await db.persons.toArray()).filter((p) => p.fullName === 'ÇAĞRI ÖRNEKOĞLU')).toHaveLength(1);
    expect(plan.missing).toHaveLength(0);
  });

  it('silme yedekte de korunur (geri yüklemede kişi geri gelmez)', async () => {
    const p = await createPerson({ fullName: 'YEDEKTE SİLİNMİŞ', phone: '', company: '', boardingPlace: '', note: '' }, false);
    await deletePerson(p.id);
    const backup = await exportBackup();
    expect(backup.persons.find((x) => x.id === p.id)!.deletedAt).toBeTypeOf('number');
  });

  it('Listeden çıkar yalnızca otobüsten çıkarır, kişiyi silmez', async () => {
    const p = await createPerson({ fullName: 'OTOBÜSTEN ÇIKAN', phone: '', company: '', boardingPlace: '', note: '' }, true);
    await removeFromBus(p.id);
    expect(await db.bus.get(p.id)).toBeUndefined();
    expect((await db.persons.get(p.id))!.deletedAt).toBeUndefined();
    expect(await active()).toHaveLength(1);
  });
});
