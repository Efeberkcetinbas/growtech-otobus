// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPassengerPdf, pdfFileName, type PdfFonts, type PdfPassenger } from '../../src/lib/pdf';
import { LONG_COMPANY } from '../fixtures/final';

const fonts: PdfFonts = {
  regular: readFileSync('src/assets/fonts/NotoSans-Regular.ttf').toString('base64'),
  bold: readFileSync('src/assets/fonts/NotoSans-Bold.ttf').toString('base64'),
};
const info = { number: '1', plate: '09 ABC 123', supervisor: 'YAPAY SORUMLU ŞİMŞEK' };
const TR = 'ÇĞİÖŞÜ çğıöşü';

/** Tamamen yapay yolcular. İlki Türkçe karakterli, biri uzun firmalı, biri numarasız. */
function passengers(n: number): PdfPassenger[] {
  return Array.from({ length: n }, (_, i) => ({
    seq: i + 1,
    fullName: i === 0 ? `ÇAĞRI ÖĞÜTÇÜ ŞİŞLİ` : `YOLCU${String(i + 1).padStart(3, '0')} DENEME`,
    company: i === 1 ? LONG_COMPANY : `YAPAY FİRMA ${i + 1} ${TR}`,
    contact: i === 2 ? 'Belirtilmemiş' : i === 3 ? '0500 000 00 04 (doğrulanmadı)' : `0500 000 ${String(10 + (i % 90)).padStart(2, '0')} ${String(i % 100).padStart(2, '0')}`,
    boarding: i % 2 ? 'BORSA' : 'KÖŞK / TÜRKMEN PETROL',
    boarded: i % 3 === 0,
  }));
}

async function extract(bytes: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)), useSystemFonts: false, disableFontFace: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    pages.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' '));
  }
  return pages;
}

describe('PDF yolcu listesi', () => {
  for (const n of [1, 30, 50, 100]) {
    it(`${n} kişilik standart liste: satır sayısı = yolcu sayısı, başlıklar ve sayfa numaraları`, async () => {
      const out = buildPassengerPdf({ kind: 'standard', info, passengers: passengers(n), createdAt: new Date(2026, 10, 26, 9, 5), fonts });
      expect(out.rowCount).toBe(n);
      expect(out.fileName).toBe('GROWTECH_2026_Otobus_1_Yolcu_Listesi_26-11-2026.pdf');
      const pages = await extract(out.bytes);
      expect(pages.length).toBe(out.pageCount);
      if (n >= 50) expect(pages.length).toBeGreaterThan(1);
      const all = pages.join(' ');
      // Her yolcu tam olarak bir kez, ayrı satırda
      for (let i = 2; i <= n; i++) expect(all.split(`YOLCU${String(i).padStart(3, '0')} DENEME`).length - 1).toBe(1);
      expect(all).toContain('ÇAĞRI ÖĞÜTÇÜ ŞİŞLİ');
      expect(all).toContain(`Toplam yolcu`.toLocaleUpperCase('tr-TR'));
      expect(all).toContain('AYDIN TİCARET BORSASI');
      expect(all).toContain('GROWTECH 2026 FUAR ORGANİZASYONU');
      expect(all).toContain('OTOBÜS YOLCU LİSTESİ');
      pages.forEach((p, i) => {
        expect(p, `sayfa ${i + 1} tablo başlığı`).toContain('Ad Soyad');
        expect(p).toContain('İrtibat Numarası');
        expect(p).toContain(`Sayfa ${i + 1} / ${pages.length}`);
      });
    });
  }

  it('Türkçe karakterler, uzun firma adı, eksik ve doğrulanmamış numara', async () => {
    const out = buildPassengerPdf({ kind: 'standard', info, passengers: passengers(5), createdAt: new Date(), fonts });
    const text = (await extract(out.bytes)).join(' ');
    for (const ch of 'ÇĞİÖŞÜçğıöşü') expect(text, ch).toContain(ch);
    expect(text).toContain('YAPAY SORUMLU ŞİMŞEK');
    expect(text).toContain('09 ABC 123');
    expect(text).toContain('Belirtilmemiş');
    expect(text).toContain('(doğrulanmadı)');
    expect(text).toContain('0500 000');
    // Uzun firma adı satırlara bölünür ama kaybolmaz
    expect(text.replace(/\s+/g, '')).toContain(LONG_COMPANY.replace(/\s+/g, ''));
  });

  it('yoklama durumlu liste: oturum, Bindi/Bekleniyor ve sayaçlar', async () => {
    const list = passengers(30);
    const boarded = list.filter((p) => p.boarded).length;
    const out = buildPassengerPdf({ kind: 'attendance', info, passengers: list, createdAt: new Date(2026, 10, 26), fonts, sessionName: 'Dönüş' });
    expect(out.fileName).toBe('GROWTECH_2026_Otobus_1_Yoklama_Donus_26-11-2026.pdf');
    const text = (await extract(out.bytes)).join(' ');
    expect(text).toContain('YOKLAMA DURUMU');
    expect(text).toContain('Dönüş');
    expect(text.split(' Bindi ').length - 1 + (text.endsWith(' Bindi') ? 1 : 0)).toBeGreaterThanOrEqual(1);
    const bindiCells = (text.match(/(^|\s)Bindi(\s|$)/g) ?? []).length;
    const waitCells = (text.match(/(^|\s)Bekleniyor(\s|$)/g) ?? []).length;
    expect(bindiCells).toBe(boarded);
    expect(waitCells).toBe(list.length - boarded);
    expect(text).toContain('BİNEN YOLCU');
    expect(text).toContain('BEKLENEN YOLCU');
  });

  it('metin tabanlıdır (ekran görüntüsü değil) ve yazı tipi gömülüdür', () => {
    const out = buildPassengerPdf({ kind: 'standard', info, passengers: passengers(3), createdAt: new Date(), fonts });
    const raw = Buffer.from(out.bytes).toString('latin1');
    expect(raw).not.toMatch(/\/Subtype\s*\/Image/);
    expect(raw).toMatch(/\/FontFile2/);
    expect(raw).toMatch(/\/ToUnicode/);
    expect(out.bytes.byteLength).toBeLessThan(400_000);
  });

  it('dosya adı: otobüs numarası ve tarih dinamik, Türkçe karakterler ASCII’ye çevrilir', () => {
    const d = new Date(2026, 10, 26);
    expect(pdfFileName('standard', '', d)).toBe('GROWTECH_2026_Otobus_Yolcu_Listesi_26-11-2026.pdf');
    expect(pdfFileName('attendance', '3', d, 'Mola sonrası')).toBe('GROWTECH_2026_Otobus_3_Yoklama_Mola_sonrasi_26-11-2026.pdf');
  });
});
