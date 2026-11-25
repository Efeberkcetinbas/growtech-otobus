// @vitest-environment node
/**
 * GERÇEK Excel dosyasının yalnızca yerel bilgisayarda doğrulanması.
 * Dosya proje klasörüne kopyalanmaz; yolu ortam değişkeniyle verilir. Değişken yoksa
 * (ör. GitHub Actions) test atlanır. Çıktıda isim/telefon/TC yazdırılmaz, yalnızca sayılar.
 *
 *   GROWTECH_REAL_XLSX="…/liste.xlsx"                 (zorunlu)
 *   GROWTECH_EXPECT="totalRows=…,yellowRows=…"        (isteğe bağlı kontrol değerleri)
 *   GROWTECH_EXPECT_SPLIT="AD SOYAD|AD SOYAD"         (isteğe bağlı: ayrı kişilere bölünmesi beklenen hücre)
 *
 * Kontrol değerleri ve isimler bilerek koda yazılmaz; komut satırından verilir.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { computeStats, defaultSelection, type ImportStats } from '../../src/lib/excel/parse';
import { readExcel } from '../../src/lib/excel/read';
import { foldTr } from '../../src/lib/text';

const path = process.env.GROWTECH_REAL_XLSX;
const enabled = !!path && existsSync(path);

describe.skipIf(!enabled)('gerçek Excel (yerel)', () => {
  it('sarı satırlar, otobüs filtresi, çoklu katılımcı ve TC koruması', async () => {
    const buf = readFileSync(path!);
    const res = await readExcel(new Uint8Array(buf));
    const sel = defaultSelection(res);
    const stats = computeStats(res, sel);
    const included = res.rows.filter((r) => sel.has(r.rowNumber));
    const people = included.flatMap((r) => r.people);
    const multi = included.filter((r) => r.people.length > 1);
    const flagCounts: Record<string, number> = {};
    people.forEach((p) => p.flags.forEach((f) => (flagCounts[f] = (flagCounts[f] ?? 0) + 1)));
    const transportCounts: Record<string, number> = {};
    res.rows.forEach((r) => {
      const k = `${foldTr(r.transportRaw) || '(boş)'}${r.yellow ? ' [sarı]' : ''}`;
      transportCounts[k] = (transportCounts[k] ?? 0) + 1;
    });

    console.log(
      JSON.stringify(
        {
          sheet: res.sheetName,
          headerRow: res.header.headerIndex + 1,
          columns: res.header.columns,
          stylesRead: res.stylesRead,
          stats,
          transportCounts,
          multiRows: multi.map((r) => ({ row: r.rowNumber, people: r.people.length, flags: [...new Set(r.people.flatMap((p) => p.flags))] })),
          flagCounts,
        },
        null,
        2,
      ),
    );

    // Değişmezler
    expect(res.stylesRead).toBe(true);
    for (const r of included) expect(r.attendance === 'attending' && r.transport === 'bus' && !r.yellow).toBe(true);
    for (const p of people) {
      expect(p.fullName.trim()).not.toBe('');
      expect(typeof p.phone).toBe('string');
      if (p.phone) expect(p.phoneOptions).toContain(p.phone);
    }
    const keys = people.map((p) => p.sourceKey);
    expect(new Set(keys).size).toBe(keys.length);
    // Kişi sayısı = ayrıştırılmış isim parçaları (ayırıcı sayısı değil)
    expect(stats.parsedPeople).toBe(people.length);

    // TC NO değerleri hiçbir çıktıya geçmemeli
    const wb = XLSX.read(buf, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[res.sheetName], { header: 1, raw: false, defval: '' });
    const tcCol = rows[res.header.headerIndex].findIndex((h) => /\btc\b/i.test(foldTr(String(h))));
    const tcValues = tcCol >= 0 ? rows.slice(res.header.headerIndex + 1).map((r) => String(r[tcCol]).trim()).filter((v) => v.length >= 6) : [];
    const json = JSON.stringify(res);
    const leaked = tcValues.filter((v) => json.includes(v)).length;
    console.log(`TC sütunu: ${tcCol >= 0 ? 'var' : 'yok'}, dolu hücre ${tcValues.length}, sonuçta görünen ${leaked}`);
    expect(leaked).toBe(0);

    // İsteğe bağlı kontrol değerleri (komut satırından)
    if (process.env.GROWTECH_EXPECT) {
      for (const pair of process.env.GROWTECH_EXPECT.split(',')) {
        const [k, v] = pair.split('=');
        expect(stats[k.trim() as keyof ImportStats], k).toBe(Number(v));
      }
    }
    if (process.env.GROWTECH_EXPECT_SPLIT) {
      const names = process.env.GROWTECH_EXPECT_SPLIT.split('|').map((n) => foldTr(n));
      const hit = included.find((r) => r.people.length === names.length && r.people.every((p, i) => foldTr(p.fullName) === names[i]));
      expect(hit, 'beklenen çoklu katılımcı satırı ayrı kişilere bölünmeli').toBeTruthy();
      expect(new Set(hit!.people.map((p) => p.sourceKey)).size).toBe(names.length);
      console.log(`Beklenen satır (Excel satırı ${hit!.rowNumber}) ${hit!.people.length} ayrı kişiye bölündü.`);
    }
  });
});
