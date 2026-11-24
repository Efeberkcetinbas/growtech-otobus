// @vitest-environment node
/**
 * GERÇEK Excel dosyasının yalnızca yerel bilgisayarda doğrulanması.
 * Dosya proje klasörüne kopyalanmaz; yolu ortam değişkeniyle verilir:
 *   GROWTECH_REAL_XLSX="C:\Users\...\Downloads\dosya.xlsx" npm run test:real
 * Değişken yoksa (ör. GitHub Actions) test atlanır. Çıktıda isim/telefon yazdırılmaz,
 * yalnızca sayılar raporlanır.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeStats, defaultSelection } from '../../src/lib/excel/parse';
import { readExcel } from '../../src/lib/excel/read';

const path = process.env.GROWTECH_REAL_XLSX;
const enabled = !!path && existsSync(path);

describe.skipIf(!enabled)('gerçek Excel (yerel)', () => {
  it('ayrıştırma tutarlı ve veri uydurmuyor', async () => {
    const buf = readFileSync(path!);
    const res = await readExcel(new Uint8Array(buf));
    const sel = defaultSelection(res);
    const stats = computeStats(res, sel);
    const byCat: Record<string, number> = {};
    const peopleByCat: Record<string, number> = {};
    for (const r of res.rows) {
      byCat[r.category] = (byCat[r.category] ?? 0) + 1;
      peopleByCat[r.category] = (peopleByCat[r.category] ?? 0) + r.people.length;
    }
    const included = res.rows.filter((r) => sel.has(r.rowNumber));
    const people = included.flatMap((r) => r.people);
    const flagCounts: Record<string, number> = {};
    people.forEach((p) => p.flags.forEach((f) => (flagCounts[f] = (flagCounts[f] ?? 0) + 1)));
    const boarding: Record<string, number> = {};
    included.forEach((r) => (boarding[r.boarding || '(belirsiz)'] = (boarding[r.boarding || '(belirsiz)'] ?? 0) + r.people.length));

    console.log(
      JSON.stringify(
        {
          sheet: res.sheetName,
          headerRow: res.header.headerIndex + 1,
          columns: res.header.columns,
          missingOptional: res.header.missingOptional,
          stats,
          rowsByCategory: byCat,
          peopleByCategory: peopleByCat,
          flagCounts,
          peopleByBoarding: boarding,
          pairingRows: included.filter((r) => r.people.some((p) => p.flags.includes('pairing-unverified'))).length,
          sharedRows: included.filter((r) => r.people.some((p) => p.flags.includes('shared-phone'))).length,
        },
        null,
        2,
      ),
    );

    // Değişmezler
    expect(res.totalRows).toBeGreaterThan(0);
    for (const p of people) {
      expect(p.fullName.trim()).not.toBe('');
      expect(typeof p.phone).toBe('string');
      // Kişisel telefon ya satırdaki numaralardan biridir ya da boştur — uydurma yok
      if (p.phone) expect(p.phoneOptions).toContain(p.phone);
    }
    const keys = people.map((p) => p.sourceKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(included.every((r) => r.attendance === 'attending' && r.transport === 'bus')).toBe(true);
  });
});
